// ============================================================================
// Aurys Personal — validações PURAS do onboarding (AP4B.3a).
// Só valida FORMA e completude dos dados de entrada. NÃO calcula Sobra Real,
// saldo projetado, nem qualquer diagnóstico financeiro — isso é o motor AP2.
// Sem React, sem Supabase. Determinístico e testável.
// ============================================================================

import { Confidence, Nature, PayMethod, SpendProfile } from './types';

// --------------------------------------------------------------------------
// Resultado padrão de validação.
// --------------------------------------------------------------------------
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
function ok(warnings: string[] = []): ValidationResult {
  return { valid: true, errors: [], warnings };
}
function fail(errors: string[], warnings: string[] = []): ValidationResult {
  return { valid: errors.length === 0, errors, warnings };
}

// Conjuntos de valores válidos (espelham os CHECK da 0013 e os tipos do AP2).
const CONFIDENCES: Confidence[] = ['alta', 'media', 'baixa'];
const FREQUENCIES = ['mensal', 'avulsa'] as const;
const NATURES: Nature[] = ['rotina', 'extraordinario', 'patrimonial'];
const PAY_METHODS: PayMethod[] = ['debito', 'boleto', 'pix', 'cartao'];
const BILL_STATUSES = ['fechada', 'aberta', 'estimada'] as const;
const PROFILES: SpendProfile[] = ['maioria_cartao', 'meio_a_meio', 'maioria_pix', 'desconhecido'];

const LABEL_MAX = 80;

// --------------------------------------------------------------------------
// Helpers puros de validação de campo.
// --------------------------------------------------------------------------
function isNonEmpty(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}
function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}
function isDayOfMonth(n: unknown): boolean {
  return isFiniteNumber(n) && Number.isInteger(n) && n >= 1 && n <= 31;
}
/** YYYY-MM-DD com data-calendário real (rejeita 2026-02-30, 2026-13-01, etc.). */
export function isValidISODate(s: unknown): boolean {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  const daysInMonth = new Date(y, m, 0).getDate();
  return d >= 1 && d <= daysInMonth;
}

// --------------------------------------------------------------------------
// Tipos de entrada do onboarding (camelCase — o wizard futuro passa isto).
// --------------------------------------------------------------------------
export interface AccountInput {
  label: string;
  currentBalance: number;
  balanceDate: string;
  isReserve?: boolean;
  confidence: Confidence;
}
export interface IncomeInput {
  label: string;
  amount: number;
  dayOfMonth: number;
  frequency: 'mensal' | 'avulsa';
  nature: Nature;
  variable?: boolean;
  specificDate?: string;
  confidence: Confidence;
}
export interface CardInput {
  label: string;
  closingDay: number;
  dueDay: number;
  creditLimit?: number | null;
}
export interface BillInput {
  cardId?: string;
  amount: number;
  dueDate: string;
  status: 'fechada' | 'aberta' | 'estimada';
  cycleStart?: string;
  cycleEnd?: string;
  confidence: Confidence;
}
export interface FixedCommitmentInput {
  label: string;
  amount: number;
  dayOfMonth: number;
  payMethod: PayMethod;
  cardId?: string;
  essential?: boolean;
  confidence: Confidence;
}
export interface DailySpendingInput {
  minAmount: number;
  normalAmount: number;
  heavyAmount: number;
  profile: SpendProfile;
  confidence: Confidence;
}

// --------------------------------------------------------------------------
// Validações por bloco.
// --------------------------------------------------------------------------
export function validateAccount(a: AccountInput): ValidationResult {
  const errors: string[] = [];
  if (!isNonEmpty(a.label)) errors.push('Informe um nome para a conta.');
  else if (a.label.length > LABEL_MAX) errors.push(`O nome da conta deve ter até ${LABEL_MAX} caracteres.`);
  if (!isFiniteNumber(a.currentBalance)) errors.push('O saldo atual deve ser um número.'); // saldo negativo é permitido
  if (!isValidISODate(a.balanceDate)) errors.push('Informe a data do saldo no formato AAAA-MM-DD.');
  if (!CONFIDENCES.includes(a.confidence)) errors.push('Confiança inválida.');
  return fail(errors);
}

