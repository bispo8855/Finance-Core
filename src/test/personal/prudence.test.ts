import { describe, it, expect } from 'vitest';
import { recommendedReserve } from '@/domain/personal/prudence';
import { resolveDaily } from '@/domain/personal/calendar';
import { PersonalInputs, DailySpendingEstimate, FixedCommitment } from '@/domain/personal/types';

const daily = (monthISO: string, min: number): DailySpendingEstimate =>
  ({ monthISO, min, normal: min + 100, heavy: min + 200, profile: 'desconhecido', confidence: 'media' });

const essentialFixed = (amount: number): FixedCommitment =>
  ({ id: 'f1', label: 'Aluguel', amount, dayOfMonth: 5, payMethod: 'debito', essential: true, confidence: 'alta' });

const inputs = (over: Partial<PersonalInputs> = {}): PersonalInputs => ({
  incomeSources: [], accounts: [], cards: [], cardBills: [], fixedCommitments: [], installments: [],
  reimbursements: [], extraordinaryEvents: [], dailySpending: [], ...over,
});

// custoEssencialMensal = essenciais + inadiaveis + diaMin.
// Com essenciais/inadiaveis zerados, custoEssencialMensal === diaMin resolvido.
const reserve = (i: PersonalInputs, monthISO: string) => recommendedReserve(i, monthISO, 0, 0);

describe('prudence — resolução de dailySpending (AP4C.1c-1.1)', () => {
  it('A. daily EXATO no mês → usa minAmount exato', () => {
    const i = inputs({ dailySpending: [daily('2026-06', 100)] });
    expect(reserve(i, '2026-06').custoEssencialMensal).toBe(100);
  });

  it('B. mês sem daily, mês anterior tem estimativa → HERDA (diaMin ≠ 0)', () => {
    const i = inputs({ dailySpending: [daily('2026-05', 80)] });
    const r = reserve(i, '2026-06');
    expect(r.custoEssencialMensal).toBe(80);
    expect(r.custoEssencialMensal).not.toBe(0);
  });

  it('C. múltiplas estimativas anteriores → usa a última aplicável', () => {
    const i = inputs({ dailySpending: [daily('2026-03', 50), daily('2026-05', 90)] });
    expect(reserve(i, '2026-06').custoEssencialMensal).toBe(90);
  });

  it('D. mês futuro sem estimativa própria → mesmo resolver do restante do motor', () => {
    const i = inputs({ dailySpending: [daily('2026-05', 70)] });
    const viaResolver = resolveDaily(i, '2026-09')!.min;
    expect(reserve(i, '2026-09').custoEssencialMensal).toBe(viaResolver);
    expect(viaResolver).toBe(70);
  });

  it('E. nenhum daily conhecido → não inventa média de mercado (0 explícito)', () => {
    const i = inputs({ dailySpending: [] });
    expect(reserve(i, '2026-06').custoEssencialMensal).toBe(0);
  });

  it('F. prova econômica: daily herdado aumenta a reserva vs. cenário incorreto diaMin=0', () => {
    const i = inputs({ fixedCommitments: [essentialFixed(1000)], dailySpending: [daily('2026-05', 200)] });
    const r = reserve(i, '2026-06'); // mês sem daily exato → herda 200
    // custoEssencial correto = 1000 + 200 = 1200 → piso = 3600.
    expect(r.custoEssencialMensal).toBe(1200);
    expect(r.piso).toBe(3600);
    // Cenário incorreto (bug diaMin=0) daria custoEssencial=1000 → piso=3000.
    const pisoBuggy = 3 * 1000;
    expect(r.piso).toBeGreaterThan(pisoBuggy);
  });

  it('confiança do daily herdado é rebaixada (mesma regra do resolver)', () => {
    const i = inputs({ dailySpending: [daily('2026-05', 80)] }); // confidence 'media'
    expect(resolveDaily(i, '2026-06')!.confidence).toBe('baixa'); // downgrade ao herdar
  });
});
