import { Movement, Title, FinancialDocument, Category, BankAccount } from '@/types/financial';
import { getPeriodRange, PeriodOption } from '@/lib/dateUtils';
import { parseISO } from 'date-fns';

export type EventOrigin = 'manual' | 'bank' | 'ecommerce' | 'system';
export type FinancialEventStatus = 'ok' | 'warning' | 'problem';

export interface FinancialEventItem {
  id: string;
  description: string;
  amount: number;
  type: 'entrada' | 'saida';
  category?: string;
  affectsResult: boolean;
}

export interface FinancialEvent {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  origin: EventOrigin;
  type: 'entrada' | 'saida' | 'misto';
  totalAmount: number;
  netAmount: number;
  affectsResult: boolean;
  insight?: string;
  status: FinancialEventStatus;
  statusReason?: string;
  items: FinancialEventItem[];
  documentId?: string;
}

export interface StatementBalances {
  previousBalance: number;
  inflows: number;
  outflows: number;
  finalBalance: number;
}

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

function getFinancialEventStatus(
  m: Movement, 
  doc?: FinancialDocument, 
  category?: Category
): { status: FinancialEventStatus; reason?: string } {
  if (doc?.grossAmount && doc.marketplaceFee) {
    const feeRatio = doc.marketplaceFee / doc.grossAmount;
    if (feeRatio > 0.20) return { status: 'problem', reason: 'Taxas acima de 20% consomem muito da sua margem neste evento.' };
    if (feeRatio >= 0.12) return { status: 'warning', reason: 'Taxas entre 12% e 20%. Atenção ao custo de venda neste canal.' };
  }

  const vagueTerms = ['movimentação', 'ajuste', 'teste', 'extra', 'avulso', 'avulsa'];
  const desc = (doc?.description || '').toLowerCase();
  if (vagueTerms.some(term => desc.includes(term))) {
    return { status: 'warning', reason: 'Descrição genérica dificulta a análise futura do seu caixa.' };
  }

  if (!category || category.name === 'Sem Categoria') {
    return { status: 'warning', reason: 'Evento sem categoria definida prejudica a organização do seu DRE.' };
  }

  if (doc?.type === 'venda' && m.valuePaid <= 0) {
    return { status: 'problem', reason: 'Valor líquido zerado ou negativo em uma venda registrada.' };
  }

  return { status: 'ok' };
}

export function buildExtractExecutiveMessage(stats: { inflows: number; outflows: number; balance: number }): string {
  const { inflows, outflows } = stats;
  const net = inflows - outflows;

  if (inflows === 0 && outflows === 0) return "Nenhuma movimentação registrada no período selecionado.";

  if (net > 0) {
    if (outflows === 0) return `Você gerou um caixa positivo de ${fmt(net)} neste período, sem saídas registradas.`;
    return `Você gerou um caixa positivo de ${fmt(net)} neste período (Recebeu ${fmt(inflows)} e Pagou ${fmt(outflows)}).`;
  } else if (net < 0) {
    return `O caixa ficou pressionado neste período: as saídas superaram as entradas em ${fmt(Math.abs(net))}.`;
  } else {
    return "As entradas e saídas ficaram equilibradas neste período.";
  }
}

export function calculateStatementBalances(
  movements: Movement[],
  accounts: BankAccount[],
  period: PeriodOption,
  accountId: string
): StatementBalances {
  const { start, end } = getPeriodRange(period);
  
  // 1. Initial Account Balance (Sum of opening balances)
  let baseOpening = 0;
  if (accountId === 'all') {
    baseOpening = accounts.reduce((sum, acc) => sum + acc.openingBalance, 0);
  } else {
    baseOpening = accounts.find(a => a.id === accountId)?.openingBalance || 0;
  }

  let previousBalanceMovements = 0;
  let inflows = 0;
  let outflows = 0;

  movements.forEach(m => {
    const isTargetAccount = accountId === 'all' || m.accountId === accountId;
    if (!isTargetAccount) return;

    const mDate = parseISO(m.paymentDate);
    const mValue = m.valuePaid * (m.type === 'saida' ? -1 : 1);

    if (start && mDate < start) {
      // Movement before period
      previousBalanceMovements += mValue;
    } else if ((!start || mDate >= start) && (!end || mDate <= end)) {
      // Movement within period
      if (m.type === 'entrada') inflows += m.valuePaid;
      else outflows += m.valuePaid;
    }
  });

  const previousBalance = baseOpening + previousBalanceMovements;
  const finalBalance = previousBalance + inflows - outflows;

  return {
    previousBalance,
    inflows,
    outflows,
    finalBalance
  };
}

