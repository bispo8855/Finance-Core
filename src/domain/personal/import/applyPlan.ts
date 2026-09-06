// ============================================================================
// Aurys Personal — PLANNER + EXECUTOR da aplicação do staging (AP4C.1c-1).
// buildApplyPlan: PURO, não escreve no banco — decide create/update/reconcile/
// skip por bloco (conta/renda/fixa/dia a dia/settings). runApplyPlan: executor
// com deps INJETADAS (sem Supabase direto aqui). Agrupamento SÓ por group_key
// congelado; nunca rederiva merchantKey no apply-time. Sem UI, sem migration.
// ============================================================================

import { Confidence } from '../types';
import { normalizeDescription, PersonalCategory } from './personalCategories';
import { ImportSummary, ImportItemKind } from './personalImportInference';
import {
  AccountTarget, hasExplicitAccountTarget, batchNeedsReimport,
  decideIncomeRoutine, isEssential,
} from './applyContract';
import { PersistedPersonalData } from '../personalInputsAdapter';
import { podeGerarLeituraConfiavel } from '../onboardingValidation';

// ---------------------------------------------------------------------------
// Linhas reais do staging (subset dos campos usados pelo planner).
// ---------------------------------------------------------------------------
export interface ImportItemRow {
  id: string;
  group_key: string | null;
  inferred_kind: ImportItemKind;
  inferred_category: PersonalCategory | null;
  raw_date: string;        // YYYY-MM-DD
  raw_amount: number;
  raw_description: string;
  direction: 'entrada' | 'saida';
  user_decision?: 'confirmado' | 'corrigido' | 'ignorado' | null;
  applied_to_id?: string | null;
  applied_to_table?: string | null;
}

export interface ImportBatchRow {
  id: string;
  workspace_id: string;
  status: 'parsed' | 'review' | 'applied' | 'discarded';
  account_scope: 'pessoal' | 'misto' | 'negocio' | null;
  detected_balance: number | null;
  balance_source: 'movimento' | 'rodape' | null;
  period_start: string | null;
  period_end: string | null;
  applied_account_id: string | null;
  summary_json: ImportSummary | null;
}

// ---------------------------------------------------------------------------
// Contrato do plano.
// ---------------------------------------------------------------------------
export type ApplyOp = 'create' | 'update' | 'reconcile' | 'skip';
export type ApplyTargetKind = 'account' | 'income' | 'fixed' | 'daily' | 'settings';

export type ReconcileReason = 'matched_existing' | 'recovered_partial_apply';

export interface ApplyAction {
  kind: ApplyTargetKind;
  op: ApplyOp;
  sourceItemIds: string[];
  groupKey: string | null;
  reason: string;
  confidence: Confidence;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any> | null; // dados p/ create/update; null p/ skip
  targetId?: string;                    // update/reconcile → id do alvo existente
  // Só em op='reconcile'. 'matched_existing' = alvo compatível já existente (só
  // vincula provenance). 'recovered_partial_apply' = recuperação de execução
  // parcial — usado APENAS com evidência suficiente (hoje: sempre matched_existing).
  reconcileReason?: ReconcileReason;
}

export interface ApplyPlan {
  batchId: string;
  workspaceId: string;
  batchStatus: ImportBatchRow['status'];
  blocked: boolean;
  blockedReason: string | null;
  accountActions: ApplyAction[];
  incomeActions: ApplyAction[];
  fixedActions: ApplyAction[];
  dailyActions: ApplyAction[];
  settingsAction: ApplyAction | null;
  onboarding: { willBeConfiavel: boolean; missing: string[] };
}

export interface ApplyDecisions {
  useBalance?: boolean;
  accountTarget?: AccountTarget | null;
  income?: Record<string, { confirmedIncome?: boolean; confirmedRecurring?: boolean }>;
  fixed?: Record<string, { confirmed?: boolean }>;
  // Confirmação explícita para persistir dia a dia. Exigida SEMPRE enquanto não
  // houver separação automática de atípicos/one-offs (AP4C.1b mostra o placeholder).
  // Vale inclusive para ≥2 meses completos.
  daily?: { userConfirmedDailySpending?: boolean };
  today: string; // YYYY-MM-DD — para onboarding_completed_at (determinístico)
}

