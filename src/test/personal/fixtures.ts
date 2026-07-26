// ============================================================================
// Aurys Personal — fixtures F1..F5 (anonimizadas; valores do caso zero perturbados).
// F1 é a fixture-mãe: saldo consolidado NEGATIVO com estrutura POSITIVA,
// vale de calendário e fatura no mês seguinte ao consumo.
// ============================================================================

import { PersonalInputs } from '@/domain/personal/types';

// --------------------------------------------------------------------------
// F1 — Caso real anonimizado. today='2026-07-26', monthISO='2026-07'.
// --------------------------------------------------------------------------
export const F1: PersonalInputs = {
  incomeSources: [
    { id: 'R1', label: 'Renda principal', amount: 9000, dayOfMonth: 5, frequency: 'mensal', nature: 'rotina', confidence: 'alta' },
    { id: 'R2', label: 'Renda secundária', amount: 5400, dayOfMonth: 20, frequency: 'mensal', nature: 'rotina', confidence: 'alta' },
    { id: 'AL1', label: 'Aluguel recebido A', amount: 2300, dayOfMonth: 1, frequency: 'mensal', nature: 'rotina', confidence: 'alta' },
    { id: 'AL2', label: 'Aluguel recebido B', amount: 850, dayOfMonth: 1, frequency: 'mensal', nature: 'rotina', confidence: 'alta' },
  ],
  accounts: [
    { id: 'C1', label: 'Conta 1', currentBalance: 313, balanceDate: '2026-07-26', confidence: 'alta' },
    { id: 'C2', label: 'Conta 2', currentBalance: -4606, balanceDate: '2026-07-26', confidence: 'alta' },
    { id: 'C3', label: 'Conta 3', currentBalance: 9, balanceDate: '2026-07-26', confidence: 'alta' },
  ],
  cards: [
    { id: 'CA', label: 'Cartão A', closingDay: 14, dueDay: 20 },
    { id: 'CB', label: 'Cartão B', closingDay: 29, dueDay: 5 },
  ],
  cardBills: [
    {
      id: 'CB-ago', cardId: 'CB', cycleStart: '2026-06-30', cycleEnd: '2026-07-29', dueDate: '2026-08-05',
      amount: 2689.40, status: 'fechada', confidence: 'alta',
      items: [
        { id: 'i-comp', label: 'Computador (parcela)', amount: 1774.67, kind: 'parcela', reimbursable: true },
        { id: 'i-tv', label: 'TV (parcela)', amount: 194.79, kind: 'parcela', reimbursable: true },
        { id: 'i-consumoB', label: 'Consumo do ciclo', amount: 719.94, kind: 'consumo' },
      ],
    },
    {
      id: 'CA-ago', cardId: 'CA', cycleStart: '2026-07-15', cycleEnd: '2026-08-14', dueDate: '2026-08-20',
      amount: 5208, status: 'estimada', confidence: 'media',
      items: [
        { id: 'i-tab', label: 'Tablet (parcela)', amount: 583.33, kind: 'parcela' },
        { id: 'i-ens', label: 'Ensaio (parcela)', amount: 150, kind: 'parcela' },
        { id: 'i-consumoA', label: 'Consumo estimado do ciclo', amount: 4474.67, kind: 'consumo' },
      ],
    },
  ],
  fixedCommitments: [
    { id: 'F-alug', label: 'Aluguel', amount: 1330, dayOfMonth: 1, payMethod: 'boleto', essential: true, confidence: 'alta' },
    { id: 'F-cond', label: 'Condomínio', amount: 820, dayOfMonth: 15, payMethod: 'boleto', essential: true, confidence: 'alta' },
    { id: 'F-net', label: 'Internet', amount: 112, dayOfMonth: 8, payMethod: 'boleto', essential: true, confidence: 'alta' },
    { id: 'F-prest', label: 'Prestação', amount: 2310, dayOfMonth: 16, payMethod: 'boleto', essential: true, confidence: 'alta' },
    { id: 'F-cons', label: 'Consórcio', amount: 288, dayOfMonth: 16, payMethod: 'boleto', essential: false, confidence: 'alta' },
    { id: 'F-imp', label: 'Imposto', amount: 143, dayOfMonth: 21, payMethod: 'boleto', essential: false, confidence: 'alta' },
    { id: 'F-trib', label: 'Tributo', amount: 168, dayOfMonth: 20, payMethod: 'boleto', essential: false, confidence: 'alta' },
  ],
  installments: [
    { id: 'P-tab', groupLabel: 'Tablet', monthlyAmount: 583.33, startMonth: '2026-01', endMonth: '2026-12', cardId: 'CA', payMethod: 'cartao', confidence: 'alta' },
    { id: 'P-ens', groupLabel: 'Ensaio', monthlyAmount: 150, startMonth: '2026-01', endMonth: '2026-12', cardId: 'CA', payMethod: 'cartao', confidence: 'alta' },
    { id: 'P-comp', groupLabel: 'Computador', monthlyAmount: 1774.67, startMonth: '2026-01', endMonth: '2026-12', cardId: 'CB', payMethod: 'cartao', reimbursable: true, confidence: 'alta' },
    { id: 'P-tv', groupLabel: 'TV', monthlyAmount: 194.79, startMonth: '2026-01', endMonth: '2026-12', cardId: 'CB', payMethod: 'cartao', reimbursable: true, confidence: 'alta' },
  ],
  reimbursements: [
    { id: 'RB-comp', who: 'Terceiro (computador)', amount: 1774.67, expectedDate: '2026-08-06', linkedTo: 'P-comp', status: 'previsto', confidence: 'media' },
    { id: 'RB-tv', who: 'Terceiro (TV)', amount: 194.79, expectedDate: '2026-08-05', linkedTo: 'P-tv', status: 'previsto', confidence: 'media' },
  ],
  extraordinaryEvents: [
    { id: 'X-rest', label: 'Restituição', amount: 1800, date: '2026-07-31', klass: 'extraordinario', destination: 'livre', confidence: 'media' },
    { id: 'X-venda-int', label: 'Venda de imóvel (intocável)', amount: 15000, date: '2026-08-05', klass: 'patrimonial', destination: 'intocavel', confidence: 'media' },
    { id: 'X-venda-res', label: 'Venda de imóvel (reserva)', amount: 30000, date: '2026-08-05', klass: 'patrimonial', destination: 'reserva', confidence: 'media' },
    { id: 'X-venda-giro', label: 'Venda de imóvel (giro)', amount: 5000, date: '2026-08-05', klass: 'patrimonial', destination: 'giro', confidence: 'media' },
  ],
  dailySpending: [
    { monthISO: '2026-07', min: 3750, normal: 4750, heavy: 6500, profile: 'maioria_cartao', confidence: 'media' },
  ],
};

