import { describe, it, expect } from 'vitest';
import { buildPersonalMonth } from '@/domain/personal/personalMonth';
import { buildOccurrences, resolveDaily } from '@/domain/personal/calendar';
import { PersonalInputs } from '@/domain/personal/types';
import { F1, F2, F3, F4, F5 } from './fixtures';

// Base vazia reutilizável para montar cenários mínimos e controlados.
const empty = (over: Partial<PersonalInputs> = {}): PersonalInputs => ({
  incomeSources: [], accounts: [], cards: [], cardBills: [],
  fixedCommitments: [], installments: [], reimbursements: [],
  extraordinaryEvents: [], dailySpending: [], ...over,
});

// ============================================================================
// T1 — Cartão sem dupla contagem
// ============================================================================
describe('T1 — cartão sem dupla contagem', () => {
  const inputs = empty({
    incomeSources: [{ id: 'S', label: 'Salário', amount: 10000, dayOfMonth: 5, frequency: 'mensal', nature: 'rotina', confidence: 'alta' }],
    accounts: [{ id: 'C', label: 'C', currentBalance: 5000, balanceDate: '2026-07-26', confidence: 'alta' }],
    cards: [{ id: 'CX', label: 'CX', closingDay: 28, dueDay: 10 }],
    cardBills: [{ id: 'b', cardId: 'CX', cycleStart: '2026-06-29', cycleEnd: '2026-07-28', dueDate: '2026-08-10', amount: 1000, status: 'fechada', items: [], confidence: 'alta' }],
    dailySpending: [{ monthISO: '2026-08', min: 2000, normal: 2000, heavy: 2000, profile: 'maioria_cartao', confidence: 'media' }],
  });
  const r = buildPersonalMonth(inputs, '2026-08', '2026-07-26');

  it('consumo do mês só na estrutural; fatura só no caixa; a soma dos dois nunca aparece', () => {
    // estrutural: 10000 − dia a dia cheio (2000) = 8000
    expect(r.sobraEstrutural.values.provavel).toBeCloseTo(8000, 2);
    // caixa: 10000 − fatura(1000) − dia a dia FORA do cartão (2000×0,2) = 8600
    expect(r.sobraCaixa.values.provavel).toBeCloseTo(8600, 2);
    // a "soma dos dois" (fatura + consumo cheio no mesmo número) = 7000 → NÃO existe
    const naiveBoth = 10000 - 1000 - 2000;
    for (const v of [r.sobraEstrutural.values.provavel, r.sobraCaixa.values.provavel, r.saldoProjetado.values.provavel]) {
      expect(v).not.toBeCloseTo(naiveBoth, 2);
    }
  });
});

// ============================================================================
// T2 — Fatura vencendo antes da renda → vale na trajetória, menorSaldo no dia certo
// ============================================================================
describe('T2 — fatura antes da renda', () => {
  const inputs = empty({
    incomeSources: [{ id: 'S', label: 'Salário', amount: 5000, dayOfMonth: 20, frequency: 'mensal', nature: 'rotina', confidence: 'alta' }],
    accounts: [{ id: 'C', label: 'C', currentBalance: 500, balanceDate: '2026-07-26', confidence: 'alta' }],
    cards: [{ id: 'CX', label: 'CX', closingDay: 28, dueDay: 10 }],
    cardBills: [{ id: 'b', cardId: 'CX', cycleStart: '2026-06-29', cycleEnd: '2026-07-28', dueDate: '2026-08-10', amount: 3000, status: 'fechada', items: [], confidence: 'alta' }],
    dailySpending: [],
  });
  const r = buildPersonalMonth(inputs, '2026-08', '2026-07-26');

  it('a trajetória mostra o vale e o menor saldo cai no dia da fatura', () => {
    expect(r.menorSaldo.value).toBeCloseTo(500 - 3000, 2); // −2500
    expect(r.menorSaldo.date).toBe('2026-08-10');
    expect(r.menorSaldo.valeStart).toBe('2026-08-10');
    expect(r.menorSaldo.valeEnd).toBe('2026-08-19'); // véspera do salário (dia 20)
  });
});

