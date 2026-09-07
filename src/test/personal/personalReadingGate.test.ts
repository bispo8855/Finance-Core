import { describe, it, expect } from 'vitest';
import { readingIsReliable, hasKnownCommitments } from '@/domain/personal/personalReadingGate';
import { PersonalInputs } from '@/domain/personal/types';

const inputs = (o: Partial<PersonalInputs> = {}): PersonalInputs => ({
  incomeSources: [], accounts: [], cards: [], cardBills: [], fixedCommitments: [],
  installments: [], reimbursements: [], extraordinaryEvents: [], dailySpending: [], ...o,
});

const account = () => ({ id: 'a1', label: 'Conta', currentBalance: 65, balanceDate: '2026-09-01', confidence: 'alta' as const });
const income = () => ({ id: 'i1', label: 'CLT', amount: 22000, dayOfMonth: 5, frequency: 'mensal' as const, nature: 'rotina' as const, confidence: 'alta' as const });
const daily = () => ({ monthISO: '2026-08', min: 2000, normal: 2500, heavy: 3000, profile: 'desconhecido' as const, confidence: 'media' as const });

describe('readingIsReliable — reusa podeGerarLeituraConfiavel', () => {
  it('saldo + renda, mas sem dia a dia/fixas/cartão → NÃO confiável (o bug real)', () => {
    const g = readingIsReliable(inputs({ accounts: [account()], incomeSources: [income()] }), { declaredNoCards: false, declaredNoFixedCommitments: false });
    expect(g.ok).toBe(false);
    expect(g.missing).toEqual(expect.arrayContaining(['dia a dia', 'cartão/fatura', 'contas fixas']));
  });

  it('conta+renda+daily e cartão/fixa declarados como inexistentes → confiável', () => {
    const g = readingIsReliable(
      inputs({ accounts: [account()], incomeSources: [income()], dailySpending: [daily()] }),
      { declaredNoCards: true, declaredNoFixedCommitments: true },
    );
    expect(g.ok).toBe(true);
  });

  it('sem conta e sem renda → falta conta e renda', () => {
    const g = readingIsReliable(inputs({}), { declaredNoCards: true, declaredNoFixedCommitments: true });
    expect(g.missing).toEqual(expect.arrayContaining(['conta', 'renda', 'dia a dia']));
  });
});

describe('hasKnownCommitments', () => {
  it('true só quando há fixas/faturas/parcelas', () => {
    expect(hasKnownCommitments(inputs({}))).toBe(false);
    expect(hasKnownCommitments(inputs({ fixedCommitments: [{ id: 'f', label: 'Aluguel', amount: 1000, dayOfMonth: 5, payMethod: 'debito', essential: true, confidence: 'alta' }] }))).toBe(true);
  });
});