export function groupMovementsIntoEvents(
  movements: Movement[],
  titles: Title[],
  documents: FinancialDocument[],
  categories: Category[]
): FinancialEvent[] {
  return movements.map(m => {
    const title = titles.find(t => t.id === m.titleId);
    const doc = documents.find(d => d.id === title?.documentId);
    const category = categories.find(c => c.id === doc?.categoryId);
    
    const isEcom = doc?.grossAmount !== undefined && doc?.grossAmount > 0;
    const origin: EventOrigin = isEcom ? 'ecommerce' : 'manual';
    
    const items: FinancialEventItem[] = [];
    const titleStr = doc?.description || 'Movimentação';
    let subtitleStr = '';

    if (title && title.totalInstallments > 1) {
      subtitleStr = `Parcela ${title.installment}/${title.totalInstallments}`;
    }

    if (isEcom && doc) {
      items.push({
        id: `${m.id}-gross`,
        description: 'Venda Bruta',
        amount: (doc.grossAmount || 0) / (doc.installments || 1),
        type: 'entrada',
        category: category?.name,
        affectsResult: true
      });

      if (doc.marketplaceFee) {
        items.push({
          id: `${m.id}-fee`,
          description: 'Taxa Marketplace',
          amount: (doc.marketplaceFee / (doc.installments || 1)) * -1,
          type: 'saida',
          category: 'Taxas',
          affectsResult: true
        });
      }

      if (doc.shippingCost) {
        items.push({
          id: `${m.id}-shipping`,
          description: 'Frete',
          amount: (doc.shippingCost / (doc.installments || 1)) * -1,
          type: 'saida',
          category: 'Logística',
          affectsResult: true
        });
      }

      const sumItems = items.reduce((acc, curr) => acc + curr.amount, 0);
      const net = m.valuePaid;
      if (Math.abs(net - sumItems) > 0.01) {
         items.push({
           id: `${m.id}-adj`,
           description: 'Outros ajustes / Líquido',
           amount: net - sumItems,
           type: (net - sumItems) > 0 ? 'entrada' : 'saida',
           affectsResult: true
         });
      }
    } else {
      items.push({
        id: m.id,
        description: doc?.description || 'Lançamento',
        amount: m.valuePaid * (m.type === 'saida' ? -1 : 1),
        type: m.type,
        category: category?.name,
        affectsResult: true
      });
    }

    let insight: string | undefined;
    if (isEcom && doc?.marketplaceFee && doc?.grossAmount) {
      const feePercent = Math.round((doc.marketplaceFee / doc.grossAmount) * 100);
      insight = `Taxas consumiram ${feePercent}% desta venda`;
    } else if (m.feeAmount && m.feeAmount > 0) {
      insight = 'Valor recebido já considera descontos operacionais';
    }

    const { status, reason } = getFinancialEventStatus(m, doc, category);

    return {
      id: m.id,
      date: m.paymentDate,
      title: titleStr,
      subtitle: subtitleStr,
      origin,
      type: m.type as 'entrada' | 'saida',
      totalAmount: m.valuePaid,
      netAmount: m.valuePaid,
      affectsResult: true,
      insight,
      status,
      statusReason: reason,
      items,
      documentId: doc?.id
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}