export interface BuildApplyPlanArgs {
  batch: ImportBatchRow;
  items: ImportItemRow[];
  decisions: ApplyDecisions;
  existingPersonalData: PersistedPersonalData;
}

// ---------------------------------------------------------------------------
// Helpers puros.
// ---------------------------------------------------------------------------
const monthOf = (d: string) => d.slice(0, 7);
const dayOf = (d: string) => Number(d.slice(8, 10)) || 1;
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  const v = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  return Math.round(v * 100) / 100;
}
function mode(nums: number[]): number {
  if (nums.length === 0) return 1;
  const c = new Map<number, number>();
  let best = nums[0], bestN = 0;
  for (const n of nums) { const k = (c.get(n) ?? 0) + 1; c.set(n, k); if (k > bestN) { bestN = k; best = n; } }
  return best;
}
const within5pct = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 0.05;
const normLabel = (s: string) => normalizeDescription(s);
const confByOccurrences = (occ: number): Confidence => (occ >= 3 ? 'alta' : occ === 2 ? 'media' : 'baixa');

/** Agrupa itens por group_key (ignora null). Mantém ordem por sourceRow via raw_date. */
function groupByKey(items: ImportItemRow[]): Map<string, ImportItemRow[]> {
  const g = new Map<string, ImportItemRow[]>();
  for (const it of items) {
    if (!it.group_key) continue;
    const arr = g.get(it.group_key) ?? [];
    arr.push(it);
    g.set(it.group_key, arr);
  }
  return g;
}

/** Dedupe forte → operação pretendida. 0 match=create; 1=reconcile; >1=skip ambíguo. */
function dedupeOp(matchIds: string[]): { op: ApplyOp; targetId?: string; reason: string; reconcileReason?: ReconcileReason } {
  if (matchIds.length === 0) return { op: 'create', reason: 'sem correspondente — criar' };
  if (matchIds.length === 1) {
    // Sem evidência de que foi recuperação de execução parcial → matched_existing.
    // (Reconcile nunca altera amount/day/label do alvo; só vincula provenance.)
    return { op: 'reconcile', targetId: matchIds[0], reconcileReason: 'matched_existing', reason: 'matched_existing: alvo compatível já existente — vincular sem duplicar/atualizar' };
  }
  return { op: 'skip', reason: 'match ambíguo (dedupe_candidate) — não criar nem atualizar' };
}