export function validateIncome(i: IncomeInput): ValidationResult {
  const errors: string[] = [];
  if (!isNonEmpty(i.label)) errors.push('Informe um nome para a renda.');
  else if (i.label.length > LABEL_MAX) errors.push(`O nome da renda deve ter até ${LABEL_MAX} caracteres.`);
  if (!isFiniteNumber(i.amount) || i.amount <= 0) errors.push('O valor da renda deve ser maior que zero.');
  if (!isDayOfMonth(i.dayOfMonth)) errors.push('O dia da renda deve estar entre 1 e 31.');
  if (!FREQUENCIES.includes(i.frequency)) errors.push('Frequência inválida.');
  if (!NATURES.includes(i.nature)) errors.push('Natureza inválida.');
  if (!CONFIDENCES.includes(i.confidence)) errors.push('Confiança inválida.');
  return fail(errors);
}

export function validateCard(c: CardInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isNonEmpty(c.label)) errors.push('Informe um nome para o cartão.');
  else if (c.label.length > LABEL_MAX) errors.push(`O nome do cartão deve ter até ${LABEL_MAX} caracteres.`);
  if (!isDayOfMonth(c.closingDay)) errors.push('O dia de fechamento deve estar entre 1 e 31.');
  if (!isDayOfMonth(c.dueDay)) errors.push('O dia de vencimento deve estar entre 1 e 31.');
  // closingDay == dueDay é incomum (fecha e vence no mesmo dia) → AVISO, não bloqueio.
  if (isDayOfMonth(c.closingDay) && isDayOfMonth(c.dueDay) && c.closingDay === c.dueDay) {
    warnings.push('O fechamento e o vencimento estão no mesmo dia — confirme se é isso mesmo.');
  }
  return fail(errors, warnings);
}

export function validateBill(b: BillInput): ValidationResult {
  const errors: string[] = [];
  if (!isFiniteNumber(b.amount) || b.amount <= 0) errors.push('O valor da fatura deve ser maior que zero.');
  if (!isValidISODate(b.dueDate)) errors.push('Informe o vencimento da fatura no formato AAAA-MM-DD.');
  if (!BILL_STATUSES.includes(b.status)) errors.push('Status da fatura inválido.');
  if (!CONFIDENCES.includes(b.confidence)) errors.push('Confiança inválida.');
  return fail(errors);
}

export function validateFixedCommitment(f: FixedCommitmentInput): ValidationResult {
  const errors: string[] = [];
  if (!isNonEmpty(f.label)) errors.push('Informe um nome para a conta fixa.');
  else if (f.label.length > LABEL_MAX) errors.push(`O nome da conta fixa deve ter até ${LABEL_MAX} caracteres.`);
  if (!isFiniteNumber(f.amount) || f.amount <= 0) errors.push('O valor da conta fixa deve ser maior que zero.');
  if (!isDayOfMonth(f.dayOfMonth)) errors.push('O dia da conta fixa deve estar entre 1 e 31.');
  if (!PAY_METHODS.includes(f.payMethod)) errors.push('Meio de pagamento inválido.');
  // Fixa no cartão precisa apontar para um cartão existente (R10: compõe a fatura, não sai do caixa).
  if (f.payMethod === 'cartao' && !isNonEmpty(f.cardId)) {
    errors.push('Conta fixa paga no cartão precisa indicar qual cartão.');
  }
  if (!CONFIDENCES.includes(f.confidence)) errors.push('Confiança inválida.');
  return fail(errors);
}

