import { describe, it, expect } from 'vitest';
import {
  initialReviewState, defaultIncomeChecked, defaultFixedChecked, isSingleOccurrence,
  validAccountChoice, needsScope, canApply, dailyCandidate, buildDecisions,
  planPreview, itemDecisionsFromPlan, incomeGroupKey, fixedGroupKey, ReviewState,
} from '@/domain/personal/import/reviewDecisions';
import { ImportSummary, InferredIncome, InferredFixed } from '@/domain/personal/import/personalImportInference';
import { buildApplyPlan, ImportItemRow, ImportBatchRow } from '@/domain/personal/import/applyPlan';
import { PersistedPersonalData } from '@/domain/personal/personalInputsAdapter';

const inc = (o: Partial<InferredIncome>): InferredIncome => ({ key: 'k', description: 'X', amount: 100, occurrences: 1, months: ['2026-06'], confidence: 'media', reason: '', ...o });
const fix = (o: Partial<InferredFixed>): InferredFixed => ({ key: 'k', description: 'X', amount: 100, occurrences: 1, months: ['2026-06'], dayOfMonth: 5, confidence: 'media', reason: '', ...o });

function sum(o: Partial<ImportSummary>): ImportSummary {
  return {
    period: { from: '', to: '', months: [], mesesParciais: [] },
    counts: { linhas: 0, rendas: 0, fixas: 0, transferenciasProprias: 0, pagamentosFatura: 0, variaveis: 0, ignorados: 0, duvidosos: 0 },
    saldo: { valor: null, fonte: null }, alertaContaMista: null,
    rendasProvaveis: [], fixasProvaveis: [], transferenciasProprias: [], pagamentosFatura: [],
    gastosVariaveis: { total: 0, byCategory: [] }, categoriasTop: [], ignorados: [], duvidosos: [],
    diaADia: { porMes: [], min: 0, normal: 0, heavy: 0, confidence: 'media', issues: [] }, itens: [],
    ...o,
  } as ImportSummary;
}

describe('defaults de seleção', () => {
  it('renda: ≥2 meses ou alta → marcada; única/média → desmarcada', () => {
    expect(defaultIncomeChecked(inc({ months: ['2026-06', '2026-07'] }))).toBe(true);
    expect(defaultIncomeChecked(inc({ months: ['2026-06'], confidence: 'alta' }))).toBe(true);
    expect(defaultIncomeChecked(inc({ months: ['2026-06'], confidence: 'media' }))).toBe(false);
  });
  it('isSingleOccurrence', () => {
    expect(isSingleOccurrence(inc({ months: ['2026-06'] }))).toBe(true);
    expect(isSingleOccurrence(inc({ months: ['2026-06', '2026-07'] }))).toBe(false);
  });
  it('fixa: alta marcada; média/baixa desmarcada', () => {
    expect(defaultFixedChecked(fix({ confidence: 'alta' }))).toBe(true);
    expect(defaultFixedChecked(fix({ confidence: 'media' }))).toBe(false);
    expect(defaultFixedChecked(fix({ confidence: 'baixa' }))).toBe(false);
  });
  it('initialReviewState: scope null quando conta mista; pessoal caso contrário', () => {
    expect(initialReviewState(sum({ alertaContaMista: 'PF/PJ' }), '2026-08-01').scope).toBeNull();
    expect(initialReviewState(sum({}), '2026-08-01').scope).toBe('pessoal');
  });
});

describe('validAccountChoice / needsScope', () => {
  it('valida alvo de conta', () => {
    expect(validAccountChoice(null)).toBe(false);
    expect(validAccountChoice({ mode: 'existing', accountId: '' })).toBe(false);
    expect(validAccountChoice({ mode: 'existing', accountId: 'a1' })).toBe(true);
    expect(validAccountChoice({ mode: 'new', label: '  ' })).toBe(false);
    expect(validAccountChoice({ mode: 'new', label: 'Nubank' })).toBe(true);
  });
  it('needsScope só com alerta de conta mista', () => {
    expect(needsScope(sum({ alertaContaMista: 'x' }))).toBe(true);
    expect(needsScope(sum({}))).toBe(false);
  });
});

const baseState = (o: Partial<ReviewState> = {}): ReviewState => ({ scope: 'pessoal', useBalance: false, accountChoice: null, income: {}, fixed: {}, dailyConfirmed: false, today: '2026-08-01', ...o });