// ============================================================================
// T3 — Parcela futura aparece nos meses corretos e some ao quitar
// ============================================================================
describe('T3 — parcela futura', () => {
  const inputs = empty({
    installments: [{ id: 'P', groupLabel: 'Curso', monthlyAmount: 500, startMonth: '2026-08', endMonth: '2026-09', payMethod: 'pix', confidence: 'alta' }],
  });

  it('aparece em ago e set, some em out', () => {
    const ago = buildOccurrences(inputs, '2026-08', '2026-08').filter((o) => o.kind === 'parcela');
    const set = buildOccurrences(inputs, '2026-09', '2026-09').filter((o) => o.kind === 'parcela');
    const out = buildOccurrences(inputs, '2026-10', '2026-10').filter((o) => o.kind === 'parcela');
    expect(ago).toHaveLength(1);
    expect(set).toHaveLength(1);
    expect(out).toHaveLength(0); // quitou no endMonth
  });
});

// ============================================================================
// T4 — Reembolso atrasado (F4) reduz disponível e não é renda
// ============================================================================
describe('T4 — reembolso atrasado (F4)', () => {
  const r = buildPersonalMonth(F4, '2026-08', '2026-07-26');

  it('reduz o disponível prudente e não conta como renda', () => {
    const ded = r.disponivelPrudente.deducoes.find((d) => d.label === 'Reembolsos a receber');
    expect(ded?.amount).toBeCloseTo(2000, 2);
    expect(r.foraDaRotina.reembolsaveis).toHaveLength(1);
    // a parcela reembolsável NÃO reduz a estrutural (é neutra): 6000 − aluguel 1500 − dia a dia normal 1500 = 3000
    expect(r.sobraEstrutural.values.provavel).toBeCloseTo(3000, 2);
  });
});

// ============================================================================
// T5 — Extraordinário/patrimonial fora da rotina (F5)
// ============================================================================
describe('T5 — patrimonial fora da rotina (F5)', () => {
  const r = buildPersonalMonth(F5, '2026-08', '2026-07-26');

  // Contra-fatual: mesma entrada SEM o evento patrimonial.
  const semPat = buildPersonalMonth({ ...F5, extraordinaryEvents: [] }, '2026-08', '2026-07-26');

  it('não altera a estrutural, aparece segregado, e a destinação travada não vira disponível', () => {
    // estrutural = 5000 − aluguel 1800 − dia a dia normal 1400 = 1800 (patrimonial não entra)
    expect(r.sobraEstrutural.values.provavel).toBeCloseTo(1800, 2);
    expect(r.foraDaRotina.patrimoniais).toHaveLength(1);
    const ded = r.disponivelPrudente.deducoes.find((d) => d.label === 'Comprometido (destinação travada)');
    expect(ded?.amount).toBeCloseTo(80000, 2);
    // R6/R8: o patrimonial travado NÃO vira dinheiro livre — entra na projeção (o dinheiro
    // existe) e é integralmente deduzido. O disponível fica na mesma ordem de grandeza do
    // cenário sem o evento (a pequena diferença vem do aporte sugerido, cuja fórmula usa
    // sobraCaixa — que inclui o windfall; coupling previsto no §3.6/§3.7).
    expect(Math.abs(r.disponivelPrudente.value - semPat.disponivelPrudente.value)).toBeLessThan(100);
    expect(r.disponivelPrudente.value).toBeLessThan(5000);                     // nada perto dos 80k
    expect(r.disponivelPrudente.value).toBeLessThan(r.saldoProjetado.values.conservador);
  });
});

// ============================================================================
// T6 — Saldo negativo com estrutura positiva (F1)
// ============================================================================
describe('T6 — saldo negativo, estrutura positiva (F1)', () => {
  const r = buildPersonalMonth(F1, '2026-07', '2026-07-26');
  it('saldoAtual < 0 e sobraEstrutural > 0 coexistem', () => {
    expect(r.saldoAtual.value).toBeCloseTo(313 - 4606 + 9, 2); // −4284
    expect(r.saldoAtual.value).toBeLessThan(0);
    expect(r.sobraEstrutural.values.provavel).toBeGreaterThan(0);
  });
});

