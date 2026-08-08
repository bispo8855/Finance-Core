// ============================================================================
// Aurys Personal — fixture da tela DEMO (/personal/demo).
//
// Cópia INDEPENDENTE do caso anonimizado. Deliberadamente NÃO importa de
// src/test/personal/fixtures.ts: teste e produto não devem se acoplar — mudar
// uma fixture de teste não pode alterar o que a tela mostra, e vice-versa.
//
// `today` é FIXO para a tela ser determinística (não depende do relógio).
// Dados fictícios: nenhuma conta, banco ou pessoa real.
// ============================================================================

import { PersonalInputs } from '@/domain/personal/types';

export const PERSONAL_DEMO_TODAY = '2026-07-26';
export const PERSONAL_DEMO_MONTH = '2026-07';

export const PERSONAL_DEMO_INPUTS: PersonalInputs = {
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
    // Retorno APÓS o vencimento da fatura CB (05/08) → risco de timing explícito.
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