describe('canApply (gate do botão)', () => {
  it('conta mista sem escopo → bloqueia', () => {
    const g = canApply(baseState({ scope: null }), sum({ alertaContaMista: 'x' }));
    expect(g.ok).toBe(false);
  });
  it('escopo negocio → bloqueia', () => {
    expect(canApply(baseState({ scope: 'negocio' }), sum({})).ok).toBe(false);
  });
  it('saldo marcado sem AccountTarget → bloqueia', () => {
    expect(canApply(baseState({ useBalance: true, accountChoice: null }), sum({})).ok).toBe(false);
    expect(canApply(baseState({ useBalance: true, accountChoice: { mode: 'new', label: 'Nu' } }), sum({})).ok).toBe(true);
  });
  it('pessoal sem saldo → ok', () => {
    expect(canApply(baseState({}), sum({})).ok).toBe(true);
  });
});

describe('dailyCandidate (gates)', () => {
  it('0 meses completos → não pode confirmar', () => {
    const d = dailyCandidate(sum({ diaADia: { porMes: [{ monthISO: '2026-06', total: 300, parcial: true }], min: 300, normal: 300, heavy: 300, confidence: 'media', issues: [] }, gastosVariaveis: { total: 300, byCategory: [{ category: 'Mercado', total: 300, count: 3 }] } }));
    expect(d.canConfirm).toBe(false);
    expect(d.reason).toMatch(/meses completos/);
  });
  it('Outros > 20% → não pode confirmar', () => {
    const d = dailyCandidate(sum({ diaADia: { porMes: [{ monthISO: '2026-06', total: 300, parcial: false }], min: 300, normal: 300, heavy: 300, confidence: 'media', issues: [] }, gastosVariaveis: { total: 100, byCategory: [{ category: 'Outros', total: 30, count: 3 }] } }));
    expect(d.canConfirm).toBe(false);
    expect(d.reason).toMatch(/Outros/);
  });
  it('≥1 mês completo e Outros ok → pode confirmar', () => {
    const d = dailyCandidate(sum({ diaADia: { porMes: [{ monthISO: '2026-06', total: 300, parcial: false }], min: 250, normal: 300, heavy: 350, confidence: 'media', issues: [] }, gastosVariaveis: { total: 300, byCategory: [{ category: 'Mercado', total: 300, count: 3 }] } }));
    expect(d.canConfirm).toBe(true);
  });
});

