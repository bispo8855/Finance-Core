import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinancial } from '@/contexts/FinancialContext';
import { KPICard } from '@/components/shared/KPICard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PaymentModal } from '@/components/shared/PaymentModal';
import { Button } from '@/components/ui/button';
import { Title } from '@/types/financial';
import {
  DollarSign, TrendingUp, TrendingDown, ArrowDownToLine,
  ArrowUpFromLine, AlertTriangle, BarChart3, CreditCard, Plus,
} from 'lucide-react';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Dashboard() {
  const navigate = useNavigate();
  const { titles, categories, getContactName, getCategoryName, getTotalBalance } = useFinancial();
  const [tab, setTab] = useState<'receber' | 'pagar'>('receber');
  const [payTitle, setPayTitle] = useState<Title | null>(null);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);
  const future30 = new Date(today);
  future30.setDate(future30.getDate() + 30);
  const future30Str = future30.toISOString().split('T')[0];

  const kpis = useMemo(() => {
    const receitaMes = titles.filter(t => t.type === 'receber' && t.dueDate.startsWith(monthStr))
      .reduce((s, t) => s + t.value, 0);
    const despesaMes = titles.filter(t => t.type === 'pagar' && t.dueDate.startsWith(monthStr))
      .reduce((s, t) => s + t.value, 0);
    const resultado = receitaMes - despesaMes;
    const saldo = getTotalBalance();
    const aReceber30 = titles.filter(t => t.type === 'receber' && ['previsto', 'atrasado'].includes(t.status) && t.dueDate <= future30Str && t.dueDate >= todayStr)
      .reduce((s, t) => s + t.value, 0);
    const aPagar30 = titles.filter(t => t.type === 'pagar' && ['previsto', 'atrasado'].includes(t.status) && t.dueDate <= future30Str && t.dueDate >= todayStr)
      .reduce((s, t) => s + t.value, 0);
    const vencidosReceber = titles.filter(t => t.type === 'receber' && t.status === 'atrasado')
      .reduce((s, t) => s + t.value, 0);
    const vencidosPagar = titles.filter(t => t.type === 'pagar' && t.status === 'atrasado')
      .reduce((s, t) => s + t.value, 0);

    const gastosPorCategoria: Record<string, number> = {};
    titles.filter(t => t.type === 'pagar' && t.dueDate.startsWith(monthStr)).forEach(t => {
      gastosPorCategoria[t.categoryId] = (gastosPorCategoria[t.categoryId] || 0) + t.value;
    });
    const topCategoria = Object.entries(gastosPorCategoria).sort((a, b) => b[1] - a[1])[0];

    return { receitaMes, resultado, saldo, aReceber30, aPagar30, vencidosReceber, vencidosPagar, topCategoria };
  }, [titles, monthStr, todayStr, future30Str, getTotalBalance]);

  const upcomingTitles = useMemo(() => {
    return titles
      .filter(t => t.type === tab && ['previsto', 'atrasado'].includes(t.status))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 10);
  }, [titles, tab]);

  const alerts = useMemo(() => {
    const items: string[] = [];
    if (kpis.vencidosReceber > 0) items.push(`Você tem ${fmt(kpis.vencidosReceber)} vencido a receber`);
    if (kpis.vencidosPagar > 0) items.push(`Você tem ${fmt(kpis.vencidosPagar)} vencido a pagar`);
    if (kpis.saldo < 0) items.push('Saldo consolidado está negativo!');
    if (kpis.saldo - kpis.aPagar30 < 0) items.push('Saldo projetado pode ficar negativo nos próximos 30 dias');
    return items;
  }, [kpis]);

  const daysOverdue = (dueDate: string) => {
    const diff = Math.floor((today.getTime() - new Date(dueDate + 'T12:00:00').getTime()) / 86400000);
    return diff > 0 ? diff : 0;
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do seu financeiro</p>
        </div>
        <Button onClick={() => navigate('/lancar')} className="gap-1.5">
          <Plus className="w-4 h-4" /> Novo lançamento
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Receita do mês" value={fmt(kpis.receitaMes)} icon={DollarSign} variant="positive" />
        <KPICard title="Resultado do mês" value={fmt(kpis.resultado)} icon={kpis.resultado >= 0 ? TrendingUp : TrendingDown} variant={kpis.resultado >= 0 ? 'positive' : 'negative'} />
        <KPICard title="Saldo atual" value={fmt(kpis.saldo)} icon={CreditCard} variant={kpis.saldo >= 0 ? 'default' : 'negative'} />
        <KPICard title="A receber (30d)" value={fmt(kpis.aReceber30)} icon={ArrowDownToLine} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="A pagar (30d)" value={fmt(kpis.aPagar30)} icon={ArrowUpFromLine} variant="warning" />
        <KPICard title="Vencidos a receber" value={fmt(kpis.vencidosReceber)} icon={AlertTriangle} variant={kpis.vencidosReceber > 0 ? 'negative' : 'default'} />
        <KPICard title="Vencidos a pagar" value={fmt(kpis.vencidosPagar)} icon={AlertTriangle} variant={kpis.vencidosPagar > 0 ? 'negative' : 'default'} />
        {kpis.topCategoria && (
          <KPICard title="Maior gasto do mês" value={fmt(kpis.topCategoria[1])} icon={BarChart3} subtitle={getCategoryName(kpis.topCategoria[0])} />
        )}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-destructive-subtle border border-destructive/20 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-negative flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Alertas
          </h3>
          {alerts.map((a, i) => (
            <p key={i} className="text-sm text-negative/80">• {a}</p>
          ))}
        </div>
      )}

      {/* Upcoming */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Próximos vencimentos</h3>
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            <button onClick={() => setTab('receber')} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${tab === 'receber' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
              A Receber
            </button>
            <button onClick={() => setTab('pagar')} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${tab === 'pagar' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
              A Pagar
            </button>
          </div>
        </div>
        <div className="divide-y">
          {upcomingTitles.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum título pendente.</p>
          ) : upcomingTitles.map(t => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{getContactName(t.contactId)} · {new Date(t.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={t.status} />
                {t.status === 'atrasado' && (
                  <span className="text-xs text-negative font-medium">{daysOverdue(t.dueDate)}d</span>
                )}
                <span className="text-sm font-semibold w-28 text-right">{fmt(t.value)}</span>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setPayTitle(t)}>
                  Baixar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <PaymentModal title={payTitle} open={!!payTitle} onClose={() => setPayTitle(null)} />
    </div>
  );
}
