// ============================================================================
// Aurys Personal — Adapter: dados PERSISTIDOS → PersonalInputs (AP4B.1).
// PURO: sem Supabase, sem React. Só transforma o formato do banco no contrato
// que o motor AP2 já consome. Não recalcula os 7 números — só monta a entrada.
//
// Núcleo da etapa: compor as FATURAS FUTURAS estimadas (§2.2), respeitando a
// regra anti-dupla-contagem R10 do motor (itens no cartão NÃO viram saída direta;
// o adapter apenas os AGRUPA na fatura — não os remove das listas nem cria saída
// própria; o motor cuida da exclusão do caixa direto).
// ============================================================================

import {
  PersonalInputs, Account, IncomeSource, Card, CardBill, CardBillItem,
  FixedCommitment, Installment, Reimbursement, ExtraordinaryEvent,
  DailySpendingEstimate, Assumption, Confidence,
} from './types';
import { worst } from './confidence';
import { addMonthsISO, monthOf, ymd, cycleDueInMonth } from './cardCycles';
import { paymentSplit } from './calendar';

// --------------------------------------------------------------------------
// Tipos PERSISTIDOS (espelham as colunas snake_case da migration 0013).
// --------------------------------------------------------------------------
export interface PersistedAccount {
  id: string; label: string; current_balance: number; balance_date?: string | null;
  is_reserve?: boolean | null; confidence: Confidence;
}
export interface PersistedIncomeSource {
  id: string; label: string; amount: number; day_of_month?: number | null;
  frequency: 'mensal' | 'avulsa'; nature: 'rotina' | 'extraordinario' | 'patrimonial';
  variable?: boolean | null; specific_date?: string | null; confidence: Confidence;
}
export interface PersistedCard {
  id: string; label: string; closing_day: number; due_day: number; credit_limit?: number | null;
}
export interface PersistedCardBill {
  id: string; card_id: string; cycle_start?: string | null; cycle_end?: string | null;
  due_date: string; amount: number; status: 'fechada' | 'aberta' | 'estimada'; confidence: Confidence;
}
export interface PersistedFixedCommitment {
  id: string; label: string; amount: number; day_of_month?: number | null;
  pay_method: 'debito' | 'boleto' | 'pix' | 'cartao'; card_id?: string | null;
  essential?: boolean | null; active_until?: string | null; confidence: Confidence;
}
export interface PersistedInstallment {
  id: string; group_label: string; monthly_amount: number; start_month: string; end_month: string;
  card_id?: string | null; pay_method: 'debito' | 'boleto' | 'pix' | 'cartao';
  reimbursable?: boolean | null; confidence: Confidence;
}
export interface PersistedReimbursement {
  id: string; who: string; amount: number; expected_date: string; linked_to?: string | null;
  status: 'previsto' | 'recebido' | 'atrasado'; confidence: Confidence;
}
export interface PersistedExtraordinaryEvent {
  id: string; label: string; amount: number; event_date: string;
  klass: 'extraordinario' | 'patrimonial';
  destination: 'reserva' | 'intocavel' | 'giro' | 'quitacao' | 'livre'; confidence: Confidence;
}
export interface PersistedDailySpending {
  id?: string; month_iso: string; min_amount: number; normal_amount: number; heavy_amount: number;
  profile: 'maioria_cartao' | 'meio_a_meio' | 'maioria_pix' | 'desconhecido'; confidence: Confidence;
}
export interface PersistedSettings {
  workspace_id?: string; onboarding_completed_at?: string | null; anchor_month?: string | null;
}

export interface PersistedPersonalData {
  accounts: PersistedAccount[];
  incomeSources: PersistedIncomeSource[];
  cards: PersistedCard[];
  cardBills: PersistedCardBill[];
  fixedCommitments: PersistedFixedCommitment[];
  installments: PersistedInstallment[];
  reimbursements: PersistedReimbursement[];
  extraordinaryEvents: PersistedExtraordinaryEvent[];
  dailySpending: PersistedDailySpending[];
  settings?: PersistedSettings;
}

export interface AdapterResult {
  inputs: PersonalInputs;
  criticalAssumptions: Assumption[];
}

// Rebaixa a confiança um nível (fatura estimada NUNCA é 'alta').
function downgrade(c: Confidence): Confidence {
  return c === 'alta' ? 'media' : 'baixa';
}
const money = (v: number): number => Math.round(v * 100) / 100;
const undef = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

