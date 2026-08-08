import { describe, it, expect } from 'vitest';
import {
  buildPersonalInputs, PersistedPersonalData,
} from '@/domain/personal/personalInputsAdapter';
import { buildPersonalMonth } from '@/domain/personal/personalMonth';
import { F1 } from './fixtures';

const M = '2026-07';
const T = '2026-07-26';

// Inverte a fixture F1 (camelCase) para o formato PERSISTIDO (snake_case).
// É a forma mais forte de provar equivalência: os mesmos dados, só que "vindos do banco".
function persistFromF1(): PersistedPersonalData {
  return {
    accounts: F1.accounts.map((a) => ({ id: a.id, label: a.label, current_balance: a.currentBalance, balance_date: a.balanceDate, is_reserve: a.isReserve ?? false, confidence: a.confidence })),
    incomeSources: F1.incomeSources.map((i) => ({ id: i.id, label: i.label, amount: i.amount, day_of_month: i.dayOfMonth, frequency: i.frequency, nature: i.nature, variable: i.variable ?? false, specific_date: i.specificDate ?? null, confidence: i.confidence })),
    cards: F1.cards.map((c) => ({ id: c.id, label: c.label, closing_day: c.closingDay, due_day: c.dueDay, credit_limit: null })),
    cardBills: F1.cardBills.map((b) => ({ id: b.id, card_id: b.cardId, cycle_start: b.cycleStart, cycle_end: b.cycleEnd, due_date: b.dueDate, amount: b.amount, status: b.status, confidence: b.confidence })),
    fixedCommitments: F1.fixedCommitments.map((f) => ({ id: f.id, label: f.label, amount: f.amount, day_of_month: f.dayOfMonth, pay_method: f.payMethod, card_id: f.cardId ?? null, essential: f.essential, active_until: f.activeUntil ?? null, confidence: f.confidence })),
    installments: F1.installments.map((p) => ({ id: p.id, group_label: p.groupLabel, monthly_amount: p.monthlyAmount, start_month: p.startMonth, end_month: p.endMonth, card_id: p.cardId ?? null, pay_method: p.payMethod, reimbursable: p.reimbursable ?? false, confidence: p.confidence })),
    reimbursements: F1.reimbursements.map((r) => ({ id: r.id, who: r.who, amount: r.amount, expected_date: r.expectedDate, linked_to: r.linkedTo ?? null, status: r.status, confidence: r.confidence })),
    extraordinaryEvents: F1.extraordinaryEvents.map((e) => ({ id: e.id, label: e.label, amount: e.amount, event_date: e.date, klass: e.klass, destination: e.destination, confidence: e.confidence })),
    dailySpending: F1.dailySpending.map((d) => ({ month_iso: d.monthISO, min_amount: d.min, normal_amount: d.normal, heavy_amount: d.heavy, profile: d.profile, confidence: d.confidence })),
  };
}

const empty = (over: Partial<PersistedPersonalData> = {}): PersistedPersonalData => ({
  accounts: [], incomeSources: [], cards: [], cardBills: [], fixedCommitments: [],
  installments: [], reimbursements: [], extraordinaryEvents: [], dailySpending: [], ...over,
});

// ============================================================================
// E1 — Equivalência com F1 (CRÍTICO, tolerância ZERO)
// ============================================================================
describe('E1 — persistido equivalente à F1 → os 7 números idênticos', () => {
  const direto = buildPersonalMonth(F1, M, T);
  const viaAdapter = buildPersonalMonth(buildPersonalInputs(persistFromF1(), M, T).inputs, M, T);

  it('saldo atual', () => expect(viaAdapter.saldoAtual).toEqual(direto.saldoAtual));
  it('sobra estrutural', () => expect(viaAdapter.sobraEstrutural).toEqual(direto.sobraEstrutural));
  it('sobra de caixa', () => expect(viaAdapter.sobraCaixa).toEqual(direto.sobraCaixa));
  it('saldo projetado (faixa)', () => expect(viaAdapter.saldoProjetado).toEqual(direto.saldoProjetado));
  it('menor saldo', () => expect(viaAdapter.menorSaldo).toEqual(direto.menorSaldo));
  it('reserva recomendada', () => expect(viaAdapter.reserva).toEqual(direto.reserva));
  it('disponível prudente', () => expect(viaAdapter.disponivelPrudente).toEqual(direto.disponivelPrudente));
});

