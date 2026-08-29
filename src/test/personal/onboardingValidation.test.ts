import { describe, it, expect } from 'vitest';
import {
  validateAccount, validateIncome, validateCard, validateBill,
  validateFixedCommitment, validateDailySpending,
  weeklyToMonthly, singleNumberToRange, isValidISODate,
  podeGerarLeituraConfiavel,
  AccountInput, IncomeInput, CardInput, BillInput, FixedCommitmentInput, DailySpendingInput,
  OnboardingSnapshot,
} from '@/domain/personal/onboardingValidation';

// ---------- fixtures válidas base ----------
const account = (over: Partial<AccountInput> = {}): AccountInput =>
  ({ label: 'Conta', currentBalance: 1000, balanceDate: '2026-08-16', confidence: 'alta', ...over });
const income = (over: Partial<IncomeInput> = {}): IncomeInput =>
  ({ label: 'Salário', amount: 9000, dayOfMonth: 5, frequency: 'mensal', nature: 'rotina', confidence: 'alta', ...over });
const card = (over: Partial<CardInput> = {}): CardInput =>
  ({ label: 'Cartão', closingDay: 14, dueDay: 20, ...over });
const bill = (over: Partial<BillInput> = {}): BillInput =>
  ({ cardId: 'c1', amount: 2000, dueDate: '2026-09-05', status: 'fechada', confidence: 'alta', ...over });
const fixed = (over: Partial<FixedCommitmentInput> = {}): FixedCommitmentInput =>
  ({ label: 'Aluguel', amount: 1330, dayOfMonth: 1, payMethod: 'boleto', confidence: 'alta', ...over });
const daily = (over: Partial<DailySpendingInput> = {}): DailySpendingInput =>
  ({ minAmount: 3750, normalAmount: 4750, heavyAmount: 6500, profile: 'maioria_cartao', confidence: 'media', ...over });

describe('validateAccount', () => {
  it('conta válida passa', () => expect(validateAccount(account()).valid).toBe(true));
  it('saldo NEGATIVO é permitido', () => expect(validateAccount(account({ currentBalance: -4606 })).valid).toBe(true));
  it('balanceDate é obrigatório e no formato AAAA-MM-DD', () => {
    expect(validateAccount(account({ balanceDate: '' })).valid).toBe(false);
    expect(validateAccount(account({ balanceDate: '16/08/2026' })).valid).toBe(false);
    expect(validateAccount(account({ balanceDate: '2026-02-30' })).valid).toBe(false); // data irreal
  });
  it('label até 80 caracteres', () => {
    expect(validateAccount(account({ label: 'x'.repeat(80) })).valid).toBe(true);
    expect(validateAccount(account({ label: 'x'.repeat(81) })).valid).toBe(false);
    expect(validateAccount(account({ label: '   ' })).valid).toBe(false);
  });
  it('confidence inválida falha', () => expect(validateAccount(account({ confidence: 'otima' as never })).valid).toBe(false));
});

describe('validateIncome', () => {
  it('renda válida passa', () => expect(validateIncome(income()).valid).toBe(true));
  it('amount deve ser > 0', () => {
    expect(validateIncome(income({ amount: 0 })).valid).toBe(false);
    expect(validateIncome(income({ amount: -1 })).valid).toBe(false);
  });
  it('dayOfMonth 1-31', () => {
    expect(validateIncome(income({ dayOfMonth: 0 })).valid).toBe(false);
    expect(validateIncome(income({ dayOfMonth: 32 })).valid).toBe(false);
    expect(validateIncome(income({ dayOfMonth: 31 })).valid).toBe(true);
  });
  it('frequency e nature válidas', () => {
    expect(validateIncome(income({ frequency: 'diaria' as never })).valid).toBe(false);
    expect(validateIncome(income({ nature: 'foo' as never })).valid).toBe(false);
  });
});

