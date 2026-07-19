import { describe, it, expect } from 'vitest';
import { calculateCashflow } from '@/domain/finance/cashflow';
import { Title, Movement, BankAccount, TitleStatus } from '@/types/financial';

// ============================================================================
// FC1 — Pendências vencidas no Fluxo de Caixa.
// Fronteira: vencido = status aberto ('previsto'|'atrasado') E dueDate < HOJE.
// A projeção (lines/totalEntradas/totalSaidas/saldoFinal/minBalance) é SÓ-FUTURO
// e não deve mudar por causa dos vencidos — os testes provam a disjunção.
// ============================================================================

const HOJE = '2026-07-19';

// Conta com saldo de abertura anterior a hoje → vira initialBalance direto.
const conta = (openingBalance: number): BankAccount => ({
  id: 'acc1',
  name: 'Conta Principal',
  type: 'banco',
  initialBalance: openingBalance,
  openingBalance,
  openingBalanceDate: '2026-01-01',
});

let seq = 0;
const titulo = (
  side: 'receber' | 'pagar',
  value: number,
  dueDate: string,
  status: TitleStatus = 'previsto'
): Title => ({
  id: `t${++seq}`,
  documentId: `d${seq}`,
  installment: 1,
  totalInstallments: 1,
  dueDate,
  value,
  status,
  side,
  contactId: 'c1',
  categoryId: 'cat1',
  description: `${side} ${value}`,
});

const run = (titles: Title[], movements: Movement[] = [], openingBalance = 2514.82) =>
  calculateCashflow({
    titles,
    movements,
    accounts: [conta(openingBalance)],
    startDateISO: HOJE,
    rangeDays: 60,
  });

// Fixture 3Am: caixa 2.514,82 · a receber vencido 260,36 · a pagar vencido 700,00
const FIXTURE_3AM: Title[] = [
  titulo('receber', 260.36, '2026-07-10'), // vencido
  titulo('pagar', 700.0, '2026-07-05', 'atrasado'), // vencido
];

describe('overdueReceber / overduePagar — só títulos ABERTOS com dueDate < hoje', () => {
  it('soma vencidos previsto e atrasado, separando por side', () => {
    const r = run([
      titulo('receber', 100, '2026-07-01'),
      titulo('receber', 160.36, '2026-07-18', 'atrasado'),
      titulo('pagar', 700, '2026-07-05', 'atrasado'),
    ]);
    expect(r.overdueReceber).toBeCloseTo(260.36, 2);
    expect(r.overduePagar).toBeCloseTo(700, 2);
    expect(r.hasOverdue).toBe(true);
  });

  it('IGNORA status liquidados/encerrados mesmo com dueDate < hoje', () => {
    const r = run([
      titulo('receber', 999, '2026-07-01', 'recebido'),
      titulo('pagar', 999, '2026-07-01', 'pago'),
      titulo('pagar', 999, '2026-07-01', 'cancelado'),
      titulo('receber', 999, '2026-07-01', 'renegociado'),
    ]);
    expect(r.overdueReceber).toBe(0);
    expect(r.overduePagar).toBe(0);
    expect(r.hasOverdue).toBe(false);
  });

  it('IGNORA títulos abertos com dueDate >= hoje (inclusive HOJE — hoje não é vencido)', () => {
    const r = run([
      titulo('receber', 500, HOJE),
      titulo('pagar', 300, HOJE),
      titulo('receber', 800, '2026-08-10'),
      titulo('pagar', 400, '2026-08-15'),
    ]);
    expect(r.overdueReceber).toBe(0);
    expect(r.overduePagar).toBe(0);
    expect(r.hasOverdue).toBe(false);
  });
});

describe('caixaAposPendencias e pisoConservador — fixture 3Am', () => {
  it('caixa 2.514,82 + receber venc 260,36 − pagar venc 700,00 = 2.075,18', () => {
    const r = run(FIXTURE_3AM);
    expect(r.initialBalance).toBeCloseTo(2514.82, 2);
    expect(r.caixaAposPendencias).toBeCloseTo(2075.18, 2);
  });

  it('pisoConservador ignora o a receber vencido: 2.514,82 − 700,00 = 1.814,82', () => {
    const r = run(FIXTURE_3AM);
    expect(r.pisoConservador).toBeCloseTo(1814.82, 2);
  });
});

describe('sem dupla contagem — vencido FORA da projeção', () => {
  it('vencido não entra em totalEntradas/totalSaidas nem move o saldo projetado', () => {
    const r = run(FIXTURE_3AM);
    expect(r.totalEntradas).toBe(0);
    expect(r.totalSaidas).toBe(0);
    expect(r.saldoFinal).toBeCloseTo(2514.82, 2);
    expect(r.minBalance).toBeCloseTo(2514.82, 2);
    // ...mas está capturado na lente de risco:
    expect(r.overdueReceber).toBeCloseTo(260.36, 2);
    expect(r.overduePagar).toBeCloseTo(700, 2);
  });

  it('previsto FUTURO entra só na projeção e fica fora de overdue*', () => {
    const r = run([
      titulo('receber', 1000, '2026-07-25'),
      titulo('pagar', 400, '2026-07-30'),
    ]);
    expect(r.totalEntradas).toBeCloseTo(1000, 2);
    expect(r.totalSaidas).toBeCloseTo(400, 2);
    expect(r.saldoFinal).toBeCloseTo(2514.82 + 600, 2);
    expect(r.overdueReceber).toBe(0);
    expect(r.overduePagar).toBe(0);
    expect(r.hasOverdue).toBe(false);
  });

  it('título LIQUIDADO (virou movimento, status pago) sai de overdue e entra como realizado', () => {
    // Mesmo título: antes vencido em aberto; depois pago hoje.
    const antes = run([titulo('pagar', 700, '2026-07-05', 'atrasado')]);
    expect(antes.overduePagar).toBeCloseTo(700, 2);
    expect(antes.totalSaidas).toBe(0);

    const liquidado = titulo('pagar', 700, '2026-07-05', 'pago');
    const mov: Movement = {
      id: 'm1',
      titleId: liquidado.id,
      accountId: 'acc1',
      paymentDate: HOJE,
      valuePaid: 700,
      type: 'saida',
    };
    const depois = run([liquidado], [mov]);
    expect(depois.overduePagar).toBe(0);
    expect(depois.hasOverdue).toBe(false);
    expect(depois.totalSaidas).toBeCloseTo(700, 2); // contado UMA vez, como realizado
    expect(depois.saldoFinal).toBeCloseTo(2514.82 - 700, 2);
  });
});

