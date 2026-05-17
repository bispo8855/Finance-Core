const fmt = (v: number) => 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const microcopy = {
  mainLabel: 'Valor líquido da venda',
  predictedLabel: 'Recebimento previsto em',
  historicalLabel: 'Recebimento já deveria ter ocorrido',
  duplicateLabel: 'Possível Duplicidade',
};

export const extractMicrocopy = {
  tags: {
    sale: 'Venda',
    fee: 'Taxa',
    freight: 'Frete',
    reserve: 'Reserva',
    repasse: 'Repasse',
    chargeback: 'Estorno',
    anticipation: 'Antecipação',
    adjustment: 'Ajuste',
    received: 'Recebido',
    predicted: 'Previsto',
    pending: 'Pendente',
    transfer: 'Transferência',
    expense: 'Despesa',
    revenue: 'Receita',
  },

  eventTypeLabels: {
    sale: 'Venda',
    repasse: 'Repasse',
    transfer: 'Transferência',
    expense: 'Despesa',
    revenue: 'Receita',
    reserve: 'Reserva',
    chargeback: 'Estorno',
    adjustment: 'Ajuste',
    pending: 'Pendente',
    other: 'Outro',
  } as Record<string, string>,

  eventTypeIcons: {
    sale: '🛒',
    repasse: '💰',
    transfer: '🔄',
    expense: '📉',
    revenue: '📈',
    reserve: '🔒',
    chargeback: '↩️',
    adjustment: '⚙️',
    pending: '⏳',
    other: '📋',
  } as Record<string, string>,

  impactLabels: {
    cash: 'CAIXA',
    result: 'RESULTADO',
  },

  noEvents: 'Nenhuma movimentação financeira encontrada neste período.',

  breakdown: {
    gross: 'Venda bruta',
    fee: 'Taxa marketplace',
    freight: 'Frete',
    reserve: 'Reserva temporária',
    net: 'Líquido recebido',
    adjustment: 'Outros ajustes',
  },

  filters: {
    all: 'Todos',
    sales: '🛒 Vendas',
    income: '💰 Recebimentos',
    fees: '💳 Taxas & Custos',
    reserves: '🔒 Reservas',
    transfers: '🔄 Transferências',
    review: '⚠️ Em Revisão',
    ecommerce: '📦 E-commerce',
  },
};