// --------------------------------------------------------------------------
// Mapeamento direto (snake_case → camelCase). Zero lógica.
// --------------------------------------------------------------------------
function mapAccount(a: PersistedAccount): Account {
  return {
    id: a.id, label: a.label, currentBalance: a.current_balance,
    balanceDate: a.balance_date ?? '', isReserve: a.is_reserve ?? undefined, confidence: a.confidence,
  };
}
function mapIncome(i: PersistedIncomeSource): IncomeSource {
  return {
    id: i.id, label: i.label, amount: i.amount, dayOfMonth: i.day_of_month ?? 1,
    frequency: i.frequency, nature: i.nature, variable: i.variable ?? undefined,
    specificDate: undef(i.specific_date), confidence: i.confidence,
  };
}
function mapCard(c: PersistedCard): Card {
  return { id: c.id, label: c.label, closingDay: c.closing_day, dueDay: c.due_day };
}
function mapBill(b: PersistedCardBill): CardBill {
  return {
    id: b.id, cardId: b.card_id, cycleStart: b.cycle_start ?? '', cycleEnd: b.cycle_end ?? '',
    dueDate: b.due_date, amount: b.amount, status: b.status, items: [], confidence: b.confidence,
  };
}
function mapFixed(f: PersistedFixedCommitment): FixedCommitment {
  return {
    id: f.id, label: f.label, amount: f.amount, dayOfMonth: f.day_of_month ?? 1,
    payMethod: f.pay_method, cardId: undef(f.card_id), essential: f.essential ?? false,
    activeUntil: undef(f.active_until), confidence: f.confidence,
  };
}
function mapInstallment(p: PersistedInstallment): Installment {
  return {
    id: p.id, groupLabel: p.group_label, monthlyAmount: p.monthly_amount,
    startMonth: p.start_month, endMonth: p.end_month, cardId: undef(p.card_id),
    payMethod: p.pay_method, reimbursable: p.reimbursable ?? undefined, confidence: p.confidence,
  };
}
function mapReimbursement(r: PersistedReimbursement): Reimbursement {
  return {
    id: r.id, who: r.who, amount: r.amount, expectedDate: r.expected_date,
    linkedTo: undef(r.linked_to), status: r.status, confidence: r.confidence,
  };
}
function mapExtraordinary(e: PersistedExtraordinaryEvent): ExtraordinaryEvent {
  return {
    id: e.id, label: e.label, amount: e.amount, date: e.event_date,
    klass: e.klass, destination: e.destination, confidence: e.confidence,
  };
}
function mapDaily(d: PersistedDailySpending): DailySpendingEstimate {
  return {
    monthISO: d.month_iso, min: d.min_amount, normal: d.normal_amount, heavy: d.heavy_amount,
    profile: d.profile, confidence: d.confidence,
  };
}

// --------------------------------------------------------------------------
// Composição das faturas futuras (§2.2).
// --------------------------------------------------------------------------
function composeCardBills(
  cards: Card[],
  informed: CardBill[],
  installments: Installment[],
  fixed: FixedCommitment[],
  daily: DailySpendingEstimate[],
  monthISO: string,
  today: string,
  horizonMonths: number,
): CardBill[] {
  const bills: CardBill[] = [...informed]; // a fatura informada sempre prevalece
  const months: string[] = [];
  for (let k = 0; k < horizonMonths; k++) months.push(addMonthsISO(monthISO, k));

  const fixedActive = (f: FixedCommitment, m: string) => !f.activeUntil || m <= monthOf(f.activeUntil);

  for (const card of cards) {
    for (const m of months) {
      const dueDate = ymd(m, card.dueDay);
      // Fatura informada para este cartão neste mês de vencimento → prevalece, não compõe.
      const jaInformada = informed.some((b) => b.cardId === card.id && monthOf(b.dueDate) === m);
      if (jaInformada) continue;
      // Não estima fatura já vencida: o passado já está no saldo atual (coerente com R9).
      if (dueDate < today) continue;

      const parcelasCiclo = installments.filter(
        (p) => p.cardId === card.id && m >= p.startMonth && m <= p.endMonth,
      );
      const fixasCartao = fixed.filter((f) => f.payMethod === 'cartao' && f.cardId === card.id && fixedActive(f, m));
      const ds = daily.find((d) => d.monthISO === m);
      const consumo = ds ? money(ds.normal * paymentSplit(ds.profile).pctCartao) : 0;

      const somaItens = parcelasCiclo.reduce((s, p) => s + p.monthlyAmount, 0)
        + fixasCartao.reduce((s, f) => s + f.amount, 0);
      const amount = money(somaItens + consumo);
      if (amount <= 0) continue; // sem nada para faturar neste ciclo → não cria fatura vazia

      const items: CardBillItem[] = [
        ...parcelasCiclo.map((p): CardBillItem => ({
          id: `${card.id}-${m}-${p.id}`, label: p.groupLabel, amount: p.monthlyAmount,
          kind: 'parcela', reimbursable: p.reimbursable ?? undefined,
        })),
        ...fixasCartao.map((f): CardBillItem => ({
          id: `${card.id}-${m}-${f.id}`, label: f.label, amount: f.amount, kind: 'fixa',
        })),
      ];
      if (consumo > 0) {
        items.push({ id: `${card.id}-${m}-consumo`, label: 'Consumo estimado do ciclo', amount: consumo, kind: 'consumo' });
      }

      // Confiança: pior das confianças que compõem, sempre rebaixada (estimada nunca é 'alta').
      const piorItem = worst(...parcelasCiclo.map((p) => p.confidence), ...fixasCartao.map((f) => f.confidence), ds?.confidence);
      const cycle = cycleDueInMonth(card, m);
      bills.push({
        id: `est-${card.id}-${m}`,
        cardId: card.id,
        cycleStart: cycle.cycleStart,
        cycleEnd: cycle.cycleEnd,
        dueDate,
        amount,
        status: 'estimada',
        items,
        confidence: downgrade(piorItem),
      });
    }
  }
  return bills;
}

