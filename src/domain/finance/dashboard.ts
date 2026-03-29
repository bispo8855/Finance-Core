import { Title, FinancialDocument, Movement, Category, BankAccount } from '@/types/financial';
import { deriveStatus } from './status';

export interface DashboardKPIs {
  saldoDisponivelHoje: number;
  aReceberPrevisto: number;
  aPagarPrevisto: number;
  saldoProjetadoFinal: number;
  aReceberVencido: number;
  aPagarVencido: number;
  totalProximosVencimentos: number; // Represents the count of upcoming titles
  projectedBalanceData: Array<{ date: string; shortDate: string; balance: number }>;
  upcomingTitles: Title[];
}

export function calculateDashboardKPIs({
  titles,
  movements,
  accounts,
  monthISO,
  referenceDateISO
}: {
  documents: FinancialDocument[];
  titles: Title[];
  movements: Movement[];
  accounts: BankAccount[];
  categories: Category[];
  monthISO: string;
  referenceDateISO: string;
}): DashboardKPIs {
  
  let saldoDisponivelHoje = 0;
  for (const a of accounts) {
    const openDate = a.openingBalanceDate || '1970-01-01';
    if (openDate <= referenceDateISO) {
      let accountBal = a.openingBalance;
      movements.filter(m => m.accountId === a.id && m.paymentDate >= openDate && m.paymentDate <= referenceDateISO).forEach(m => {
        if (m.type === 'entrada') accountBal += m.valuePaid;
        else accountBal -= m.valuePaid;
      });
      saldoDisponivelHoje += accountBal;
    }
  }
  
  const aReceberPrevisto = titles
    .filter(t => t.side === 'receber' && t.status === 'previsto' && t.dueDate >= referenceDateISO)
    .reduce((acc, t) => acc + t.value, 0);

  const aPagarPrevisto = titles
    .filter(t => t.side === 'pagar' && t.status === 'previsto' && t.dueDate >= referenceDateISO)
    .reduce((acc, t) => acc + t.value, 0);

  const saldoProjetadoFinal = saldoDisponivelHoje + aReceberPrevisto - aPagarPrevisto;

  const aReceberVencido = titles
    .filter(t => t.side === 'receber' && t.status === 'previsto' && t.dueDate < referenceDateISO)
    .reduce((acc, t) => acc + t.value, 0);

  const aPagarVencido = titles
    .filter(t => t.side === 'pagar' && t.status === 'previsto' && t.dueDate < referenceDateISO)
    .reduce((acc, t) => acc + t.value, 0);

  const upcomingTitlesList = titles
    .filter(t => t.status === 'previsto' && (t.side === 'receber' || t.side === 'pagar'))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const totalProximosVencimentos = upcomingTitlesList.length;

  const upcomingTitles = upcomingTitlesList.slice(0, 10);

  let currentBalance = saldoDisponivelHoje;
  const projectedBalanceData = [];
  
  const refDate = new Date(referenceDateISO + 'T12:00:00');
  for (let i = 0; i <= 30; i++) {
    const curDate = new Date(refDate);
    curDate.setDate(curDate.getDate() + i);
    const dateStr = curDate.toISOString().split('T')[0];

    const entradasDia = titles
      .filter(t => t.side === 'receber' && t.status === 'previsto' && t.dueDate === dateStr)
      .reduce((acc, t) => acc + t.value, 0);
    const saidasDia = titles
      .filter(t => t.side === 'pagar' && t.status === 'previsto' && t.dueDate === dateStr)
      .reduce((acc, t) => acc + t.value, 0);

    currentBalance += (entradasDia - saidasDia);

    projectedBalanceData.push({
      date: dateStr,
      shortDate: `${dateStr.substring(8, 10)}/${dateStr.substring(5, 7)}`,
      balance: currentBalance
    });
  }

  return {
    saldoDisponivelHoje,
    aReceberPrevisto,
    aPagarPrevisto,
    saldoProjetadoFinal,
    aReceberVencido,
    aPagarVencido,
    totalProximosVencimentos,
    projectedBalanceData,
    upcomingTitles
  };
}