describe('riskState — pior caso entre projeção e piso conservador', () => {
  it('(a) projeção só-futuro positiva + vencido pequeno → saudavel, mas hasOverdue', () => {
    const r = run(FIXTURE_3AM);
    expect(r.riskState).toBe('saudavel');
    expect(r.hasOverdue).toBe(true);
    // o piso conservador segue acima de 50% do caixa inicial
    expect(r.pisoConservador).toBeGreaterThan(r.initialBalance * 0.5);
  });

  it('(b) pisoConservador < 0 → critico, mesmo com a projeção positiva', () => {
    const r = run([titulo('pagar', 3000, '2026-07-01', 'atrasado')]);
    expect(r.pisoConservador).toBeLessThan(0);
    expect(r.minBalance).toBeGreaterThan(0); // projeção sozinha não acusaria nada
    expect(r.riskState).toBe('critico');
  });

  it('(c) hasOverdue e pisoConservador < 50% do caixa inicial → atencao', () => {
    // 2.514,82 − 1.600 = 914,82 < 1.257,41
    const r = run([titulo('pagar', 1600, '2026-07-02', 'atrasado')]);
    expect(r.pisoConservador).toBeGreaterThan(0);
    expect(r.pisoConservador).toBeLessThan(r.initialBalance * 0.5);
    expect(r.riskState).toBe('atencao');
  });

  it('a receber vencido NUNCA melhora o risco (piso ignora receber)', () => {
    const semReceber = run([titulo('pagar', 1600, '2026-07-02', 'atrasado')]);
    const comReceber = run([
      titulo('pagar', 1600, '2026-07-02', 'atrasado'),
      titulo('receber', 5000, '2026-07-02', 'atrasado'),
    ]);
    expect(semReceber.riskState).toBe('atencao');
    expect(comReceber.riskState).toBe('atencao'); // não virou saudavel
    expect(comReceber.pisoConservador).toBeCloseTo(semReceber.pisoConservador, 2);
  });

  it('a regra dos 50% NÃO se aplica com initialBalance <= 0', () => {
    // caixa zero, sem vencidos e sem projeção: não há limiar com leitura → saudavel
    const r = run([], [], 0);
    expect(r.initialBalance).toBe(0);
    expect(r.minBalance).toBe(0);
    expect(r.riskState).toBe('saudavel');
  });
});

describe('não-regressão — sem vencidos, comportamento idêntico ao anterior', () => {
  it('campos novos zerados e projeção intacta', () => {
    const titles = [
      titulo('receber', 1200, '2026-07-25'),
      titulo('pagar', 500, '2026-08-05'),
      titulo('receber', 999, '2026-07-01', 'recebido'), // liquidado, não é vencido
    ];
    const r = run(titles);

    expect(r.hasOverdue).toBe(false);
    expect(r.overdueReceber).toBe(0);
    expect(r.overduePagar).toBe(0);
    // sem vencidos, as duas leituras colapsam no caixa atual
    expect(r.caixaAposPendencias).toBeCloseTo(r.initialBalance, 2);
    expect(r.pisoConservador).toBeCloseTo(r.initialBalance, 2);

    // projeção só-futuro exatamente como antes da FC1
    expect(r.totalEntradas).toBeCloseTo(1200, 2);
    expect(r.totalSaidas).toBeCloseTo(500, 2);
    expect(r.saldoFinal).toBeCloseTo(2514.82 + 700, 2);
    expect(r.minBalance).toBeCloseTo(2514.82, 2);
    expect(r.lines).toHaveLength(60);
    expect(r.riskState).toBe('saudavel');
  });

  it('sem vencidos, riskState continua governado só pela projeção', () => {
    // saldo projetado negativo → critico (regra pré-existente, inalterada)
    const negativo = run([titulo('pagar', 5000, '2026-07-25')]);
    expect(negativo.hasOverdue).toBe(false);
    expect(negativo.minBalance).toBeLessThan(0);
    expect(negativo.riskState).toBe('critico');

    // projeção consome mais de 50% do caixa → atencao (regra pré-existente)
    const consumo = run([titulo('pagar', 1600, '2026-07-25')]);
    expect(consumo.hasOverdue).toBe(false);
    expect(consumo.minBalance).toBeLessThan(consumo.initialBalance * 0.5);
    expect(consumo.riskState).toBe('atencao');
  });
});
