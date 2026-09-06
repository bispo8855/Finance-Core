import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildApplyPlan, runApplyPlan,
  ImportItemRow, ImportBatchRow, ApplyDecisions, ApplyExecutorDeps, ApplyPlan,
} from '@/domain/personal/import/applyPlan';
import { ImportSummary } from '@/domain/personal/import/personalImportInference';
import { PersistedPersonalData } from '@/domain/personal/personalInputsAdapter';

// ---------------------------------------------------------------------------
// Fábricas
// ---------------------------------------------------------------------------
let seq = 0;
const item = (over: Partial<ImportItemRow> = {}): ImportItemRow => ({
  id: `it-${seq++}`, group_key: null, inferred_kind: 'variavel', inferred_category: null,
  raw_date: '2026-06-10', raw_amount: 50, raw_description: 'x', direction: 'saida',
  user_decision: null, applied_to_id: null, applied_to_table: null, ...over,
});
const batch = (over: Partial<ImportBatchRow> = {}): ImportBatchRow => ({
  id: 'b1', workspace_id: 'ws1', status: 'review', account_scope: 'pessoal',
  detected_balance: null, balance_source: null, period_start: '2026-06-01', period_end: '2026-07-31',
  applied_account_id: null, summary_json: null, ...over,
});
const db = (over: Partial<PersistedPersonalData> = {}): PersistedPersonalData => ({
  accounts: [], incomeSources: [], cards: [], cardBills: [], fixedCommitments: [], installments: [],
  reimbursements: [], extraordinaryEvents: [], dailySpending: [], settings: undefined, ...over,
});
const decisions = (over: Partial<ApplyDecisions> = {}): ApplyDecisions => ({ today: '2026-08-01', ...over });

// summary_json mínimo p/ os gates de dia a dia
function sumJson(o: {
  porMes?: { monthISO: string; total: number; parcial: boolean }[];
  min?: number; normal?: number; heavy?: number; confidence?: 'alta' | 'media' | 'baixa';
  total?: number; byCategory?: { category: string; total: number; count: number }[];
  duvidosos?: { line: { sourceRow: number; date: string; description: string; amount: number; direction: 'entrada' | 'saida' }; reason: string }[];
}): ImportSummary {
  return {
    period: { from: '', to: '', months: [], mesesParciais: [] },
    counts: { linhas: 0, rendas: 0, fixas: 0, transferenciasProprias: 0, pagamentosFatura: 0, variaveis: 0, ignorados: 0, duvidosos: 0 },
    saldo: { valor: null, fonte: null }, alertaContaMista: null,
    rendasProvaveis: [], fixasProvaveis: [], transferenciasProprias: [], pagamentosFatura: [],
    gastosVariaveis: { total: o.total ?? 0, byCategory: (o.byCategory ?? []) as ImportSummary['gastosVariaveis']['byCategory'] },
    categoriasTop: [], ignorados: [], duvidosos: (o.duvidosos ?? []) as ImportSummary['duvidosos'],
    diaADia: { porMes: o.porMes ?? [], min: o.min ?? 0, normal: o.normal ?? 0, heavy: o.heavy ?? 0, confidence: o.confidence ?? 'media', issues: [] },
    itens: [],
  } as ImportSummary;
}

function fakeDeps(over: Partial<ApplyExecutorDeps> = {}) {
  const calls = {
    createAccount: [] as unknown[], updateAccount: [] as unknown[], createIncome: [] as unknown[],
    createFixed: [] as unknown[], upsertDaily: [] as unknown[], upsertSettings: [] as unknown[],
    linkItems: [] as { ids: string[]; table: string; targetId: string }[],
    setBatchAppliedAccount: [] as unknown[], markBatchApplied: 0,
  };
  const deps: ApplyExecutorDeps = {
    createAccount: async (p) => { calls.createAccount.push(p); return { id: 'acc-new' }; },
    updateAccount: async (id, patch) => { calls.updateAccount.push({ id, patch }); },
    createIncome: async (p) => { calls.createIncome.push(p); return { id: 'inc-new' }; },
    createFixed: async (p) => { calls.createFixed.push(p); return { id: 'fix-new' }; },
    upsertDaily: async (p) => { calls.upsertDaily.push(p); },
    upsertSettings: async (p) => { calls.upsertSettings.push(p); },
    linkItems: async (ids, table, targetId) => { calls.linkItems.push({ ids, table, targetId }); },
    setBatchAppliedAccount: async (bid, aid) => { calls.setBatchAppliedAccount.push({ bid, aid }); },
    markBatchApplied: async () => { calls.markBatchApplied++; },
    ...over,
  };
  return { deps, calls };
}