// --------------------------------------------------------------------------
// F2 — caso simples: 1 renda, 1 cartão, 3 fixas. today='2026-07-26', mês futuro '2026-08'.
// --------------------------------------------------------------------------
export const F2: PersonalInputs = {
  incomeSources: [
    { id: 'S', label: 'Salário', amount: 8000, dayOfMonth: 5, frequency: 'mensal', nature: 'rotina', confidence: 'alta' },
  ],
  accounts: [{ id: 'C', label: 'Conta', currentBalance: 5000, balanceDate: '2026-07-26', confidence: 'alta' }],
  cards: [{ id: 'CX', label: 'Cartão', closingDay: 28, dueDay: 8 }],
  cardBills: [
    { id: 'CX-ago', cardId: 'CX', cycleStart: '2026-06-29', cycleEnd: '2026-07-28', dueDate: '2026-08-08', amount: 1500, status: 'fechada', items: [], confidence: 'alta' },
  ],
  fixedCommitments: [
    { id: 'f-alug', label: 'Aluguel', amount: 2000, dayOfMonth: 10, payMethod: 'boleto', essential: true, confidence: 'alta' },
    { id: 'f-luz', label: 'Luz', amount: 200, dayOfMonth: 15, payMethod: 'boleto', essential: true, confidence: 'alta' },
    { id: 'f-net', label: 'Internet', amount: 100, dayOfMonth: 20, payMethod: 'boleto', essential: true, confidence: 'alta' },
  ],
  installments: [],
  reimbursements: [],
  extraordinaryEvents: [],
  dailySpending: [{ monthISO: '2026-08', min: 1500, normal: 2000, heavy: 2800, profile: 'meio_a_meio', confidence: 'media' }],
};