// ============================================================================
// A1 — Mapeamento direto
// ============================================================================
describe('A1 — mapeamento direto dos 8 arrays', () => {
  const data = empty({
    accounts: [{ id: 'a', label: 'Conta', current_balance: 1234.56, balance_date: '2026-07-01', is_reserve: true, confidence: 'alta' }],
    incomeSources: [{ id: 'i', label: 'Salário', amount: 5000, day_of_month: 5, frequency: 'mensal', nature: 'rotina', variable: false, specific_date: null, confidence: 'alta' }],
    reimbursements: [{ id: 'r', who: 'Fulano', amount: 300, expected_date: '2026-08-10', linked_to: null, status: 'previsto', confidence: 'media' }],
    extraordinaryEvents: [{ id: 'x', label: 'Bônus', amount: 2000, event_date: '2026-07-20', klass: 'extraordinario', destination: 'livre', confidence: 'media' }],
    dailySpending: [{ month_iso: '2026-07', min_amount: 1000, normal_amount: 1500, heavy_amount: 2000, profile: 'meio_a_meio', confidence: 'media' }],
  });
  const { inputs } = buildPersonalInputs(data, M, T);

  it('converte snake_case → camelCase sem perda', () => {
    expect(inputs.accounts[0]).toMatchObject({ currentBalance: 1234.56, balanceDate: '2026-07-01', isReserve: true });
    expect(inputs.incomeSources[0]).toMatchObject({ amount: 5000, dayOfMonth: 5, nature: 'rotina' });
    expect(inputs.reimbursements[0]).toMatchObject({ expectedDate: '2026-08-10', status: 'previsto' });
    expect(inputs.extraordinaryEvents[0]).toMatchObject({ date: '2026-07-20', klass: 'extraordinario' }); // event_date → date
    expect(inputs.dailySpending[0]).toMatchObject({ min: 1000, normal: 1500, heavy: 2000 }); // *_amount → min/normal/heavy
  });
});

// ============================================================================
// A2 — Fatura informada prevalece
// ============================================================================
describe('A2 — fatura informada prevalece (não gera estimada)', () => {
  const data = empty({
    cards: [{ id: 'CX', label: 'CX', closing_day: 28, due_day: 10, credit_limit: null }],
    installments: [{ id: 'p', group_label: 'TV', monthly_amount: 500, start_month: '2026-01', end_month: '2026-12', card_id: 'CX', pay_method: 'cartao', reimbursable: false, confidence: 'alta' }],
    cardBills: [{ id: 'inf', card_id: 'CX', cycle_start: '2026-06-29', cycle_end: '2026-07-28', due_date: '2026-08-10', amount: 999.99, status: 'fechada', confidence: 'alta' }],
  });
  const { inputs } = buildPersonalInputs(data, M, T);

  it('agosto usa a informada (999,99/fechada); não há estimada para agosto', () => {
    const agosto = inputs.cardBills.filter((b) => b.dueDate.startsWith('2026-08'));
    expect(agosto).toHaveLength(1);
    expect(agosto[0]).toMatchObject({ amount: 999.99, status: 'fechada', confidence: 'alta' });
  });
});

// ============================================================================
// A3 — Fatura estimada composta
// ============================================================================
describe('A3 — fatura estimada composta (parcelas + fixas no cartão + consumo)', () => {
  const data = empty({
    cards: [{ id: 'CX', label: 'CX', closing_day: 28, due_day: 10, credit_limit: null }],
    installments: [{ id: 'p', group_label: 'Celular', monthly_amount: 200, start_month: '2026-01', end_month: '2026-12', card_id: 'CX', pay_method: 'cartao', reimbursable: false, confidence: 'alta' }],
    fixedCommitments: [{ id: 'f', label: 'Streaming', amount: 50, day_of_month: 15, pay_method: 'cartao', card_id: 'CX', essential: false, active_until: null, confidence: 'alta' }],
    dailySpending: [{ month_iso: '2026-08', min_amount: 1000, normal_amount: 1000, heavy_amount: 1000, profile: 'maioria_cartao', confidence: 'alta' }],
  });
  const { inputs } = buildPersonalInputs(data, M, T);
  const agosto = inputs.cardBills.find((b) => b.dueDate === '2026-08-10' && b.status === 'estimada');

  it('compõe parcela + fixa + consumo, status estimada, confiança NUNCA alta', () => {
    expect(agosto).toBeDefined();
    // 200 (parcela) + 50 (fixa) + 1000×0,8 (consumo maioria_cartao) = 1050
    expect(agosto!.amount).toBeCloseTo(1050, 2);
    expect(agosto!.status).toBe('estimada');
    expect(agosto!.confidence).not.toBe('alta'); // rebaixada mesmo com itens 'alta'
    expect(agosto!.items.map((i) => i.kind).sort()).toEqual(['consumo', 'fixa', 'parcela']);
  });
});