describe('validateCard', () => {
  it('cartão válido passa', () => expect(validateCard(card()).valid).toBe(true));
  it('closingDay = dueDay gera WARNING, não erro', () => {
    const r = validateCard(card({ closingDay: 10, dueDay: 10 }));
    expect(r.valid).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('dias fora de 1-31 são erro', () => {
    expect(validateCard(card({ closingDay: 0 })).valid).toBe(false);
    expect(validateCard(card({ dueDay: 32 })).valid).toBe(false);
  });
});

describe('validateBill', () => {
  it('fatura válida passa', () => expect(validateBill(bill()).valid).toBe(true));
  it('amount > 0 e dueDate válida e status válido', () => {
    expect(validateBill(bill({ amount: 0 })).valid).toBe(false);
    expect(validateBill(bill({ dueDate: '2026-13-01' })).valid).toBe(false);
    expect(validateBill(bill({ status: 'paga' as never })).valid).toBe(false);
  });
});

describe('validateFixedCommitment', () => {
  it('fixa válida passa', () => expect(validateFixedCommitment(fixed()).valid).toBe(true));
  it('payMethod=cartao EXIGE cardId', () => {
    expect(validateFixedCommitment(fixed({ payMethod: 'cartao' })).valid).toBe(false);
    expect(validateFixedCommitment(fixed({ payMethod: 'cartao', cardId: 'ca1' })).valid).toBe(true);
  });
  it('amount>0, day 1-31, payMethod válido', () => {
    expect(validateFixedCommitment(fixed({ amount: 0 })).valid).toBe(false);
    expect(validateFixedCommitment(fixed({ dayOfMonth: 40 })).valid).toBe(false);
    expect(validateFixedCommitment(fixed({ payMethod: 'cheque' as never })).valid).toBe(false);
  });
});

describe('validateDailySpending', () => {
  it('dia a dia válido passa', () => expect(validateDailySpending(daily()).valid).toBe(true));
  it('exige min <= normal <= heavy', () => {
    expect(validateDailySpending(daily({ minAmount: 5000 })).valid).toBe(false); // min > normal
    expect(validateDailySpending(daily({ heavyAmount: 100 })).valid).toBe(false); // heavy < normal
  });
  it('todos > 0', () => expect(validateDailySpending(daily({ minAmount: 0 })).valid).toBe(false));
  it('profile válido', () => expect(validateDailySpending(daily({ profile: 'so_pix' as never })).valid).toBe(false));
});

describe('helpers de entrada', () => {
  it('weeklyToMonthly usa × 4,33', () => {
    expect(weeklyToMonthly(100)).toBe(433);
    expect(weeklyToMonthly(250)).toBe(1082.5);
  });
  it('singleNumberToRange gera ±25% e confidence BAIXA', () => {
    expect(singleNumberToRange(1000)).toEqual({ minAmount: 750, normalAmount: 1000, heavyAmount: 1250, confidence: 'baixa' });
  });
  it('isValidISODate rejeita datas irreais', () => {
    expect(isValidISODate('2026-08-16')).toBe(true);
    expect(isValidISODate('2026-02-29')).toBe(false); // 2026 não é bissexto
    expect(isValidISODate('2024-02-29')).toBe(true);  // bissexto
    expect(isValidISODate('2026-8-1')).toBe(false);
  });
});

describe('podeGerarLeituraConfiavel — gate dos 5 blocos', () => {
  const base = (over: Partial<OnboardingSnapshot> = {}): OnboardingSnapshot => ({
    accounts: [account()],
    incomeSources: [income()],
    cards: [card()],
    cardBills: [bill()],
    fixedCommitments: [fixed()],
    dailySpending: daily(),
    declaredNoCards: false,
    declaredNoFixedCommitments: false,
    ...over,
  });

  it('snapshot completo e válido → ok', () => {
    expect(podeGerarLeituraConfiavel(base()).ok).toBe(true);
  });

  it('sem conta → falta "conta"', () => {
    const r = podeGerarLeituraConfiavel(base({ accounts: [] }));
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('conta');
  });

  it('sem renda → falta "renda"', () => {
    expect(podeGerarLeituraConfiavel(base({ incomeSources: [] })).missing).toContain('renda');
  });

  it('sem dia a dia → falta "dia a dia"', () => {
    expect(podeGerarLeituraConfiavel(base({ dailySpending: null })).missing).toContain('dia a dia');
  });

  it('sem cartão/fatura E sem declaração → falta "cartão/fatura"', () => {
    const r = podeGerarLeituraConfiavel(base({ cards: [], cardBills: [] }));
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('cartão/fatura');
  });

  it('declaredNoCards=true LIBERA cartão/fatura', () => {
    const r = podeGerarLeituraConfiavel(base({ cards: [], cardBills: [], declaredNoCards: true }));
    expect(r.missing).not.toContain('cartão/fatura');
    expect(r.ok).toBe(true);
  });

  it('sem fixa E sem declaração → falta "contas fixas"', () => {
    expect(podeGerarLeituraConfiavel(base({ fixedCommitments: [] })).missing).toContain('contas fixas');
  });

  it('declaredNoFixedCommitments=true LIBERA fixas', () => {
    const r = podeGerarLeituraConfiavel(base({ fixedCommitments: [], declaredNoFixedCommitments: true }));
    expect(r.missing).not.toContain('contas fixas');
    expect(r.ok).toBe(true);
  });

  it('cartão presente mas fatura ausente ainda bloqueia (exige os dois)', () => {
    expect(podeGerarLeituraConfiavel(base({ cardBills: [] })).missing).toContain('cartão/fatura');
  });
});