// --------------------------------------------------------------------------
// F3 — renda variável: 3 entradas irregulares, confiança baixa → faixa larga. Mês '2026-08'.
// --------------------------------------------------------------------------
export const F3: PersonalInputs = {
  incomeSources: [
    { id: 'V1', label: 'Freela 1', amount: 3000, dayOfMonth: 7, frequency: 'avulsa', specificDate: '2026-08-07', nature: 'rotina', variable: true, confidence: 'baixa' },
    { id: 'V2', label: 'Freela 2', amount: 1500, dayOfMonth: 15, frequency: 'avulsa', specificDate: '2026-08-15', nature: 'rotina', variable: true, confidence: 'baixa' },
    { id: 'V3', label: 'Freela 3', amount: 2200, dayOfMonth: 24, frequency: 'avulsa', specificDate: '2026-08-24', nature: 'rotina', variable: true, confidence: 'baixa' },
  ],
  accounts: [{ id: 'C', label: 'Conta', currentBalance: 2000, balanceDate: '2026-07-26', confidence: 'alta' }],
  cards: [],
  cardBills: [],
  fixedCommitments: [
    { id: 'f-alug', label: 'Aluguel', amount: 2500, dayOfMonth: 10, payMethod: 'boleto', essential: true, confidence: 'alta' },
  ],
  installments: [],
  reimbursements: [],
  extraordinaryEvents: [],
  dailySpending: [{ monthISO: '2026-08', min: 1200, normal: 1800, heavy: 2600, profile: 'meio_a_meio', confidence: 'baixa' }],
};

// --------------------------------------------------------------------------
// F4 — reembolsável com retorno APÓS o vencimento da fatura que o financiou. Mês '2026-08'.
// --------------------------------------------------------------------------
export const F4: PersonalInputs = {
  incomeSources: [
    { id: 'S', label: 'Salário', amount: 6000, dayOfMonth: 5, frequency: 'mensal', nature: 'rotina', confidence: 'alta' },
  ],
  accounts: [{ id: 'C', label: 'Conta', currentBalance: 3000, balanceDate: '2026-07-26', confidence: 'alta' }],
  cards: [{ id: 'CX', label: 'Cartão', closingDay: 28, dueDay: 10 }],
  cardBills: [
    { id: 'CX-ago', cardId: 'CX', cycleStart: '2026-06-29', cycleEnd: '2026-07-28', dueDate: '2026-08-10', amount: 2200, status: 'fechada', confidence: 'alta',
      items: [{ id: 'i-comp', label: 'Computador (parcela)', amount: 2000, kind: 'parcela', reimbursable: true }, { id: 'i-cons', label: 'Consumo', amount: 200, kind: 'consumo' }] },
  ],
  fixedCommitments: [
    { id: 'f-alug', label: 'Aluguel', amount: 1500, dayOfMonth: 10, payMethod: 'boleto', essential: true, confidence: 'alta' },
  ],
  installments: [
    { id: 'P-comp', groupLabel: 'Computador (terceiro)', monthlyAmount: 2000, startMonth: '2026-07', endMonth: '2026-12', cardId: 'CX', payMethod: 'cartao', reimbursable: true, confidence: 'alta' },
  ],
  reimbursements: [
    { id: 'RB-comp', who: 'Terceiro', amount: 2000, expectedDate: '2026-08-15', linkedTo: 'P-comp', status: 'previsto', confidence: 'media' },
  ],
  extraordinaryEvents: [],
  dailySpending: [{ monthISO: '2026-08', min: 1000, normal: 1500, heavy: 2000, profile: 'maioria_cartao', confidence: 'media' }],
};

// --------------------------------------------------------------------------
// F5 — evento patrimonial grande com destinação travada ('intocavel'). Mês '2026-08'.
// --------------------------------------------------------------------------
export const F5: PersonalInputs = {
  incomeSources: [
    { id: 'S', label: 'Salário', amount: 5000, dayOfMonth: 5, frequency: 'mensal', nature: 'rotina', confidence: 'alta' },
  ],
  accounts: [{ id: 'C', label: 'Conta', currentBalance: 2000, balanceDate: '2026-07-26', confidence: 'alta' }],
  cards: [],
  cardBills: [],
  fixedCommitments: [
    { id: 'f-alug', label: 'Aluguel', amount: 1800, dayOfMonth: 10, payMethod: 'boleto', essential: true, confidence: 'alta' },
  ],
  installments: [],
  reimbursements: [],
  extraordinaryEvents: [
    { id: 'X-venda', label: 'Venda de imóvel', amount: 80000, date: '2026-08-12', klass: 'patrimonial', destination: 'intocavel', confidence: 'alta' },
  ],
  dailySpending: [{ monthISO: '2026-08', min: 1000, normal: 1400, heavy: 2000, profile: 'meio_a_meio', confidence: 'media' }],
};