export function validateDailySpending(d: DailySpendingInput): ValidationResult {
  const errors: string[] = [];
  const nums = [d.minAmount, d.normalAmount, d.heavyAmount];
  if (!nums.every(isFiniteNumber)) {
    errors.push('Os valores do dia a dia devem ser números.');
  } else {
    if (nums.some((n) => n <= 0)) errors.push('Os valores do dia a dia devem ser maiores que zero.');
    if (!(d.minAmount <= d.normalAmount && d.normalAmount <= d.heavyAmount)) {
      errors.push('O dia a dia deve seguir mínimo ≤ normal ≤ pesado.');
    }
  }
  if (!PROFILES.includes(d.profile)) errors.push('Perfil de pagamento inválido.');
  if (!CONFIDENCES.includes(d.confidence)) errors.push('Confiança inválida.');
  return fail(errors);
}

// --------------------------------------------------------------------------
// Helpers de ENTRADA (transformam o que o usuário informou em formato do motor).
// NÃO são diagnóstico — só preparam o dado bruto.
// --------------------------------------------------------------------------
const WEEKS_PER_MONTH = 4.33;

/** Converte um gasto semanal informado em mensal (× 4,33). Arredonda a 2 casas. */
export function weeklyToMonthly(weekly: number): number {
  return Math.round(weekly * WEEKS_PER_MONTH * 100) / 100;
}

/**
 * "Um número só": o usuário informa um gasto típico e geramos a faixa ±25%,
 * com confiança BAIXA (é estimativa grosseira). min/normal/heavy a 2 casas.
 */
export function singleNumberToRange(value: number): {
  minAmount: number; normalAmount: number; heavyAmount: number; confidence: Confidence;
} {
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    minAmount: round(value * 0.75),
    normalAmount: round(value),
    heavyAmount: round(value * 1.25),
    confidence: 'baixa',
  };
}

// --------------------------------------------------------------------------
// Gate — a primeira leitura minimamente confiável (§ escopo AP4B.3a).
// --------------------------------------------------------------------------
export interface OnboardingSnapshot {
  accounts: AccountInput[];
  incomeSources: IncomeInput[];
  cards: CardInput[];
  cardBills: BillInput[];
  fixedCommitments: FixedCommitmentInput[];
  dailySpending: DailySpendingInput | null;
  declaredNoCards: boolean;
  declaredNoFixedCommitments: boolean;
}

export interface GateResult {
  ok: boolean;
  missing: string[]; // o que ainda falta para liberar a leitura
}

/**
 * Só true quando: ≥1 conta válida · ≥1 renda válida · dia a dia válido ·
 * (cartão+fatura válidos OU declaredNoCards) · (fixa válida OU declaredNoFixedCommitments).
 * NÃO calcula nenhum número financeiro — só confere completude.
 */
export function podeGerarLeituraConfiavel(data: OnboardingSnapshot): GateResult {
  const missing: string[] = [];

  if (!data.accounts.some((a) => validateAccount(a).valid)) {
    missing.push('conta');
  }
  if (!data.incomeSources.some((i) => validateIncome(i).valid)) {
    missing.push('renda');
  }
  if (!data.dailySpending || !validateDailySpending(data.dailySpending).valid) {
    missing.push('dia a dia');
  }

  // Cartão/fatura: liberado por declaração explícita OU por ao menos 1 cartão + 1 fatura válidos.
  if (!data.declaredNoCards) {
    const temCartao = data.cards.some((c) => validateCard(c).valid);
    const temFatura = data.cardBills.some((b) => validateBill(b).valid);
    if (!(temCartao && temFatura)) missing.push('cartão/fatura');
  }

  // Contas fixas: liberado por declaração explícita OU por ao menos 1 fixa válida.
  if (!data.declaredNoFixedCommitments) {
    if (!data.fixedCommitments.some((f) => validateFixedCommitment(f).valid)) {
      missing.push('contas fixas');
    }
  }

  return { ok: missing.length === 0, missing };
}
