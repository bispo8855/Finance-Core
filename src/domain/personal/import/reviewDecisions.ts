// ============================================================================
// Aurys Personal — lógica PURA da tela de revisão (AP4C.1c-2).
// Mapeia o estado da UI → ApplyDecisions (contrato do planner), calcula os
// defaults de seleção, o gate do botão "Aplicar", o gate do dia a dia e o
// resumo do preview. NÃO escreve no banco, NÃO chama planner/executor.
// group_key é a identidade: rendas usam `renda:${key}`, fixas `fixa:${key}`.
// ============================================================================

import { SpendProfile } from '../types';
import { ApplyDecisions, ApplyPlan } from './applyPlan';
import { ImportSummary, InferredIncome, InferredFixed } from './personalImportInference';

export type ReviewScope = 'pessoal' | 'misto' | 'negocio';

export interface AccountChoice {
  mode: 'existing' | 'new';
  accountId?: string; // mode='existing'
  label?: string;     // mode='new'
}

export interface IncomeSelection { checked: boolean; recurringAnswer?: 'sim' | 'nao' }
export interface FixedSelection { checked: boolean }

export interface ReviewState {
  scope: ReviewScope | null;
  useBalance: boolean;
  accountChoice: AccountChoice | null;
  income: Record<string, IncomeSelection>; // keyed por group_key (`renda:...`)
  fixed: Record<string, FixedSelection>;   // keyed por group_key (`fixa:...`)
  dailyConfirmed: boolean;
  profile?: SpendProfile;
  today: string; // YYYY-MM-DD
}

// group_key congelado a partir da chave do bloco do summary.
export const incomeGroupKey = (i: InferredIncome): string => `renda:${i.key}`;
export const fixedGroupKey = (f: InferredFixed): string => `fixa:${f.key}`;

/** Renda vem marcada por padrão só com evidência forte (≥2 meses ou confiança alta). */
export function defaultIncomeChecked(i: InferredIncome): boolean {
  return i.months.length >= 2 || i.confidence === 'alta';
}
/** Uma ocorrência única não é recorrente por natureza. */
export function isSingleOccurrence(i: InferredIncome): boolean {
  return i.months.length < 2;
}
/** Fixa vem marcada por padrão só em confiança alta. */
export function defaultFixedChecked(f: InferredFixed): boolean {
  return f.confidence === 'alta';
}

/** Estado inicial da revisão a partir do summary (defaults por confiança). */
export function initialReviewState(summary: ImportSummary, today: string): ReviewState {
  const income: Record<string, IncomeSelection> = {};
  for (const i of summary.rendasProvaveis) income[incomeGroupKey(i)] = { checked: defaultIncomeChecked(i) };
  const fixed: Record<string, FixedSelection> = {};
  for (const f of summary.fixasProvaveis) fixed[fixedGroupKey(f)] = { checked: defaultFixedChecked(f) };
  return {
    scope: summary.alertaContaMista ? null : 'pessoal',
    useBalance: false, accountChoice: null, income, fixed, dailyConfirmed: false, today,
  };
}

/** Valida o alvo de conta escolhido na UI. */
export function validAccountChoice(c: AccountChoice | null): boolean {
  if (!c) return false;
  if (c.mode === 'existing') return !!c.accountId;
  if (c.mode === 'new') return !!c.label && c.label.trim().length > 0;
  return false;
}

/** A UI precisa do radio de escopo quando o extrato acusou conta mista PF/PJ. */
export function needsScope(summary: ImportSummary): boolean {
  return !!summary.alertaContaMista;
}

export interface ApplyGate { ok: boolean; reasons: string[] }

/** Gate do botão "Aplicar dados confirmados". */
export function canApply(state: ReviewState, summary: ImportSummary): ApplyGate {
  const reasons: string[] = [];
  if (needsScope(summary) && !state.scope) reasons.push('Escolha o escopo da conta (Pessoal / Misto / Da empresa).');
  if (state.scope === 'negocio') reasons.push('Conta de negócio — nada a aplicar no Personal.');
  if (state.useBalance && !validAccountChoice(state.accountChoice)) reasons.push('Escolha a conta para aplicar o saldo (existente ou nova).');
  // Dia a dia confirmado exige o perfil de pagamento (define o split no motor).
  if (state.dailyConfirmed && !state.profile) reasons.push('Informe como você paga a maior parte do dia a dia.');
  return { ok: reasons.length === 0, reasons };
}