// ============================================================================
// A4 — Sem dupla contagem (fixa/parcela no cartão só na fatura)
// ============================================================================
describe('A4 — anti-dupla-contagem: cartão só na fatura, nunca no caixa direto', () => {
  const data = empty({
    incomeSources: [{ id: 's', label: 'Salário', amount: 6000, day_of_month: 5, frequency: 'mensal', nature: 'rotina', variable: false, specific_date: null, confidence: 'alta' }],
    accounts: [{ id: 'c', label: 'C', current_balance: 3000, balance_date: '2026-07-26', is_reserve: false, confidence: 'alta' }],
    cards: [{ id: 'CX', label: 'CX', closing_day: 28, due_day: 10, credit_limit: null }],
    fixedCommitments: [{ id: 'f', label: 'Streaming', amount: 500, day_of_month: 15, pay_method: 'cartao', card_id: 'CX', essential: false, active_until: null, confidence: 'alta' }],
    installments: [{ id: 'p', group_label: 'Celular', monthly_amount: 800, start_month: '2026-01', end_month: '2026-12', card_id: 'CX', pay_method: 'cartao', reimbursable: false, confidence: 'alta' }],
  });
  const { inputs } = buildPersonalInputs(data, '2026-08', T); // mês futuro cheio para exercitar a fatura
  const r = buildPersonalMonth(inputs, '2026-08', T);

  it('a fatura de agosto carrega a fixa+parcela (1300); o caixa não desconta 500+800 de novo', () => {
    const agosto = inputs.cardBills.find((b) => b.dueDate === '2026-08-10');
    expect(agosto!.amount).toBeCloseTo(1300, 2); // 500 + 800 (sem daily neste caso)
    // sobra de caixa de agosto = 6000 − fatura 1300 = 4700 (a fixa/parcela NÃO saem direto)
    expect(r.sobraCaixa.values.provavel).toBeCloseTo(4700, 2);
  });
});

// ============================================================================
// A5 — Horizonte
// ============================================================================
describe('A5 — faturas compostas cobrem o horizonte e nada além', () => {
  const data = empty({
    cards: [{ id: 'CX', label: 'CX', closing_day: 28, due_day: 10, credit_limit: null }],
    installments: [{ id: 'p', group_label: 'Curso', monthly_amount: 300, start_month: '2026-01', end_month: '2026-12', card_id: 'CX', pay_method: 'cartao', reimbursable: false, confidence: 'alta' }],
  });
  // monthISO julho, horizonte 3 → jul/ago/set. Vencimento dia 10; jul-10 já passou (today 26/07).
  const { inputs } = buildPersonalInputs(data, M, T, 3);
  const estimadas = inputs.cardBills.filter((b) => b.status === 'estimada').map((b) => b.dueDate).sort();

  it('compõe agosto e setembro (julho já venceu); nenhuma em outubro', () => {
    expect(estimadas).toEqual(['2026-08-10', '2026-09-10']);
    expect(inputs.cardBills.some((b) => b.dueDate.startsWith('2026-10'))).toBe(false);
  });
});

// ============================================================================
// A6 — Dia a dia ausente
// ============================================================================
describe('A6 — dia a dia ausente não é inventado', () => {
  const { inputs, criticalAssumptions } = buildPersonalInputs(empty({
    incomeSources: [{ id: 's', label: 'Salário', amount: 5000, day_of_month: 5, frequency: 'mensal', nature: 'rotina', variable: false, specific_date: null, confidence: 'alta' }],
  }), M, T);

  it('emite premissa crítica acionável e NÃO cria dailySpending', () => {
    expect(inputs.dailySpending).toHaveLength(0); // nada inventado
    const p = criticalAssumptions.find((a) => a.id === 'assume-no-daily');
    expect(p).toBeDefined();
    expect(p!.confidence).toBe('baixa');
    expect(p!.actionToImprove).toMatch(/dia a dia/i);
  });
});

// ============================================================================
// A7 — Perfil de pagamento
// ============================================================================
describe('A7 — perfil de pagamento muda o consumo na fatura', () => {
  const base = (profile: 'maioria_cartao' | 'maioria_pix'): PersistedPersonalData => empty({
    cards: [{ id: 'CX', label: 'CX', closing_day: 28, due_day: 10, credit_limit: null }],
    dailySpending: [{ month_iso: '2026-08', min_amount: 1000, normal_amount: 1000, heavy_amount: 1000, profile, confidence: 'media' }],
  });
  const cartao = buildPersonalInputs(base('maioria_cartao'), M, T).inputs.cardBills.find((b) => b.dueDate === '2026-08-10');
  const pix = buildPersonalInputs(base('maioria_pix'), M, T).inputs.cardBills.find((b) => b.dueDate === '2026-08-10');

  it('maioria_cartao põe mais consumo na fatura que maioria_pix', () => {
    expect(cartao!.amount).toBeCloseTo(800, 2); // 1000 × 0,8
    expect(pix!.amount).toBeCloseTo(200, 2);    // 1000 × 0,2
    expect(cartao!.amount).toBeGreaterThan(pix!.amount);
  });
});

// ============================================================================
// A8 — Determinismo
// ============================================================================
describe('A8 — determinismo', () => {
  it('mesma entrada + mesmo today → deep-equal', () => {
    const p = persistFromF1();
    expect(buildPersonalInputs(p, M, T)).toEqual(buildPersonalInputs(p, M, T));
  });
});

// ============================================================================
// A9 — Dados vazios
// ============================================================================
describe('A9 — workspace vazio não quebra', () => {
  it('devolve PersonalInputs válido com arrays vazios e não lança', () => {
    const { inputs } = buildPersonalInputs(empty(), M, T);
    expect(inputs.accounts).toEqual([]);
    expect(inputs.cardBills).toEqual([]);
    expect(() => buildPersonalMonth(inputs, M, T)).not.toThrow();
    const r = buildPersonalMonth(inputs, M, T);
    expect(r.saldoAtual.value).toBe(0);
  });
});