// ============================================================================
// T7 — Mês positivo com vale no meio → colchão reduz o disponível
// ============================================================================
describe('T7 — mês positivo com vale no meio', () => {
  const inputs = empty({
    incomeSources: [{ id: 'S', label: 'Salário', amount: 8000, dayOfMonth: 25, frequency: 'mensal', nature: 'rotina', confidence: 'alta' }],
    accounts: [{ id: 'C', label: 'C', currentBalance: 1000, balanceDate: '2026-07-26', confidence: 'alta' }],
    cards: [{ id: 'CX', label: 'CX', closingDay: 28, dueDay: 5 }],
    cardBills: [{ id: 'b', cardId: 'CX', cycleStart: '2026-06-29', cycleEnd: '2026-07-28', dueDate: '2026-08-05', amount: 4000, status: 'fechada', items: [], confidence: 'alta' }],
    fixedCommitments: [{ id: 'f', label: 'Aluguel', amount: 1000, dayOfMonth: 12, payMethod: 'boleto', essential: true, confidence: 'alta' }],
    dailySpending: [{ monthISO: '2026-08', min: 1000, normal: 2000, heavy: 2000, profile: 'meio_a_meio', confidence: 'media' }],
  });
  const r = buildPersonalMonth(inputs, '2026-08', '2026-07-26');

  it('estrutural>0, projetado>0, mas menorSaldo<0 e colchão desconta o disponível', () => {
    expect(r.sobraEstrutural.values.provavel).toBeGreaterThan(0);
    expect(r.saldoProjetado.values.provavel).toBeGreaterThan(0);
    expect(r.menorSaldo.value).toBeLessThan(0);
    expect(r.disponivelPrudente.deducoes.some((d) => d.label.startsWith('Colchão'))).toBe(true);
  });
});

// ============================================================================
// T8 — Propagação de confiança (F3, renda baixa)
// ============================================================================
describe('T8 — propagação de confiança (F3)', () => {
  const r = buildPersonalMonth(F3, '2026-08', '2026-07-26');
  it('número com entrada baixa sai baixa', () => {
    expect(r.sobraEstrutural.confidence).toBe('baixa');
    expect(r.saldoProjetado.confidence).toBe('baixa');
  });
});

// ============================================================================
// T9 — Determinismo
// ============================================================================
describe('T9 — determinismo', () => {
  it('mesma entrada + mesmo today → saída deep-equal', () => {
    const a = buildPersonalMonth(F1, '2026-07', '2026-07-26');
    const b = buildPersonalMonth(F1, '2026-07', '2026-07-26');
    expect(a).toEqual(b);
  });
});

// ============================================================================
// T10 — Mês corrente sem dupla contagem do passado (R9)
// ============================================================================
describe('T10 — R9: passado não é recontado', () => {
  const inputs = empty({
    incomeSources: [{ id: 'S', label: 'Salário', amount: 5000, dayOfMonth: 20, frequency: 'mensal', nature: 'rotina', confidence: 'alta' }],
    accounts: [{ id: 'C', label: 'C', currentBalance: 2000, balanceDate: '2026-07-26', confidence: 'alta' }],
    cards: [{ id: 'CX', label: 'CX', closingDay: 14, dueDay: 20 }],
    cardBills: [{ id: 'b', cardId: 'CX', cycleStart: '2026-06-15', cycleEnd: '2026-07-14', dueDate: '2026-07-20', amount: 3000, status: 'fechada', items: [], confidence: 'alta' }],
    dailySpending: [],
  });
  const r = buildPersonalMonth(inputs, '2026-07', '2026-07-26');

  it('salário e fatura do dia 20 não são somados ao saldo; ficam em jaOcorreuNoMes', () => {
    // saldo projetado = saldoAtual (2000), NÃO 2000 + 5000 − 3000 = 4000
    expect(r.saldoProjetado.values.provavel).toBeCloseTo(2000, 2);
    expect(r.saldoProjetado.values.provavel).not.toBeCloseTo(4000, 2);
    const labels = r.jaOcorreuNoMes.map((o) => o.label);
    expect(labels).toContain('Salário');
    expect(labels).toContain('Fatura CX');
  });

  it('a estrutural continua olhando o MÊS INTEIRO (competência)', () => {
    expect(r.sobraEstrutural.values.provavel).toBeCloseTo(5000, 2); // inclui o salário do dia 20
  });
});