/** Candidato de dia a dia + gates (sem escrever). */
export interface DailyCandidate {
  hasCandidate: boolean;
  min: number; normal: number; heavy: number;
  completeMonths: number;
  outrosHigh: boolean;
  canConfirm: boolean; // pode oferecer o toggle de confirmação?
  reason: string | null;
}
export function dailyCandidate(summary: ImportSummary): DailyCandidate {
  const dd = summary.diaADia;
  const completeMonths = dd.porMes.filter((p) => !p.parcial).length;
  const total = summary.gastosVariaveis.total;
  const outros = summary.gastosVariaveis.byCategory.find((c) => c.category === 'Outros')?.total ?? 0;
  const outrosHigh = total > 0 && outros / total > 0.20;
  const hasCandidate = dd.porMes.length > 0 && (dd.min > 0 || dd.normal > 0 || dd.heavy > 0);
  let reason: string | null = null;
  if (completeMonths === 0) reason = 'Faltam meses completos para estimar o dia a dia com segurança.';
  else if (outrosHigh) reason = '"Outros" passa de 20% dos gastos variáveis — o dia a dia ainda não é confiável.';
  const canConfirm = hasCandidate && completeMonths >= 1 && !outrosHigh;
  return { hasCandidate, min: dd.min, normal: dd.normal, heavy: dd.heavy, completeMonths, outrosHigh, canConfirm, reason };
}

/** Estado da UI → ApplyDecisions (contrato do planner). "É renda" ≠ "é recorrente". */
export function buildDecisions(state: ReviewState): ApplyDecisions {
  const income: NonNullable<ApplyDecisions['income']> = {};
  for (const [gk, sel] of Object.entries(state.income)) {
    if (!sel.checked) continue;
    income[gk] = { confirmedIncome: true, confirmedRecurring: sel.recurringAnswer === 'sim' };
  }
  const fixed: NonNullable<ApplyDecisions['fixed']> = {};
  for (const [gk, sel] of Object.entries(state.fixed)) {
    if (sel.checked) fixed[gk] = { confirmed: true };
  }
  const decisions: ApplyDecisions = {
    income, fixed,
    daily: { userConfirmedDailySpending: state.dailyConfirmed },
    today: state.today,
  };
  // Perfil de pagamento escolhido pelo usuário → decisions (antes era descartado).
  if (state.profile) decisions.profile = state.profile;
  if (state.useBalance && validAccountChoice(state.accountChoice)) {
    decisions.useBalance = true;
    decisions.accountTarget = state.accountChoice!.mode === 'existing'
      ? { kind: 'existing', accountId: state.accountChoice!.accountId! }
      : { kind: 'new', label: state.accountChoice!.label!.trim() };
  }
  return decisions;
}

/** Resumo legível do preview a partir do ApplyPlan. */
export interface PlanPreview {
  saldo: boolean;
  rendas: number;
  fixas: number;
  daily: boolean;
  dedupe: number;         // itens que já existem e não serão duplicados
  applicable: boolean;    // há ao menos uma ação com efeito (não-skip)?
  onboardingConfiavel: boolean;
  onboardingMissing: string[];
}
export function planPreview(plan: ApplyPlan): PlanPreview {
  const creates = (arr: ApplyPlan['incomeActions']) => arr.filter((a) => a.op === 'create').length;
  const reconciles = (arr: ApplyPlan['incomeActions']) => arr.filter((a) => a.op === 'reconcile').length;
  // Aplicável = qualquer ação de conta/renda/fixa/daily que NÃO seja skip
  // (create, update ou reconcile produzem efeito persistente). Settings não conta.
  const applicable = [plan.accountActions, plan.incomeActions, plan.fixedActions, plan.dailyActions]
    .some((arr) => arr.some((a) => a.op !== 'skip'));
  return {
    saldo: plan.accountActions.some((a) => a.op === 'create' || a.op === 'update'),
    rendas: creates(plan.incomeActions),
    fixas: creates(plan.fixedActions),
    daily: plan.dailyActions.some((a) => a.op === 'create'),
    dedupe: reconciles(plan.incomeActions) + reconciles(plan.fixedActions),
    applicable,
    onboardingConfiavel: plan.onboarding.willBeConfiavel,
    onboardingMissing: plan.onboarding.missing,
  };
}

/** Decisões por item para auditoria no staging (confirmado/ignorado por grupo). */
export interface ItemDecisionWrite { itemId: string; userDecision: 'confirmado' | 'corrigido' | 'ignorado' }
export function itemDecisionsFromPlan(plan: ApplyPlan): ItemDecisionWrite[] {
  const out: ItemDecisionWrite[] = [];
  const push = (ids: string[], decision: ItemDecisionWrite['userDecision']) => { for (const id of ids) out.push({ itemId: id, userDecision: decision }); };
  for (const a of [...plan.incomeActions, ...plan.fixedActions]) {
    if (a.op === 'create' || a.op === 'reconcile' || a.op === 'update') push(a.sourceItemIds, 'confirmado');
    else if (a.op === 'skip') push(a.sourceItemIds, 'ignorado');
  }
  return out;
}