describe('buildDecisions — "é renda" ≠ "é recorrente"', () => {
  it('renda marcada sem responder recorrência → confirmedRecurring false', () => {
    const d = buildDecisions(baseState({ income: { 'renda:x': { checked: true } } }));
    expect(d.income!['renda:x']).toEqual({ confirmedIncome: true, confirmedRecurring: false });
  });
  it('renda marcada respondendo "Sim" → confirmedRecurring true', () => {
    const d = buildDecisions(baseState({ income: { 'renda:x': { checked: true, recurringAnswer: 'sim' } } }));
    expect(d.income!['renda:x'].confirmedRecurring).toBe(true);
  });
  it('renda desmarcada não entra nas decisões', () => {
    const d = buildDecisions(baseState({ income: { 'renda:x': { checked: false } } }));
    expect(d.income!['renda:x']).toBeUndefined();
  });
  it('fixa marcada → confirmed; daily reflete o toggle', () => {
    const d = buildDecisions(baseState({ fixed: { 'fixa:y': { checked: true } }, dailyConfirmed: true }));
    expect(d.fixed!['fixa:y']).toEqual({ confirmed: true });
    expect(d.daily).toEqual({ userConfirmedDailySpending: true });
  });
  it('saldo existing/new gera accountTarget correto', () => {
    expect(buildDecisions(baseState({ useBalance: true, accountChoice: { mode: 'existing', accountId: 'a1' } })).accountTarget).toEqual({ kind: 'existing', accountId: 'a1' });
    expect(buildDecisions(baseState({ useBalance: true, accountChoice: { mode: 'new', label: ' Nu ' } })).accountTarget).toEqual({ kind: 'new', label: 'Nu' });
  });
  it('sem useBalance → sem accountTarget', () => {
    expect(buildDecisions(baseState({ useBalance: false })).accountTarget).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Integração: preview usa buildApplyPlan; dedupe e onboarding refletidos.
// ---------------------------------------------------------------------------
const item = (o: Partial<ImportItemRow>): ImportItemRow => ({ id: 'i', group_key: null, inferred_kind: 'variavel', inferred_category: null, raw_date: '2026-06-10', raw_amount: 50, raw_description: 'x', direction: 'saida', user_decision: null, applied_to_id: null, applied_to_table: null, ...o });
const batch = (o: Partial<ImportBatchRow> = {}): ImportBatchRow => ({ id: 'b1', workspace_id: 'ws1', status: 'review', account_scope: 'pessoal', detected_balance: null, balance_source: null, period_start: '2026-06-01', period_end: '2026-07-31', applied_account_id: null, summary_json: null, ...o });
const emptyDb = (o: Partial<PersistedPersonalData> = {}): PersistedPersonalData => ({ accounts: [], incomeSources: [], cards: [], cardBills: [], fixedCommitments: [], installments: [], reimbursements: [], extraordinaryEvents: [], dailySpending: [], settings: undefined, ...o });

describe('planPreview (usa buildApplyPlan)', () => {
  it('conta os creates e sinaliza dedupe (reconcile)', () => {
    const items = [
      item({ id: 'r1', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:sal', raw_amount: 500, raw_date: '2026-06-10', raw_description: 'Salario' }),
      item({ id: 'r2', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:sal', raw_amount: 500, raw_date: '2026-07-10', raw_description: 'Salario' }),
      item({ id: 'f1', inferred_kind: 'fixa', group_key: 'fixa:net', inferred_category: 'Outros', raw_amount: 100, raw_date: '2026-06-01', raw_description: 'Internet' }),
      item({ id: 'f2', inferred_kind: 'fixa', group_key: 'fixa:net', inferred_category: 'Outros', raw_amount: 100, raw_date: '2026-07-01', raw_description: 'Internet' }),
    ];
    const decisions = buildDecisions(baseState({ income: { 'renda:sal': { checked: true } }, fixed: { 'fixa:net': { checked: true } } }));
    // renda sem match → create; fixa com match existente → reconcile (dedupe).
    const plan = buildApplyPlan({ batch: batch(), items, decisions, existingPersonalData: emptyDb({ fixedCommitments: [{ id: 'fx', label: 'Internet', amount: 100, day_of_month: 1, pay_method: 'debito', card_id: null, essential: true, active_until: null, confidence: 'media' }] }) });
    const pv = planPreview(plan);
    expect(pv.rendas).toBe(1);
    expect(pv.fixas).toBe(0);   // reconcile, não create
    expect(pv.dedupe).toBe(1);
    expect(pv.onboardingConfiavel).toBe(false); // sem daily/conta → incompleto
    expect(pv.onboardingMissing.length).toBeGreaterThan(0);
  });
});

describe('itemDecisionsFromPlan (auditoria por grupo)', () => {
  it('confirmado p/ create/reconcile; ignorado p/ skip; cobre todos os sourceItemIds', () => {
    const items = [
      item({ id: 'r1', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:sal', raw_amount: 500, raw_date: '2026-06-10' }),
      item({ id: 'r2', inferred_kind: 'renda', direction: 'entrada', group_key: 'renda:sal', raw_amount: 500, raw_date: '2026-07-10' }),
      item({ id: 'f1', inferred_kind: 'fixa', group_key: 'fixa:x', inferred_category: 'Moradia', raw_amount: 1000, raw_date: '2026-06-01' }),
    ];
    // renda confirmada (create); fixa NÃO confirmada (skip → ignorado).
    const decisions = buildDecisions(baseState({ income: { 'renda:sal': { checked: true } } }));
    const plan = buildApplyPlan({ batch: batch(), items, decisions, existingPersonalData: emptyDb() });
    const writes = itemDecisionsFromPlan(plan);
    expect(writes.filter((w) => w.userDecision === 'confirmado').map((w) => w.itemId).sort()).toEqual(['r1', 'r2']);
    expect(writes.filter((w) => w.userDecision === 'ignorado').map((w) => w.itemId)).toEqual(['f1']);
  });
});

describe('grupo key congelado', () => {
  it('incomeGroupKey/fixedGroupKey prefixam a chave do bloco', () => {
    expect(incomeGroupKey(inc({ key: 'salario acme' }))).toBe('renda:salario acme');
    expect(fixedGroupKey(fix({ key: 'aluguel' }))).toBe('fixa:aluguel');
  });
});