// ============================================================================
// T11 — Compromisso pago no cartão não sai duas vezes (R10)
// ============================================================================
describe('T11 — R10: compromisso no cartão não sai 2×', () => {
  const inputs = empty({
    incomeSources: [{ id: 'S', label: 'Salário', amount: 6000, dayOfMonth: 5, frequency: 'mensal', nature: 'rotina', confidence: 'alta' }],
    accounts: [{ id: 'C', label: 'C', currentBalance: 3000, balanceDate: '2026-07-26', confidence: 'alta' }],
    cards: [{ id: 'CX', label: 'CX', closingDay: 28, dueDay: 10 }],
    fixedCommitments: [{ id: 'f', label: 'Streaming', amount: 500, dayOfMonth: 15, payMethod: 'cartao', cardId: 'CX', essential: false, confidence: 'alta' }],
    installments: [{ id: 'P', groupLabel: 'Celular', monthlyAmount: 800, startMonth: '2026-01', endMonth: '2026-12', cardId: 'CX', payMethod: 'cartao', confidence: 'alta' }],
    cardBills: [{ id: 'b', cardId: 'CX', cycleStart: '2026-07-01', cycleEnd: '2026-07-28', dueDate: '2026-08-10', amount: 1300, status: 'fechada', items: [], confidence: 'alta' }],
    dailySpending: [],
  });

  it('fixa/parcela no cartão não viram saída direta; só a fatura é evento de caixa', () => {
    const occ = buildOccurrences(inputs, '2026-08', '2026-08');
    expect(occ.filter((o) => o.kind === 'fixa')).toHaveLength(0);
    expect(occ.filter((o) => o.kind === 'parcela')).toHaveLength(0);
    const faturas = occ.filter((o) => o.kind === 'fatura');
    expect(faturas).toHaveLength(1);
    expect(faturas[0].amount).toBeCloseTo(-1300, 2);
  });

  it('a fatura (1300) entra no caixa uma vez; não há 500+800 adicionais', () => {
    const r = buildPersonalMonth(inputs, '2026-08', '2026-07-26');
    // caixa = 6000 − fatura 1300 = 4700 (sem dia a dia); NÃO 6000 − 1300 − 500 − 800
    expect(r.sobraCaixa.values.provavel).toBeCloseTo(4700, 2);
  });
});

// ============================================================================
// A1 — aporte sugerido não infla com windfall (base = sobra estrutural)
// ============================================================================
describe('A1 — aporte não infla com evento patrimonial/extraordinário', () => {
  it('entrada patrimonial grande (F5) NÃO aumenta o aporteSugeridoMes', () => {
    const withPat = buildPersonalMonth(F5, '2026-08', '2026-07-26');
    const noPat = buildPersonalMonth({ ...F5, extraordinaryEvents: [] }, '2026-08', '2026-07-26');
    expect(withPat.reserva.aporteSugeridoMes).toBeCloseTo(noPat.reserva.aporteSugeridoMes, 2);
  });

  it('windfall com destination=reserva vai para reservaAtual, não para o aporte', () => {
    const semEvento = buildPersonalMonth({ ...F5, extraordinaryEvents: [] }, '2026-08', '2026-07-26');
    const comReserva = buildPersonalMonth({
      ...F5,
      extraordinaryEvents: [{ id: 'X', label: 'Venda', amount: 90000, date: '2026-08-12', klass: 'patrimonial', destination: 'reserva', confidence: 'alta' }],
    }, '2026-08', '2026-07-26');
    expect(comReserva.reserva.atual).toBeGreaterThanOrEqual(90000);        // entrou na reserva
    expect(comReserva.reserva.aporteSugeridoMes).toBeLessThanOrEqual(semEvento.reserva.aporteSugeridoMes + 0.01); // não inflou
  });
});

// ============================================================================
// A2 — dailySpending de mês futuro ausente nunca vira zero
// ============================================================================
describe('A2 — dia a dia futuro herda, nunca zera silenciosamente', () => {
  const comAgo = empty({
    incomeSources: [{ id: 'S', label: 'Salário', amount: 5000, dayOfMonth: 5, frequency: 'mensal', nature: 'rotina', confidence: 'alta' }],
    accounts: [{ id: 'C', label: 'C', currentBalance: 3000, balanceDate: '2026-07-26', confidence: 'alta' }],
    dailySpending: [{ monthISO: '2026-08', min: 1000, normal: 2000, heavy: 3000, profile: 'meio_a_meio', confidence: 'alta' }],
  });

  it('mês futuro sem estimativa herda a última conhecida e rebaixa a confiança', () => {
    const r = resolveDaily(comAgo, '2026-10');
    expect(r).not.toBeNull();
    expect(r!.normal).toBe(2000);
    expect(r!.monthISO).toBe('2026-10');
    expect(r!.confidence).toBe('media'); // alta → media (herdada)
  });

  it('sem NENHUMA estimativa devolve null (não há o que herdar)', () => {
    expect(resolveDaily(empty(), '2026-10')).toBeNull();
  });

  it('projeção de mês futuro sem estimativa própria NÃO fica otimista (desconta o dia a dia herdado)', () => {
    const r = buildPersonalMonth(comAgo, '2026-10', '2026-07-26');
    // out não tem estimativa própria → herda ago (normal 2000): estrutural = 5000 − 2000 = 3000, não 5000
    expect(r.sobraEstrutural.values.provavel).toBeCloseTo(3000, 2);
    expect(r.sobraEstrutural.confidence).toBe('media'); // rebaixada por herança
  });
});