// ---------------------------------------------------------------------------
// buildApplyPlan — PURO.
// ---------------------------------------------------------------------------
export function buildApplyPlan(args: BuildApplyPlanArgs): ApplyPlan {
  const { batch, items, decisions, existingPersonalData: db } = args;
  const empty = (blockedReason: string | null): ApplyPlan => ({
    batchId: batch.id, workspaceId: batch.workspace_id, batchStatus: batch.status,
    blocked: blockedReason != null, blockedReason,
    accountActions: [], incomeActions: [], fixedActions: [], dailyActions: [], settingsAction: null,
    onboarding: { willBeConfiavel: false, missing: [] },
  });

  // ---- Guardas globais ----
  if (batch.status === 'applied') return empty('Batch já aplicado — não reaplicar.');
  if (batch.status === 'discarded') return empty('Batch descartado — não aplicar.');
  if (batch.account_scope === 'negocio') return empty('Conta de negócio — nada a aplicar no Personal.');
  // Batch antigo (renda/fixa exigindo agrupamento) sem group_key → exige reimportação.
  if (batchNeedsReimport(items.map((i) => ({ inferred_kind: i.inferred_kind, group_key: i.group_key })))) {
    return empty('Importação antiga sem identidade de grupo — refazer a importação para aplicar.');
  }

  // Conta mista: itens PJ só entram com confirmação explícita — a trava vive aqui
  // (planner), via os gates de confirmação de renda/fixa abaixo, não só na UI.
  const accountActions: ApplyAction[] = [];
  const incomeActions: ApplyAction[] = [];
  const fixedActions: ApplyAction[] = [];
  const dailyActions: ApplyAction[] = [];

  // ==== CONTA / SALDO ====
  if (decisions.useBalance) {
    if (!hasExplicitAccountTarget(decisions.accountTarget)) {
      accountActions.push({ kind: 'account', op: 'skip', sourceItemIds: [], groupKey: null,
        reason: 'saldo requer um AccountTarget explícito (existente ou nova conta).', confidence: 'baixa', payload: null });
    } else if (batch.detected_balance == null) {
      accountActions.push({ kind: 'account', op: 'skip', sourceItemIds: [], groupKey: null,
        reason: 'sem saldo detectado no extrato.', confidence: 'baixa', payload: null });
    } else {
      const balanceDate = batch.period_end ?? decisions.today;
      const conf: Confidence = batch.balance_source === 'movimento' ? 'alta' : 'media';
      const target = decisions.accountTarget!;
      if (target.kind === 'existing') {
        const acc = db.accounts.find((a) => a.id === target.accountId);
        if (!acc) {
          accountActions.push({ kind: 'account', op: 'skip', sourceItemIds: [], groupKey: null,
            reason: 'conta escolhida não encontrada no workspace.', confidence: 'baixa', payload: null });
        } else if (acc.balance_date && batch.period_end && acc.balance_date > batch.period_end) {
          // Proteção temporal: extrato antigo não sobrescreve saldo mais recente.
          accountActions.push({ kind: 'account', op: 'skip', sourceItemIds: [], groupKey: null,
            reason: `saldo do extrato (${balanceDate}) é mais antigo que o saldo atual da conta (${acc.balance_date}).`, confidence: conf, payload: null });
        } else {
          accountActions.push({ kind: 'account', op: 'update', sourceItemIds: [], groupKey: null, targetId: acc.id,
            reason: 'atualizar saldo da conta escolhida.', confidence: conf,
            payload: { currentBalance: batch.detected_balance, balanceDate, confidence: conf } });
        }
      } else {
        accountActions.push({ kind: 'account', op: 'create', sourceItemIds: [], groupKey: null,
          reason: 'criar nova conta com o saldo do extrato.', confidence: conf,
          payload: { label: target.label, currentBalance: batch.detected_balance, balanceDate, confidence: conf } });
      }
    }
  }

  // ==== RENDAS (agrupa só por group_key) ====
  const rendaGroups = groupByKey(items.filter((i) => i.inferred_kind === 'renda'));
  for (const [groupKey, group] of rendaGroups) {
    const ids = group.map((g) => g.id);
    const alreadyLinked = group.every((g) => !!g.applied_to_id);
    if (alreadyLinked) {
      incomeActions.push({ kind: 'income', op: 'skip', sourceItemIds: ids, groupKey, reason: 'grupo já aplicado (retry) — pular.', confidence: 'media', payload: null });
      continue;
    }
    const dec = decisions.income?.[groupKey] ?? {};
    if (!dec.confirmedIncome) {
      incomeActions.push({ kind: 'income', op: 'skip', sourceItemIds: ids, groupKey, reason: 'renda não confirmada pelo usuário.', confidence: 'baixa', payload: null });
      continue;
    }
    const occurrences = new Set(group.map((g) => monthOf(g.raw_date))).size;
    if (decideIncomeRoutine({ occurrences, userConfirmedRecurring: dec.confirmedRecurring }) !== 'monthly') {
      incomeActions.push({ kind: 'income', op: 'skip', sourceItemIds: ids, groupKey,
        reason: 'renda pontual (sem recorrência ≥2 meses nem confirmação de recorrência) — não criar fonte.', confidence: 'baixa', payload: null });
      continue;
    }
    const amount = median(group.map((g) => g.raw_amount));
    const dayOfMonth = mode(group.map((g) => dayOf(g.raw_date)));
    const label = group[0].raw_description.trim();
    const conf = confByOccurrences(occurrences);
    const matches = db.incomeSources.filter((s) =>
      normLabel(s.label) === normLabel(label) && within5pct(s.amount, amount)
      && Math.abs((s.day_of_month ?? 0) - dayOfMonth) <= 3 && s.frequency === 'mensal' && s.nature === 'rotina',
    ).map((s) => s.id);
    const d = dedupeOp(matches);
    incomeActions.push({
      kind: 'income', op: d.op, sourceItemIds: ids, groupKey, targetId: d.targetId, reconcileReason: d.reconcileReason, reason: d.reason, confidence: conf,
      payload: d.op === 'create' ? { label, amount, dayOfMonth, frequency: 'mensal', nature: 'rotina', confidence: conf } : null,
    });
  }

  // ==== FIXAS (agrupa só por group_key) ====
  const fixaGroups = groupByKey(items.filter((i) => i.inferred_kind === 'fixa'));
  for (const [groupKey, group] of fixaGroups) {
    const ids = group.map((g) => g.id);
    const alreadyLinked = group.every((g) => !!g.applied_to_id);
    if (alreadyLinked) {
      fixedActions.push({ kind: 'fixed', op: 'skip', sourceItemIds: ids, groupKey, reason: 'grupo já aplicado (retry) — pular.', confidence: 'media', payload: null });
      continue;
    }
    if (!decisions.fixed?.[groupKey]?.confirmed) {
      fixedActions.push({ kind: 'fixed', op: 'skip', sourceItemIds: ids, groupKey, reason: 'fixa não confirmada pelo usuário.', confidence: 'baixa', payload: null });
      continue;
    }
    // Conta mista: itens com aparência PJ não entram sem confirmação explícita (já é a confirmação acima).
    const amount = median(group.map((g) => g.raw_amount));
    const dayOfMonth = mode(group.map((g) => dayOf(g.raw_date)));
    const label = group[0].raw_description.trim();
    const category = group[0].inferred_category;
    const occurrences = new Set(group.map((g) => monthOf(g.raw_date))).size;
    const conf = confByOccurrences(occurrences);
    const essential = isEssential(category, label);
    const matches = db.fixedCommitments.filter((f) =>
      normLabel(f.label) === normLabel(label) && within5pct(f.amount, amount)
      && Math.abs((f.day_of_month ?? 0) - dayOfMonth) <= 3 && f.pay_method === 'debito',
    ).map((f) => f.id);
    const d = dedupeOp(matches);
    fixedActions.push({
      kind: 'fixed', op: d.op, sourceItemIds: ids, groupKey, targetId: d.targetId, reconcileReason: d.reconcileReason, reason: d.reason, confidence: conf,
      payload: d.op === 'create' ? { label, amount, dayOfMonth, payMethod: 'debito', essential, confidence: conf } : null,
    });
  }

  // ==== DIA A DIA (só meses completos; gates) ====
  const summary = batch.summary_json;
  if (summary) {
    const completos = summary.diaADia.porMes.filter((p) => !p.parcial);
    const totalVar = summary.gastosVariaveis.total;
    const outros = summary.gastosVariaveis.byCategory.find((c) => c.category === 'Outros')?.total ?? 0;
    const outrosAlto = totalVar > 0 && outros / totalVar > 0.20;
    const duvidosaSaida = summary.duvidosos.filter((d) => d.line.direction === 'saida').reduce((a, d) => a + d.line.amount, 0);
    const duvidosaMaterial = totalVar > 0 && duvidosaSaida / totalVar > 0.10;
    const existingMonths = new Set(db.dailySpending.map((d) => d.month_iso));
    // BLOQUEIO TEMPORÁRIO (AP4C.1c-1.1): sem separação automática de atípicos/one-offs,
    // o dia a dia NÃO é persistido automaticamente — nem com ≥2 meses completos.
    // Só entra com confirmação explícita do usuário (userConfirmedDailySpending).
    const dailyConfirmed = !!decisions.daily?.userConfirmedDailySpending;

    for (const p of completos) {
      const monthISO = p.monthISO;
      const monthItemIds = items.filter((i) => i.inferred_kind === 'variavel' && monthOf(i.raw_date) === monthISO).map((i) => i.id);
      if (existingMonths.has(monthISO)) {
        dailyActions.push({ kind: 'daily', op: 'skip', sourceItemIds: monthItemIds, groupKey: null, reason: `já existe dia a dia para ${monthISO} — não sobrescrever.`, confidence: 'baixa', payload: null });
        continue;
      }
      if (outrosAlto) {
        dailyActions.push({ kind: 'daily', op: 'skip', sourceItemIds: monthItemIds, groupKey: null, reason: `"Outros" > 20% dos gastos variáveis — dia a dia não confiável.`, confidence: 'baixa', payload: null });
        continue;
      }
      if (!dailyConfirmed) {
        dailyActions.push({ kind: 'daily', op: 'skip', sourceItemIds: monthItemIds, groupKey: null,
          reason: 'dia a dia requer confirmação explícita — atípicos/one-offs ainda não são separados automaticamente.', confidence: 'baixa', payload: null });
        continue;
      }
      // confiança: 1 mês completo → baixa; ≥2 → confiança do resíduo; duvidosa material rebaixa.
      let confidence: Confidence = completos.length === 1 ? 'baixa' : summary.diaADia.confidence;
      if (duvidosaMaterial) confidence = 'baixa';
      dailyActions.push({
        kind: 'daily', op: 'create', sourceItemIds: monthItemIds, groupKey: null,
        reason: duvidosaMaterial ? 'dia a dia confirmado; confiança rebaixada por saída duvidosa material.' : 'dia a dia confirmado (meses completos).',
        confidence,
        payload: { monthISO, minAmount: summary.diaADia.min, normalAmount: summary.diaADia.normal, heavyAmount: summary.diaADia.heavy, profile: 'desconhecido', confidence },
      });
    }
  }

  // ==== ONBOARDING/SETTINGS (reusa podeGerarLeituraConfiavel; nunca inventa mínimo) ====
  const onboarding = projectOnboarding(db, { accountActions, incomeActions, fixedActions, dailyActions });
  let settingsAction: ApplyAction | null = null;
  const alreadyCompleted = !!db.settings?.onboarding_completed_at;
  if (onboarding.ok && !alreadyCompleted) {
    settingsAction = { kind: 'settings', op: 'update', sourceItemIds: [], groupKey: null,
      reason: 'leitura confiável alcançada — marcar onboarding concluído.', confidence: 'alta',
      payload: { onboardingCompletedAt: decisions.today } };
  }

  return {
    batchId: batch.id, workspaceId: batch.workspace_id, batchStatus: batch.status,
    blocked: false, blockedReason: null,
    accountActions, incomeActions, fixedActions, dailyActions, settingsAction,
    onboarding: { willBeConfiavel: onboarding.ok, missing: onboarding.missing },
  };
}

