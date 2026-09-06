import { describe, it, expect, vi } from 'vitest';
import { buildApplyPlan, runApplyPlan, ImportItemRow, ImportBatchRow, ApplyExecutorDeps, ApplyDecisions } from '@/domain/personal/import/applyPlan';
import { PersistedPersonalData } from '@/domain/personal/personalInputsAdapter';

// ---------------------------------------------------------------------------
// Fábricas
// ---------------------------------------------------------------------------
const item = (o: Partial<ImportItemRow>): ImportItemRow => ({
  id: 'i', group_key: null, inferred_kind: 'renda', inferred_category: null,
  raw_date: '2026-06-10', raw_amount: 500, raw_description: 'Salario', direction: 'entrada',
  user_decision: null, applied_to_id: null, applied_to_table: null, ...o,
});
const batch = (o: Partial<ImportBatchRow> = {}): ImportBatchRow => ({
  id: 'b1', workspace_id: 'ws1', status: 'review', account_scope: 'pessoal',
  detected_balance: null, balance_source: null, period_start: '2026-06-01', period_end: '2026-07-31',
  applied_account_id: null, summary_json: null, ...o,
});
const db = (o: Partial<PersistedPersonalData> = {}): PersistedPersonalData => ({
  accounts: [], incomeSources: [], cards: [], cardBills: [], fixedCommitments: [], installments: [],
  reimbursements: [], extraordinaryEvents: [], dailySpending: [], settings: undefined, ...o,
});
const incomeRow = (o: { id: string; label: string; amount: number; day: number }) => ({
  id: o.id, label: o.label, amount: o.amount, day_of_month: o.day, frequency: 'mensal' as const,
  nature: 'rotina' as const, variable: null, specific_date: null, confidence: 'media' as const,
});

function fakeDeps(over: Partial<ApplyExecutorDeps> = {}) {
  const calls = { createIncome: [] as unknown[], linkItems: [] as { ids: string[]; table: string; targetId: string }[], markBatchApplied: 0 };
  const deps: ApplyExecutorDeps = {
    createAccount: async () => ({ id: 'acc' }),
    updateAccount: async () => {},
    createIncome: async (p) => { calls.createIncome.push(p); return { id: 'inc-new' }; },
    createFixed: async () => ({ id: 'fix' }),
    upsertDaily: async () => {},
    upsertSettings: async () => {},
    linkItems: async (ids, table, targetId) => { calls.linkItems.push({ ids, table, targetId }); },
    setBatchAppliedAccount: async () => {},
    markBatchApplied: async () => { calls.markBatchApplied++; },
    ...over,
  };
  return { deps, calls };
}

const decisions: ApplyDecisions = { income: { 'renda:a': { confirmedIncome: true }, 'renda:b': { confirmedIncome: true } }, today: '2026-08-01' };