// --------------------------------------------------------------------------
// Premissas críticas (§2.3 / §2.4).
// --------------------------------------------------------------------------
function collectAssumptions(data: PersistedPersonalData): Assumption[] {
  const out: Assumption[] = [];

  // §2.3 — sem dia a dia: NÃO inventa; sinaliza premissa acionável.
  if (data.dailySpending.length === 0) {
    out.push({
      id: 'assume-no-daily',
      label: 'Gasto do dia a dia não informado.',
      confidence: 'baixa',
      origin: 'default',
      affects: ['sobraEstrutural', 'sobraCaixa', 'saldoProjetado', 'disponivelPrudente'],
      actionToImprove: 'Informe seu gasto do dia a dia — sem isso a projeção fica otimista.',
    });
  }

  // §2.4 — todo campo com confidence 'baixa' vira premissa acionável.
  const baixa: { tipo: string; id: string; label: string; affects: string[] }[] = [
    ...data.incomeSources.filter((x) => x.confidence === 'baixa').map((x) => ({ tipo: 'renda', id: x.id, label: x.label, affects: ['sobraEstrutural', 'sobraCaixa'] })),
    ...data.accounts.filter((x) => x.confidence === 'baixa').map((x) => ({ tipo: 'conta', id: x.id, label: x.label, affects: ['saldoAtual', 'saldoProjetado'] })),
    ...data.cardBills.filter((x) => x.confidence === 'baixa').map((x) => ({ tipo: 'fatura', id: x.id, label: `Fatura ${x.card_id}`, affects: ['sobraCaixa', 'saldoProjetado'] })),
    ...data.fixedCommitments.filter((x) => x.confidence === 'baixa').map((x) => ({ tipo: 'conta fixa', id: x.id, label: x.label, affects: ['sobraEstrutural', 'sobraCaixa'] })),
    ...data.installments.filter((x) => x.confidence === 'baixa').map((x) => ({ tipo: 'parcela', id: x.id, label: x.group_label, affects: ['sobraEstrutural'] })),
    ...data.reimbursements.filter((x) => x.confidence === 'baixa').map((x) => ({ tipo: 'reembolso', id: x.id, label: x.who, affects: ['disponivelPrudente'] })),
    ...data.extraordinaryEvents.filter((x) => x.confidence === 'baixa').map((x) => ({ tipo: 'evento', id: x.id, label: x.label, affects: ['saldoProjetado'] })),
    ...data.dailySpending.filter((x) => x.confidence === 'baixa').map((x) => ({ tipo: 'dia a dia', id: x.month_iso, label: `Dia a dia ${x.month_iso}`, affects: ['sobraEstrutural', 'sobraCaixa'] })),
  ];
  for (const b of baixa) {
    out.push({
      id: `assume-${b.tipo}-${b.id}`,
      label: `${b.label} (${b.tipo}) tem baixa confiança.`,
      confidence: 'baixa',
      origin: 'usuario',
      affects: b.affects,
      actionToImprove: 'Confirme data e valor para melhorar a projeção.',
    });
  }
  return out;
}

// --------------------------------------------------------------------------
// Entrada principal.
// --------------------------------------------------------------------------
export function buildPersonalInputs(
  data: PersistedPersonalData,
  monthISO: string,
  today: string,
  horizonMonths = 3,
): AdapterResult {
  const cards = data.cards.map(mapCard);
  const informedBills = data.cardBills.map(mapBill);
  const installments = data.installments.map(mapInstallment);
  const fixedCommitments = data.fixedCommitments.map(mapFixed);
  const dailySpending = data.dailySpending.map(mapDaily);

  const inputs: PersonalInputs = {
    accounts: data.accounts.map(mapAccount),
    incomeSources: data.incomeSources.map(mapIncome),
    cards,
    cardBills: composeCardBills(cards, informedBills, installments, fixedCommitments, dailySpending, monthISO, today, horizonMonths),
    fixedCommitments,
    installments,
    reimbursements: data.reimbursements.map(mapReimbursement),
    extraordinaryEvents: data.extraordinaryEvents.map(mapExtraordinary),
    dailySpending,
  };

  return { inputs, criticalAssumptions: collectAssumptions(data) };
}