// Projeta o snapshot (existente + ações planejadas) e reusa o gate de onboarding.
function projectOnboarding(
  db: PersistedPersonalData,
  planned: { accountActions: ApplyAction[]; incomeActions: ApplyAction[]; fixedActions: ApplyAction[]; dailyActions: ApplyAction[] },
): { ok: boolean; missing: string[] } {
  const willCreate = (a: ApplyAction) => a.op === 'create' || a.op === 'reconcile' || a.op === 'update';

  const accounts = [
    ...db.accounts.map((a) => ({ label: a.label, currentBalance: a.current_balance, balanceDate: a.balance_date ?? '2000-01-01', confidence: a.confidence as Confidence })),
    ...planned.accountActions.filter(willCreate).map(() => ({ label: 'conta', currentBalance: 0, balanceDate: '2000-01-01', confidence: 'media' as Confidence })),
  ];
  const incomeSources = [
    ...db.incomeSources.map((s) => ({ label: s.label, amount: s.amount, dayOfMonth: s.day_of_month ?? 1, frequency: s.frequency as 'mensal' | 'avulsa', nature: s.nature, confidence: s.confidence as Confidence })),
    ...planned.incomeActions.filter(willCreate).map(() => ({ label: 'renda', amount: 1, dayOfMonth: 1, frequency: 'mensal' as const, nature: 'rotina' as const, confidence: 'media' as Confidence })),
  ];
  const fixedCommitments = [
    ...db.fixedCommitments.map((f) => ({ label: f.label, amount: f.amount, dayOfMonth: f.day_of_month ?? 1, payMethod: f.pay_method, confidence: f.confidence as Confidence })),
    ...planned.fixedActions.filter(willCreate).map(() => ({ label: 'fixa', amount: 1, dayOfMonth: 1, payMethod: 'debito' as const, confidence: 'media' as Confidence })),
  ];
  const temDaily = db.dailySpending.length > 0 || planned.dailyActions.some((a) => a.op === 'create');
  const dailySpending = temDaily ? { minAmount: 1, normalAmount: 2, heavyAmount: 3, profile: 'desconhecido' as const, confidence: 'baixa' as Confidence } : null;

  // Reusa o MESMO gate do onboarding — sem inventar regra nova de mínimos.
  return podeGerarLeituraConfiavel({
    accounts, incomeSources, fixedCommitments, dailySpending,
    cards: [], cardBills: [],
    declaredNoCards: !!db.settings?.declared_no_cards,
    declaredNoFixedCommitments: !!db.settings?.declared_no_fixed_commitments,
  });
}