// ===========================================================================
// Cenário 1 — aplicação parcial: 1ª ação cria+linka, 2ª falha; reload + rebuild;
// 1ª vira skip; retry aplica só a 2ª; nada duplicado; applied só no final.
// ===========================================================================
describe('retry após aplicação parcial (create linkado + falha posterior)', () => {
  const items0 = [
    item({ id: 'r1', group_key: 'renda:a', raw_amount: 500, raw_date: '2026-06-10', raw_description: 'Salario' }),
    item({ id: 'r2', group_key: 'renda:a', raw_amount: 500, raw_date: '2026-07-10', raw_description: 'Salario' }),
    item({ id: 'r3', group_key: 'renda:b', raw_amount: 800, raw_date: '2026-06-05', raw_description: 'Bolsa' }),
    item({ id: 'r4', group_key: 'renda:b', raw_amount: 800, raw_date: '2026-07-05', raw_description: 'Bolsa' }),
  ];

  it('run inicial: 2 creates; 1ª linka, 2ª falha → não marca applied', async () => {
    const plan = buildApplyPlan({ batch: batch(), items: items0, decisions, existingPersonalData: db() });
    expect(plan.incomeActions.map((a) => a.op)).toEqual(['create', 'create']);

    let n = 0;
    const { deps, calls } = fakeDeps({ createIncome: async (p) => { n++; if (n === 1) return { id: 'inc-a' }; throw new Error('boom'); } });
    await expect(runApplyPlan(plan, deps)).rejects.toThrow('boom');
    expect(calls.markBatchApplied).toBe(0);
    expect(calls.linkItems.some((l) => l.targetId === 'inc-a')).toBe(true); // grupo a foi linkado
  });

  it('reload + rebuild: grupo a vira skip; retry aplica só o b; sem duplicar; applied no fim', async () => {
    // Estado do staging APÓS a falha: r1/r2 já vinculados; existingPersonalData tem inc-a.
    const itemsReload = [
      item({ id: 'r1', group_key: 'renda:a', raw_amount: 500, raw_date: '2026-06-10', raw_description: 'Salario', applied_to_id: 'inc-a', applied_to_table: 'personal_income_sources' }),
      item({ id: 'r2', group_key: 'renda:a', raw_amount: 500, raw_date: '2026-07-10', raw_description: 'Salario', applied_to_id: 'inc-a', applied_to_table: 'personal_income_sources' }),
      item({ id: 'r3', group_key: 'renda:b', raw_amount: 800, raw_date: '2026-06-05', raw_description: 'Bolsa' }),
      item({ id: 'r4', group_key: 'renda:b', raw_amount: 800, raw_date: '2026-07-05', raw_description: 'Bolsa' }),
    ];
    const dbReload = db({ incomeSources: [incomeRow({ id: 'inc-a', label: 'Salario', amount: 500, day: 10 })] });

    const rebuilt = buildApplyPlan({ batch: batch(), items: itemsReload, decisions, existingPersonalData: dbReload });
    const byKey = Object.fromEntries(rebuilt.incomeActions.map((a) => [a.groupKey, a]));
    expect(byKey['renda:a'].op).toBe('skip');   // já vinculado → não recria
    expect(byKey['renda:b'].op).toBe('create');

    const { deps, calls } = fakeDeps(); // createIncome → { id: 'inc-new' }
    const res = await runApplyPlan(rebuilt, deps);
    expect(calls.createIncome.length).toBe(1);   // só o grupo b
    expect(calls.linkItems.find((l) => l.targetId === 'inc-new')?.ids.sort()).toEqual(['r3', 'r4']);
    expect(res.applied).toBe(true);
    expect(calls.markBatchApplied).toBe(1);      // applied só no fim
  });
});

// ===========================================================================
// Cenário 2 — target criado, mas falha ANTES de gravar applied_to_id.
// Reload: existingPersonalData contém o target; itens não vinculados.
// Rebuild reconhece match forte único → reconcile/matched_existing; sem duplicar.
// ===========================================================================
describe('retry: target criado sem vínculo → reconcile matched_existing', () => {
  it('rebuild vira reconcile e o executor vincula sem criar duplicata', async () => {
    const itemsReload = [
      item({ id: 'r1', group_key: 'renda:a', raw_amount: 500, raw_date: '2026-06-10', raw_description: 'Salario' }),
      item({ id: 'r2', group_key: 'renda:a', raw_amount: 500, raw_date: '2026-07-10', raw_description: 'Salario' }),
    ];
    // Target foi criado antes da falha (está no personal data), mas os itens seguem sem applied_to_id.
    const dbReload = db({ incomeSources: [incomeRow({ id: 'inc-a', label: 'Salario', amount: 500, day: 10 })] });
    const d: ApplyDecisions = { income: { 'renda:a': { confirmedIncome: true } }, today: '2026-08-01' };

    const rebuilt = buildApplyPlan({ batch: batch(), items: itemsReload, decisions: d, existingPersonalData: dbReload });
    const a = rebuilt.incomeActions[0];
    expect(a.op).toBe('reconcile');
    expect(a.reconcileReason).toBe('matched_existing');
    expect(a.targetId).toBe('inc-a');

    const { deps, calls } = fakeDeps();
    const res = await runApplyPlan(rebuilt, deps);
    expect(calls.createIncome.length).toBe(0);   // NÃO cria duplicata
    expect(calls.linkItems[0]).toMatchObject({ ids: ['r1', 'r2'], table: 'personal_income_sources', targetId: 'inc-a' });
    expect(res.applied).toBe(true);
  });
});
