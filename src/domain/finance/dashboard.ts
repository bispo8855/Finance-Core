import { Title, FinancialDocument, Movement, Category, BankAccount } from '@/types/financial';
import { deriveStatus } from './status';

export interface DashboardKPIs {
  receitaMes: number;
  despesaMes: number;
  resultado: number;
  saldo: number;
  aReceber30: number;
  aPagar30: number;
  vencidosReceber: number;
  vencidosPagar: number;
  topCategoria: [string, number] | null;
  alerts: string[];
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
  
  let saldo = accounts.reduce((acc, a) => acc + a.initialBalance, 0);
  saldo += movements.reduce((acc, m) => acc + (m.type === 'entrada' ? m.valuePaid : -m.valuePaid), 0);
  
  const virtualTitles = titles.map(t => ({ ...t, status: deriveStatus(t, referenceDateISO) }));
  const monthTitles = virtualTitles.filter(t => t.dueDate.startsWith(monthISO));

  const receitaMes = monthTitles.filter(t => t.type === 'receber').reduce((acc, t) => acc + t.value, 0);
  const despesaMes = monthTitles.filter(t => t.type === 'pagar').reduce((acc, t) => acc + t.value, 0);
  const resultado = receitaMes - despesaMes;

  const refDate = new Date(referenceDateISO + 'T12:00:00');
  const future30 = new Date(refDate);
  future30.setDate(future30.getDate() + 30);
  const future30Str = future30.toISOString().split('T')[0];

  const futurePending = virtualTitles.filter(t => 
    ['previsto', 'atrasado'].includes(t.status) &&
    t.dueDate >= referenceDateISO && 
    t.dueDate <= future30Str
  );

  const aReceber30 = futurePending.filter(t => t.type === 'receber').reduce((acc, t) => acc + t.value, 0);
  const aPagar30 = futurePending.filter(t => t.type === 'pagar').reduce((acc, t) => acc + t.value, 0);

  const vencidosReceber = virtualTitles.filter(t => t.type === 'receber' && t.status === 'atrasado').reduce((acc, t) => acc + t.value, 0);
  const vencidosPagar = virtualTitles.filter(t => t.type === 'pagar' && t.status === 'atrasado').reduce((acc, t) => acc + t.value, 0);

  const gastosPorCategoria: Record<string, number> = {};
  monthTitles.filter(t => t.type === 'pagar').forEach(t => {
    gastosPorCategoria[t.categoryId] = (gastosPorCategoria[t.categoryId] || 0) + t.value;
  });
  const sortedCategorias = Object.entries(gastosPorCategoria).sort((a, b) => b[1] - a[1]);
  const topCategoria = sortedCategorias.length > 0 ? sortedCategorias[0] : null;

  const alerts: string[] = [];
  if (vencidosReceber > 0) alerts.push(`Você tem R$ ${vencidosReceber.toLocaleString('pt-BR', {minimumFractionDigits:2})} vencido a receber`);
  if (vencidosPagar > 0) alerts.push(`Você tem R$ ${vencidosPagar.toLocaleString('pt-BR', {minimumFractionDigits:2})} vencido a pagar`);
  if (saldo < 0) alerts.push('Saldo consolidado está negativo!');
  if (saldo - aPagar30 < 0) alerts.push('Saldo projetado pode ficar negativo nos próximos 30 dias');

  const upcomingTitles = virtualTitles
    .filter(t => ['previsto', 'atrasado'].includes(t.status))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 10);

  return {
    receitaMes,
    despesaMes,
    resultado,
    saldo,
    aReceber30,
    aPagar30,
    vencidosReceber,
    vencidosPagar,
    topCategoria,
    alerts,
    upcomingTitles
  };
}