// ---------------------------------------------------------------------------
// runApplyPlan — EXECUTOR com deps injetadas. Não importa Supabase.
// ---------------------------------------------------------------------------
export interface ApplyExecutorDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createAccount: (payload: any) => Promise<{ id: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateAccount: (id: string, patch: any) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createIncome: (payload: any) => Promise<{ id: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createFixed: (payload: any) => Promise<{ id: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsertDaily: (payload: any) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsertSettings: (payload: any) => Promise<void>;
  linkItems: (itemIds: string[], table: string, targetId: string) => Promise<void>;
  setBatchAppliedAccount: (batchId: string, accountId: string) => Promise<void>;
  markBatchApplied: (batchId: string) => Promise<void>;
}

export interface ApplyResult {
  applied: boolean;
  blocked: boolean;
  blockedReason: string | null;
  created: { accounts: number; incomes: number; fixed: number; daily: number };
  reconciled: number;
  skipped: number;
}

const TABLE: Record<ApplyTargetKind, string> = {
  account: 'personal_accounts', income: 'personal_income_sources',
  fixed: 'personal_fixed_commitments', daily: 'personal_daily_spending', settings: 'personal_settings',
};

/** Executa o plano na ordem. status='applied' só no final. Retry-safe por vínculo. */
export async function runApplyPlan(plan: ApplyPlan, deps: ApplyExecutorDeps): Promise<ApplyResult> {
  const res: ApplyResult = { applied: false, blocked: false, blockedReason: null, created: { accounts: 0, incomes: 0, fixed: 0, daily: 0 }, reconciled: 0, skipped: 0 };

  if (plan.batchStatus === 'applied') throw new Error('Batch já aplicado — não reaplicar.');
  if (plan.batchStatus === 'discarded') throw new Error('Batch descartado — não aplicar.');
  if (plan.blocked) { res.blocked = true; res.blockedReason = plan.blockedReason; return res; }

  // 1) Conta / saldo (também grava applied_account_id).
  for (const a of plan.accountActions) {
    if (a.op === 'skip') { res.skipped++; continue; }
    let accountId: string;
    if (a.op === 'create') { accountId = (await deps.createAccount(a.payload)).id; res.created.accounts++; }
    else if (a.op === 'update') { accountId = a.targetId!; await deps.updateAccount(accountId, a.payload); }
    else { accountId = a.targetId!; res.reconciled++; }
    if (a.sourceItemIds.length) await deps.linkItems(a.sourceItemIds, TABLE.account, accountId);
    await deps.setBatchAppliedAccount(plan.batchId, accountId);
  }

  // 2) Rendas.
  for (const a of plan.incomeActions) {
    if (a.op === 'skip') { res.skipped++; continue; }
    let targetId: string;
    if (a.op === 'create') { targetId = (await deps.createIncome(a.payload)).id; res.created.incomes++; }
    else { targetId = a.targetId!; res.reconciled++; }
    await deps.linkItems(a.sourceItemIds, TABLE.income, targetId);
  }

  // 3) Fixas.
  for (const a of plan.fixedActions) {
    if (a.op === 'skip') { res.skipped++; continue; }
    let targetId: string;
    if (a.op === 'create') { targetId = (await deps.createFixed(a.payload)).id; res.created.fixed++; }
    else { targetId = a.targetId!; res.reconciled++; }
    await deps.linkItems(a.sourceItemIds, TABLE.fixed, targetId);
  }

  // 4) Dia a dia (upsert por mês; sem id de retorno → vínculo por item usa o próprio mês).
  for (const a of plan.dailyActions) {
    if (a.op === 'skip') { res.skipped++; continue; }
    await deps.upsertDaily(a.payload);
    res.created.daily++;
    // vínculo dos itens variáveis do mês: usa month_iso como chave lógica do alvo daily.
    if (a.sourceItemIds.length) await deps.linkItems(a.sourceItemIds, TABLE.daily, String(a.payload!.monthISO));
  }

  // 5) Settings / onboarding.
  if (plan.settingsAction && plan.settingsAction.op !== 'skip') {
    await deps.upsertSettings(plan.settingsAction.payload);
  }

  // 6) Só agora: marca o batch como aplicado.
  await deps.markBatchApplied(plan.batchId);
  res.applied = true;
  return res;
}
