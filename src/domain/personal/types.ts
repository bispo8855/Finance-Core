// ============================================================================
// Aurys Personal — AP2: contratos do motor puro (domínio isolado).
// Espelha a Etapa C1 do Business: nada consome isto ainda; fixtures antes da UI.
// Referência normativa: docs/ap1-desenho-tecnico-aurys-personal.md.
// NÃO reusa documents/titles/DRE do Business.
// ============================================================================

export type Confidence = 'alta' | 'media' | 'baixa';
export type Nature = 'rotina' | 'extraordinario' | 'patrimonial';
export type Destination = 'reserva' | 'intocavel' | 'giro' | 'quitacao' | 'livre';
export type PayMethod = 'debito' | 'boleto' | 'pix' | 'cartao';
export type Scenario = 'conservador' | 'provavel' | 'otimista';
export type SpendProfile = 'maioria_cartao' | 'meio_a_meio' | 'maioria_pix' | 'desconhecido';

// --------------------------------------------------------------------------
// Entidades de entrada
// --------------------------------------------------------------------------

export interface IncomeSource {
  id: string;
  label: string;
  amount: number;
  dayOfMonth: number;
  frequency: 'mensal' | 'avulsa';
  nature: Nature;
  variable?: boolean;
  specificDate?: string; // 'YYYY-MM-DD' — quando avulsa/datada
  confidence: Confidence;
}

export interface Account {
  id: string;
  label: string;
  currentBalance: number;
  balanceDate: string; // 'YYYY-MM-DD'
  isReserve?: boolean;
  confidence: Confidence;
}

export interface Card {
  id: string;
  label: string;
  closingDay: number;
  dueDay: number;
}

export interface CardBillItem {
  id: string;
  label: string;
  amount: number;
  kind: 'parcela' | 'fixa' | 'consumo';
  reimbursable?: boolean;
}

export interface CardBill {
  id: string;
  cardId: string;
  cycleStart: string; // 'YYYY-MM-DD'
  cycleEnd: string;   // 'YYYY-MM-DD'
  dueDate: string;    // 'YYYY-MM-DD'
  amount: number;
  status: 'fechada' | 'aberta' | 'estimada';
  items: CardBillItem[];
  confidence: Confidence;
}

export interface FixedCommitment {
  id: string;
  label: string;
  amount: number;
  dayOfMonth: number;
  payMethod: PayMethod;
  cardId?: string;
  essential: boolean;
  activeUntil?: string; // 'YYYY-MM' ou 'YYYY-MM-DD' — fim de vigência
  confidence: Confidence;
}

export interface Installment {
  id: string;
  groupLabel: string;
  monthlyAmount: number;
  startMonth: string; // 'YYYY-MM'
  endMonth: string;   // 'YYYY-MM'
  cardId?: string;
  payMethod: PayMethod;
  reimbursable?: boolean;
  confidence: Confidence;
}

export interface Reimbursement {
  id: string;
  who: string;
  amount: number;
  expectedDate: string; // 'YYYY-MM-DD'
  linkedTo?: string;    // installment/bill id
  status: 'previsto' | 'recebido' | 'atrasado';
  confidence: Confidence;
}

export interface ExtraordinaryEvent {
  id: string;
  label: string;
  amount: number;
  date: string; // 'YYYY-MM-DD'
  klass: 'extraordinario' | 'patrimonial';
  destination: Destination;
  confidence: Confidence;
}

export interface DailySpendingEstimate {
  monthISO: string; // 'YYYY-MM'
  min: number;
  normal: number;
  heavy: number;
  profile: SpendProfile;
  confidence: Confidence;
}

export interface Assumption {
  id: string;
  label: string;
  confidence: Confidence;
  origin: 'usuario' | 'extrato' | 'default';
  affects: string[];
  actionToImprove?: string;
}

export interface PersonalInputs {
  incomeSources: IncomeSource[];
  accounts: Account[];
  cards: Card[];
  cardBills: CardBill[];
  fixedCommitments: FixedCommitment[];
  installments: Installment[];
  reimbursements: Reimbursement[];
  extraordinaryEvents: ExtraordinaryEvent[];
  dailySpending: DailySpendingEstimate[];
  assumptions?: Assumption[];
}

// --------------------------------------------------------------------------
// Contrato de saída
// --------------------------------------------------------------------------

export interface ScenarioTriple {
  conservador: number;
  provavel: number;
  otimista: number;
}

export interface DayEvent {
  label: string;
  amount: number; // assinado: entrada > 0, saída < 0
  kind: string;   // 'renda' | 'fixa' | 'parcela' | 'fatura' | 'diario' | 'extraordinario' | 'patrimonial' | 'reembolso'
}

export interface DayPoint {
  date: string; // 'YYYY-MM-DD'
  balance: number;
  events: DayEvent[];
}

export interface WithConfidence<T> {
  value: T;
  confidence: Confidence;
}

export interface PersonalMonthResult {
  saldoAtual: { value: number; confidence: Confidence };
  sobraEstrutural: { values: ScenarioTriple; confidence: Confidence };
  sobraCaixa: { values: ScenarioTriple; confidence: Confidence };
  saldoProjetado: { values: ScenarioTriple; range: [number, number]; confidence: Confidence };
  menorSaldo: {
    value: number;
    date: string;
    valeStart?: string;
    valeEnd?: string;
    confidence: Confidence;
  };
  reserva: {
    custoEssencialMensal: number;
    piso: number;
    conforto: number;
    atual: number;
    aporteSugeridoMes: number;
  };
  disponivelPrudente: {
    value: number;
    confidence: Confidence;
    deducoes: { label: string; amount: number }[];
  };
  trajetoria: DayPoint[];
  foraDaRotina: {
    extraordinarios: ExtraordinaryEvent[];
    patrimoniais: ExtraordinaryEvent[];
    reembolsaveis: Reimbursement[];
  };
  jaOcorreuNoMes: { label: string; amount: number; date: string }[]; // R9 — contexto, nunca somado
  meta: { monthISO: string; asOfDate: string; isCurrentMonth: boolean; horizonMonths: 3 };
}