// ===========================================================================
// group_key como única identidade de agrupamento
// ===========================================================================
describe('agrupamento SÓ por group_key', () => {
  it('mesma group_key com descrições diferentes vira UM grupo', () => {
    const items = [
      item({ id: 'a', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:salario', raw_description: 'SALARIO ACME', raw_amount: 9000, raw_date: '2026-06-05' }),
      item({ id: 'b', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:salario', raw_description: 'PAGAMENTO EMPRESA XPTO', raw_amount: 9000, raw_date: '2026-07-05' }),
    ];
    const plan = buildApplyPlan({ batch: batch(), items, decisions: decisions({ income: { 'renda:salario': { confirmedIncome: true } } }), existingPersonalData: db() });
    expect(plan.incomeActions.length).toBe(1);
    expect(plan.incomeActions[0].sourceItemIds.sort()).toEqual(['a', 'b']);
    expect(plan.incomeActions[0].op).toBe('create'); // 2 meses → recorrente
  });

  it('group_keys diferentes viram grupos diferentes', () => {
    const items = [
      item({ id: 'a', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:salario', raw_amount: 9000, raw_date: '2026-06-05' }),
      item({ id: 'b', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:aluguel_recebido', raw_amount: 1200, raw_date: '2026-06-06' }),
    ];
    const plan = buildApplyPlan({ batch: batch(), items, decisions: decisions({ income: { 'renda:salario': { confirmedIncome: true, confirmedRecurring: true }, 'renda:aluguel_recebido': { confirmedIncome: true, confirmedRecurring: true } } }), existingPersonalData: db() });
    expect(plan.incomeActions.length).toBe(2);
  });
});

// ===========================================================================
// Bloqueios globais
// ===========================================================================
describe('bloqueios globais', () => {
  it('batch antigo com renda/fixa e group_key NULL bloqueia (reimportação)', () => {
    const items = [item({ inferred_kind: 'renda', direction: 'entrada', group_key: null })];
    const plan = buildApplyPlan({ batch: batch(), items, decisions: decisions(), existingPersonalData: db() });
    expect(plan.blocked).toBe(true);
    expect(plan.blockedReason).toMatch(/refazer a importação/i);
  });

  it('scope negocio → plano vazio e bloqueado', () => {
    const items = [item({ inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x' })];
    const plan = buildApplyPlan({ batch: batch({ account_scope: 'negocio' }), items, decisions: decisions(), existingPersonalData: db() });
    expect(plan.blocked).toBe(true);
    expect(plan.incomeActions).toEqual([]);
  });

  it('batch já applied → bloqueado (não reaplica)', () => {
    const plan = buildApplyPlan({ batch: batch({ status: 'applied' }), items: [], decisions: decisions(), existingPersonalData: db() });
    expect(plan.blocked).toBe(true);
    expect(plan.blockedReason).toMatch(/já aplicado/i);
  });

  it('batch discarded → bloqueado / plano vazio', () => {
    const items = [item({ inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x' })];
    const plan = buildApplyPlan({ batch: batch({ status: 'discarded' }), items, decisions: decisions({ income: { 'renda:x': { confirmedIncome: true, confirmedRecurring: true } } }), existingPersonalData: db() });
    expect(plan.blocked).toBe(true);
    expect(plan.blockedReason).toMatch(/descartado/i);
    expect(plan.incomeActions).toEqual([]);
    expect(plan.accountActions).toEqual([]);
    expect(plan.settingsAction).toBeNull();
  });
});

// ===========================================================================
// Conta / saldo
// ===========================================================================
describe('conta / saldo', () => {
  it('saldo requer AccountTarget explícito', () => {
    const plan = buildApplyPlan({ batch: batch({ detected_balance: 1000, balance_source: 'movimento' }), items: [], decisions: decisions({ useBalance: true }), existingPersonalData: db() });
    expect(plan.accountActions[0].op).toBe('skip');
    expect(plan.accountActions[0].reason).toMatch(/AccountTarget/);
  });

  it('AccountTarget new → create; existing → update', () => {
    const create = buildApplyPlan({ batch: batch({ detected_balance: 1000, balance_source: 'movimento' }), items: [], decisions: decisions({ useBalance: true, accountTarget: { kind: 'new', label: 'Nubank' } }), existingPersonalData: db() });
    expect(create.accountActions[0].op).toBe('create');
    expect(create.accountActions[0].payload).toMatchObject({ label: 'Nubank', currentBalance: 1000 });

    const upd = buildApplyPlan({
      batch: batch({ detected_balance: 1000, balance_source: 'movimento', period_end: '2026-07-31' }),
      items: [], decisions: decisions({ useBalance: true, accountTarget: { kind: 'existing', accountId: 'acc-1' } }),
      existingPersonalData: db({ accounts: [{ id: 'acc-1', label: 'Conta', current_balance: 5, balance_date: '2026-06-01', is_reserve: null, confidence: 'media' }] }),
    });
    expect(upd.accountActions[0].op).toBe('update');
    expect(upd.accountActions[0].targetId).toBe('acc-1');
  });

  it('saldo antigo NÃO sobrescreve saldo mais recente (proteção temporal)', () => {
    const plan = buildApplyPlan({
      batch: batch({ detected_balance: 1000, balance_source: 'movimento', period_end: '2026-05-31' }),
      items: [], decisions: decisions({ useBalance: true, accountTarget: { kind: 'existing', accountId: 'acc-1' } }),
      existingPersonalData: db({ accounts: [{ id: 'acc-1', label: 'Conta', current_balance: 5, balance_date: '2026-07-15', is_reserve: null, confidence: 'media' }] }),
    });
    expect(plan.accountActions[0].op).toBe('skip');
    expect(plan.accountActions[0].reason).toMatch(/mais antigo/);
  });
});

// ===========================================================================
// Rendas
// ===========================================================================
describe('rendas', () => {
  const oneOcc = () => [item({ id: 'r1', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x', raw_amount: 500, raw_date: '2026-06-10' })];

  it('confirmada como renda mas NÃO recorrente (1 ocorrência) → não cria', () => {
    const plan = buildApplyPlan({ batch: batch(), items: oneOcc(), decisions: decisions({ income: { 'renda:x': { confirmedIncome: true } } }), existingPersonalData: db() });
    expect(plan.incomeActions[0].op).toBe('skip');
    expect(plan.incomeActions[0].reason).toMatch(/pontual/);
  });

  it('1 ocorrência + confirmedRecurring → cria', () => {
    const plan = buildApplyPlan({ batch: batch(), items: oneOcc(), decisions: decisions({ income: { 'renda:x': { confirmedIncome: true, confirmedRecurring: true } } }), existingPersonalData: db() });
    expect(plan.incomeActions[0].op).toBe('create');
  });

  it('mediana (amount) e moda (dayOfMonth) corretas', () => {
    const items = [
      item({ id: 'r1', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x', raw_amount: 100, raw_date: '2026-05-05' }),
      item({ id: 'r2', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x', raw_amount: 110, raw_date: '2026-06-05' }),
      item({ id: 'r3', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x', raw_amount: 105, raw_date: '2026-07-07' }),
    ];
    const plan = buildApplyPlan({ batch: batch(), items, decisions: decisions({ income: { 'renda:x': { confirmedIncome: true } } }), existingPersonalData: db() });
    expect(plan.incomeActions[0].payload).toMatchObject({ amount: 105, dayOfMonth: 5, frequency: 'mensal', nature: 'rotina' });
  });

  it('dedupe: match forte único → reconcile (não duplica)', () => {
    const items = [item({ id: 'r1', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x', raw_amount: 500, raw_date: '2026-06-10', raw_description: 'Salario' }),
      item({ id: 'r2', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x', raw_amount: 500, raw_date: '2026-07-10', raw_description: 'Salario' })];
    const plan = buildApplyPlan({ batch: batch(), items, decisions: decisions({ income: { 'renda:x': { confirmedIncome: true } } }),
      existingPersonalData: db({ incomeSources: [{ id: 'inc-9', label: 'Salario', amount: 500, day_of_month: 10, frequency: 'mensal', nature: 'rotina', variable: null, specific_date: null, confidence: 'media' }] }) });
    expect(plan.incomeActions[0].op).toBe('reconcile');
    expect(plan.incomeActions[0].targetId).toBe('inc-9');
    // Auditoria: sem evidência de recuperação parcial → matched_existing (não finge).
    expect(plan.incomeActions[0].reconcileReason).toBe('matched_existing');
    expect(plan.incomeActions[0].payload).toBeNull(); // reconcile nunca carrega dados p/ atualizar
  });

  it('fixa: match forte único → reconcile matched_existing (não atualiza)', () => {
    const items = [
      item({ id: 'f1', inferred_kind: 'fixa', group_key: 'fixa:net', inferred_category: 'Outros', raw_description: 'Internet', raw_amount: 100, raw_date: '2026-06-01' }),
      item({ id: 'f2', inferred_kind: 'fixa', group_key: 'fixa:net', inferred_category: 'Outros', raw_description: 'Internet', raw_amount: 100, raw_date: '2026-07-01' }),
    ];
    const plan = buildApplyPlan({ batch: batch(), items, decisions: decisions({ fixed: { 'fixa:net': { confirmed: true } } }),
      existingPersonalData: db({ fixedCommitments: [{ id: 'fix-9', label: 'Internet', amount: 100, day_of_month: 1, pay_method: 'debito', card_id: null, essential: true, active_until: null, confidence: 'media' }] }) });
    expect(plan.fixedActions[0].op).toBe('reconcile');
    expect(plan.fixedActions[0].reconcileReason).toBe('matched_existing');
    expect(plan.fixedActions[0].targetId).toBe('fix-9');
    expect(plan.fixedActions[0].payload).toBeNull();
  });

  it('match ambíguo → skip (nunca cria/atualiza silenciosamente)', () => {
    const items = [item({ id: 'r1', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x', raw_amount: 500, raw_date: '2026-06-10', raw_description: 'Salario' }),
      item({ id: 'r2', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x', raw_amount: 500, raw_date: '2026-07-10', raw_description: 'Salario' })];
    const dup = { id: '', label: 'Salario', amount: 500, day_of_month: 10, frequency: 'mensal' as const, nature: 'rotina' as const, variable: null, specific_date: null, confidence: 'media' as const };
    const plan = buildApplyPlan({ batch: batch(), items, decisions: decisions({ income: { 'renda:x': { confirmedIncome: true } } }),
      existingPersonalData: db({ incomeSources: [{ ...dup, id: 'inc-1' }, { ...dup, id: 'inc-2' }] }) });
    expect(plan.incomeActions[0].op).toBe('skip');
    expect(plan.incomeActions[0].reason).toMatch(/ambíguo/);
  });

  it('grupo já vinculado (retry) → skip', () => {
    const items = [item({ id: 'r1', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x', applied_to_id: 'inc-7', applied_to_table: 'personal_income_sources', raw_date: '2026-06-10' })];
    const plan = buildApplyPlan({ batch: batch(), items, decisions: decisions({ income: { 'renda:x': { confirmedIncome: true } } }), existingPersonalData: db() });
    expect(plan.incomeActions[0].op).toBe('skip');
    expect(plan.incomeActions[0].reason).toMatch(/já aplicado/);
  });
});

// ===========================================================================
// Fixas
// ===========================================================================
describe('fixas', () => {
  it('só confirmadas entram; essential segue a lista', () => {
    const items = [
      item({ id: 'f1', inferred_kind: 'fixa', group_key: 'fixa:aluguel', inferred_category: 'Moradia', raw_amount: 1300, raw_date: '2026-06-01', raw_description: 'Aluguel' }),
      item({ id: 'f2', inferred_kind: 'fixa', group_key: 'fixa:aluguel', inferred_category: 'Moradia', raw_amount: 1300, raw_date: '2026-07-01', raw_description: 'Aluguel' }),
    ];
    const naoConf = buildApplyPlan({ batch: batch(), items, decisions: decisions(), existingPersonalData: db() });
    expect(naoConf.fixedActions[0].op).toBe('skip');

    const conf = buildApplyPlan({ batch: batch(), items, decisions: decisions({ fixed: { 'fixa:aluguel': { confirmed: true } } }), existingPersonalData: db() });
    expect(conf.fixedActions[0].op).toBe('create');
    expect(conf.fixedActions[0].payload).toMatchObject({ payMethod: 'debito', essential: true });
  });

  it('essential=false p/ categoria não essencial; true p/ utilidade por descrição', () => {
    const naoEss = buildApplyPlan({ batch: batch(), items: [item({ id: 'f', inferred_kind: 'fixa', group_key: 'fixa:x', inferred_category: 'Assinaturas/Serviços', raw_description: 'Streaming', raw_amount: 40, raw_date: '2026-06-01' })], decisions: decisions({ fixed: { 'fixa:x': { confirmed: true } } }), existingPersonalData: db() });
    expect(naoEss.fixedActions[0].payload!.essential).toBe(false);

    const util = buildApplyPlan({ batch: batch(), items: [item({ id: 'f', inferred_kind: 'fixa', group_key: 'fixa:net', inferred_category: 'Outros', raw_description: 'INTERNET FIBRA', raw_amount: 100, raw_date: '2026-06-01' })], decisions: decisions({ fixed: { 'fixa:net': { confirmed: true } } }), existingPersonalData: db() });
    expect(util.fixedActions[0].payload!.essential).toBe(true);
  });
});

// ===========================================================================
// Transferência / fatura / duvidoso não aplicam
// ===========================================================================
describe('não-aplicáveis', () => {
  it('transferencia_propria, pagamento_fatura e duvidoso sem decisão não geram ação', () => {
    const items = [
      item({ inferred_kind: 'transferencia_propria', group_key: null }),
      item({ inferred_kind: 'pagamento_fatura', group_key: null }),
      item({ inferred_kind: 'duvidoso', group_key: null }),
    ];
    const plan = buildApplyPlan({ batch: batch(), items, decisions: decisions(), existingPersonalData: db() });
    expect(plan.incomeActions).toEqual([]);
    expect(plan.fixedActions).toEqual([]);
    expect(plan.accountActions).toEqual([]);
  });
});

// ===========================================================================
// Conta mista protege PJ
// ===========================================================================
describe('conta mista', () => {
  it('scope misto: fixa não confirmada não entra', () => {
    const items = [item({ id: 'f', inferred_kind: 'fixa', group_key: 'fixa:pj', inferred_category: 'Outros', raw_description: 'Boleto fornecedor', raw_amount: 800, raw_date: '2026-06-01' })];
    const plan = buildApplyPlan({ batch: batch({ account_scope: 'misto' }), items, decisions: decisions(), existingPersonalData: db() });
    expect(plan.blocked).toBe(false);
    expect(plan.fixedActions[0].op).toBe('skip');
  });
});

// ===========================================================================
// Dia a dia
// ===========================================================================
describe('dia a dia', () => {
  it('0 meses completos → nenhuma ação de daily', () => {
    const s = sumJson({ porMes: [{ monthISO: '2026-06', total: 300, parcial: true }], total: 300, byCategory: [{ category: 'Mercado', total: 300, count: 3 }] });
    const plan = buildApplyPlan({ batch: batch({ summary_json: s }), items: [], decisions: decisions(), existingPersonalData: db() });
    expect(plan.dailyActions.filter((a) => a.op === 'create')).toEqual([]);
  });

  it('1 mês completo só com confirmação explícita, confiança baixa', () => {
    const s = sumJson({ porMes: [{ monthISO: '2026-06', total: 300, parcial: false }], min: 250, normal: 300, heavy: 350, confidence: 'media', total: 300, byCategory: [{ category: 'Mercado', total: 300, count: 3 }] });
    const semConf = buildApplyPlan({ batch: batch({ summary_json: s }), items: [], decisions: decisions(), existingPersonalData: db() });
    expect(semConf.dailyActions[0].op).toBe('skip');

    const comConf = buildApplyPlan({ batch: batch({ summary_json: s }), items: [], decisions: decisions({ daily: { userConfirmedDailySpending: true } }), existingPersonalData: db() });
    expect(comConf.dailyActions[0].op).toBe('create');
    expect(comConf.dailyActions[0].confidence).toBe('baixa');
  });

  it('BLOQUEIO TEMPORÁRIO: ≥2 meses completos SEM confirmação → NÃO cria daily', () => {
    const s = sumJson({ porMes: [{ monthISO: '2026-06', total: 300, parcial: false }, { monthISO: '2026-07', total: 300, parcial: false }, { monthISO: '2026-08', total: 300, parcial: false }], min: 300, normal: 300, heavy: 300, confidence: 'media', total: 900, byCategory: [{ category: 'Mercado', total: 900, count: 9 }] });
    const plan = buildApplyPlan({ batch: batch({ summary_json: s }), items: [], decisions: decisions(), existingPersonalData: db() });
    expect(plan.dailyActions.filter((a) => a.op === 'create')).toEqual([]);
    expect(plan.dailyActions.every((a) => a.op === 'skip')).toBe(true);
    expect(plan.dailyActions[0].reason).toMatch(/atípicos\/one-offs/i);
  });

  it('≥2 meses completos COM confirmação explícita → cria; parcial não entra', () => {
    const s = sumJson({ porMes: [{ monthISO: '2026-06', total: 300, parcial: false }, { monthISO: '2026-07', total: 320, parcial: false }, { monthISO: '2026-08', total: 100, parcial: true }], min: 300, normal: 310, heavy: 320, confidence: 'media', total: 620, byCategory: [{ category: 'Mercado', total: 620, count: 6 }] });
    const plan = buildApplyPlan({ batch: batch({ summary_json: s }), items: [], decisions: decisions({ daily: { userConfirmedDailySpending: true } }), existingPersonalData: db() });
    const creates = plan.dailyActions.filter((a) => a.op === 'create');
    expect(creates.length).toBe(2);
    expect(creates.map((a) => a.payload!.monthISO).sort()).toEqual(['2026-06', '2026-07']);
    expect(plan.dailyActions.some((a) => a.payload && a.payload.monthISO === '2026-08')).toBe(false);
  });

  it('"Outros" > 20% bloqueia', () => {
    const s = sumJson({ porMes: [{ monthISO: '2026-06', total: 300, parcial: false }, { monthISO: '2026-07', total: 300, parcial: false }], min: 300, normal: 300, heavy: 300, total: 100, byCategory: [{ category: 'Outros', total: 30, count: 5 }] });
    const plan = buildApplyPlan({ batch: batch({ summary_json: s }), items: [], decisions: decisions(), existingPersonalData: db() });
    expect(plan.dailyActions.every((a) => a.op === 'skip')).toBe(true);
    expect(plan.dailyActions[0].reason).toMatch(/Outros/);
  });

  it('saída duvidosa material rebaixa confiança para baixa', () => {
    const s = sumJson({
      porMes: [{ monthISO: '2026-06', total: 300, parcial: false }, { monthISO: '2026-07', total: 300, parcial: false }],
      min: 300, normal: 300, heavy: 300, confidence: 'media', total: 100, byCategory: [{ category: 'Mercado', total: 100, count: 5 }],
      duvidosos: [{ line: { sourceRow: 1, date: '2026-06-15', description: 'PIX ?', amount: 20, direction: 'saida' }, reason: 'x' }],
    });
    const plan = buildApplyPlan({ batch: batch({ summary_json: s }), items: [], decisions: decisions({ daily: { userConfirmedDailySpending: true } }), existingPersonalData: db() });
    const creates = plan.dailyActions.filter((a) => a.op === 'create');
    expect(creates.length).toBeGreaterThan(0);
    expect(creates.every((a) => a.confidence === 'baixa')).toBe(true);
  });

  it('3 meses completos, sem Outros alto, SEM confirmação → não cria (bloqueio de one-offs)', () => {
    const s = sumJson({ porMes: [{ monthISO: '2026-05', total: 300, parcial: false }, { monthISO: '2026-06', total: 300, parcial: false }, { monthISO: '2026-07', total: 300, parcial: false }], min: 300, normal: 300, heavy: 300, confidence: 'media', total: 900, byCategory: [{ category: 'Mercado', total: 900, count: 9 }] });
    const plan = buildApplyPlan({ batch: batch({ summary_json: s }), items: [], decisions: decisions(), existingPersonalData: db() });
    expect(plan.dailyActions.filter((a) => a.op === 'create')).toEqual([]);
  });

  it('3 meses completos + confirmação explícita → cria', () => {
    const s = sumJson({ porMes: [{ monthISO: '2026-05', total: 300, parcial: false }, { monthISO: '2026-06', total: 300, parcial: false }, { monthISO: '2026-07', total: 300, parcial: false }], min: 300, normal: 300, heavy: 300, confidence: 'media', total: 900, byCategory: [{ category: 'Mercado', total: 900, count: 9 }] });
    const plan = buildApplyPlan({ batch: batch({ summary_json: s }), items: [], decisions: decisions({ daily: { userConfirmedDailySpending: true } }), existingPersonalData: db() });
    expect(plan.dailyActions.filter((a) => a.op === 'create').length).toBe(3);
  });

  it('não sobrescreve daily existente do mês (skip)', () => {
    const s = sumJson({ porMes: [{ monthISO: '2026-06', total: 300, parcial: false }, { monthISO: '2026-07', total: 300, parcial: false }], min: 300, normal: 300, heavy: 300, total: 300, byCategory: [{ category: 'Mercado', total: 300, count: 3 }] });
    const plan = buildApplyPlan({ batch: batch({ summary_json: s }), items: [], decisions: decisions(),
      existingPersonalData: db({ dailySpending: [{ id: 'd1', month_iso: '2026-06', min_amount: 1, normal_amount: 2, heavy_amount: 3, profile: 'desconhecido', confidence: 'baixa' }] }) });
    const jun = plan.dailyActions.find((a) => a.payload?.monthISO === '2026-06' || a.reason.includes('2026-06'));
    expect(jun!.op).toBe('skip');
  });
});

// ===========================================================================
// Onboarding via podeGerarLeituraConfiavel
// ===========================================================================
describe('onboarding usa podeGerarLeituraConfiavel', () => {
  const s2meses = () => sumJson({ porMes: [{ monthISO: '2026-06', total: 300, parcial: false }, { monthISO: '2026-07', total: 300, parcial: false }], min: 300, normal: 300, heavy: 300, total: 300, byCategory: [{ category: 'Mercado', total: 300, count: 3 }] });
  const items = () => [
    item({ id: 'r1', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x', raw_amount: 500, raw_date: '2026-06-10' }),
    item({ id: 'r2', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:x', raw_amount: 500, raw_date: '2026-07-10' }),
  ];
  const settingsBase = { workspace_id: 'ws1', onboarding_completed_at: null, anchor_month: null, declared_no_cards: true, declared_no_fixed_commitments: true };

  it('gate ok (conta+renda+daily CONFIRMADO, sem cartão/fixa declarados) → marca onboarding', () => {
    const plan = buildApplyPlan({
      batch: batch({ detected_balance: 1000, balance_source: 'movimento', summary_json: s2meses() }),
      items: items(),
      decisions: decisions({ useBalance: true, accountTarget: { kind: 'new', label: 'Conta' }, income: { 'renda:x': { confirmedIncome: true } }, daily: { userConfirmedDailySpending: true } }),
      existingPersonalData: db({ settings: settingsBase }),
    });
    expect(plan.onboarding.willBeConfiavel).toBe(true);
    expect(plan.settingsAction).not.toBeNull();
    expect(plan.settingsAction!.payload).toMatchObject({ onboardingCompletedAt: '2026-08-01' });
  });

  it('candidato daily NÃO confirmado não completa o onboarding', () => {
    const plan = buildApplyPlan({
      batch: batch({ detected_balance: 1000, balance_source: 'movimento', summary_json: s2meses() }),
      items: items(),
      // daily sem confirmação → nenhum daily create → gate acusa "dia a dia".
      decisions: decisions({ useBalance: true, accountTarget: { kind: 'new', label: 'Conta' }, income: { 'renda:x': { confirmedIncome: true } } }),
      existingPersonalData: db({ settings: settingsBase }),
    });
    expect(plan.dailyActions.filter((a) => a.op === 'create')).toEqual([]);
    expect(plan.onboarding.willBeConfiavel).toBe(false);
    expect(plan.onboarding.missing).toContain('dia a dia');
    expect(plan.settingsAction).toBeNull();
  });

  it('sem daily → não confiável e ausência não vira zero (settingsAction null)', () => {
    const plan = buildApplyPlan({
      batch: batch({ detected_balance: 1000, balance_source: 'movimento' }), // sem summary_json → sem daily
      items: items(),
      decisions: decisions({ useBalance: true, accountTarget: { kind: 'new', label: 'Conta' }, income: { 'renda:x': { confirmedIncome: true } } }),
      existingPersonalData: db({ settings: settingsBase }),
    });
    expect(plan.onboarding.willBeConfiavel).toBe(false);
    expect(plan.onboarding.missing).toContain('dia a dia');
    expect(plan.settingsAction).toBeNull();
  });

  it('já onboarded → não remarca', () => {
    const plan = buildApplyPlan({
      batch: batch({ detected_balance: 1000, balance_source: 'movimento', summary_json: s2meses() }),
      items: items(),
      decisions: decisions({ useBalance: true, accountTarget: { kind: 'new', label: 'Conta' }, income: { 'renda:x': { confirmedIncome: true } } }),
      existingPersonalData: db({ settings: { ...settingsBase, onboarding_completed_at: '2026-01-01' } }),
    });
    expect(plan.settingsAction).toBeNull();
  });
});

// ===========================================================================
// Executor runApplyPlan
// ===========================================================================
function planWith(over: Partial<ApplyPlan>): ApplyPlan {
  return {
    batchId: 'b1', workspaceId: 'ws1', batchStatus: 'review', blocked: false, blockedReason: null,
    accountActions: [], incomeActions: [], fixedActions: [], dailyActions: [], settingsAction: null,
    onboarding: { willBeConfiavel: false, missing: [] }, ...over,
  };
}

describe('runApplyPlan (executor)', () => {
  it('cria income e vincula TODOS os sourceItemIds ao mesmo id', async () => {
    const plan = planWith({ incomeActions: [{ kind: 'income', op: 'create', sourceItemIds: ['a', 'b'], groupKey: 'renda:x', reason: '', confidence: 'media', payload: { label: 'X', amount: 500, dayOfMonth: 10, frequency: 'mensal', nature: 'rotina', confidence: 'media' } }] });
    const { deps, calls } = fakeDeps();
    const res = await runApplyPlan(plan, deps);
    expect(calls.createIncome.length).toBe(1);
    expect(calls.linkItems[0]).toMatchObject({ ids: ['a', 'b'], table: 'personal_income_sources', targetId: 'inc-new' });
    expect(res.applied).toBe(true);
    expect(calls.markBatchApplied).toBe(1);
  });

  it('reconcile: não cria, só vincula ao targetId existente', async () => {
    const plan = planWith({ incomeActions: [{ kind: 'income', op: 'reconcile', sourceItemIds: ['a'], groupKey: 'renda:x', reason: '', confidence: 'media', payload: null, targetId: 'inc-9' }] });
    const { deps, calls } = fakeDeps();
    await runApplyPlan(plan, deps);
    expect(calls.createIncome.length).toBe(0);
    expect(calls.linkItems[0]).toMatchObject({ ids: ['a'], targetId: 'inc-9' });
  });

  it('conta: grava applied_account_id no batch', async () => {
    const plan = planWith({ accountActions: [{ kind: 'account', op: 'create', sourceItemIds: [], groupKey: null, reason: '', confidence: 'alta', payload: { label: 'C', currentBalance: 100, balanceDate: '2026-07-31', confidence: 'alta' } }] });
    const { deps, calls } = fakeDeps();
    await runApplyPlan(plan, deps);
    expect(calls.setBatchAppliedAccount[0]).toMatchObject({ bid: 'b1', aid: 'acc-new' });
  });

  it('status applied só no FINAL: falha intermediária não marca applied', async () => {
    const plan = planWith({
      incomeActions: [{ kind: 'income', op: 'create', sourceItemIds: ['a'], groupKey: 'renda:x', reason: '', confidence: 'media', payload: { label: 'X', amount: 1, dayOfMonth: 1, frequency: 'mensal', nature: 'rotina', confidence: 'media' } }],
      fixedActions: [{ kind: 'fixed', op: 'create', sourceItemIds: ['b'], groupKey: 'fixa:y', reason: '', confidence: 'media', payload: { label: 'Y', amount: 1, dayOfMonth: 1, payMethod: 'debito', essential: false, confidence: 'media' } }],
    });
    const { deps, calls } = fakeDeps({ createFixed: async () => { throw new Error('boom'); } });
    await expect(runApplyPlan(plan, deps)).rejects.toThrow('boom');
    expect(calls.markBatchApplied).toBe(0);            // não marcou applied
    expect(calls.linkItems.some((l) => l.targetId === 'inc-new')).toBe(true); // income já vinculada
  });

  it('batch já applied → executor lança e não escreve', async () => {
    const { deps, calls } = fakeDeps();
    await expect(runApplyPlan(planWith({ batchStatus: 'applied' }), deps)).rejects.toThrow(/já aplicado/i);
    expect(calls.markBatchApplied).toBe(0);
  });

  it('batch discarded → executor lança e não escreve nada', async () => {
    const { deps, calls } = fakeDeps();
    const plan = planWith({ batchStatus: 'discarded', incomeActions: [{ kind: 'income', op: 'create', sourceItemIds: ['a'], groupKey: 'renda:x', reason: '', confidence: 'media', payload: { label: 'X', amount: 1, dayOfMonth: 1, frequency: 'mensal', nature: 'rotina', confidence: 'media' } }] });
    await expect(runApplyPlan(plan, deps)).rejects.toThrow(/descartado/i);
    expect(calls.markBatchApplied).toBe(0);
    expect(calls.createIncome.length).toBe(0);
  });

  it('plano bloqueado → não executa nada', async () => {
    const { deps, calls } = fakeDeps();
    const res = await runApplyPlan(planWith({ blocked: true, blockedReason: 'x' }), deps);
    expect(res.applied).toBe(false);
    expect(res.blocked).toBe(true);
    expect(calls.markBatchApplied).toBe(0);
    expect(calls.createIncome.length).toBe(0);
  });
});

// ===========================================================================
// Guardas de escopo
// ===========================================================================
describe('escopo AP4C.1c-1', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve('.', rel), 'utf8');

  it('applyPlan.ts e service não referenciam personal_transactions', () => {
    expect(read('src/domain/personal/import/applyPlan.ts')).not.toContain('personal_transactions');
    expect(read('src/services/personal/personalImportService.ts')).not.toContain('personal_transactions');
  });

  it('planner não importa o motor AP2 nem o adapter builder', () => {
    const src = read('src/domain/personal/import/applyPlan.ts');
    expect(src).not.toMatch(/buildPersonalMonth|personalMonth|buildPersonalInputs/);
  });

  it('nenhuma migration 0019 foi criada', () => {
    const migs = fs.readdirSync(path.resolve('.', 'supabase/migrations'));
    expect(migs.some((m) => /^0019/.test(m))).toBe(false);
  });
});
