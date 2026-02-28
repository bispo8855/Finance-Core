import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KPICard } from '@/components/shared/KPICard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PaymentModal } from '@/components/shared/PaymentModal';
import { Button } from '@/components/ui/button';
import { Title } from '@/types/financial';
import {
  DollarSign, TrendingUp, TrendingDown, ArrowDownToLine,
  ArrowUpFromLine, AlertTriangle, BarChart3, CreditCard, Plus,
} from 'lucide-react';
import { useDashboard } from '@/hooks/finance/useDashboard';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Dashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'receber' | 'pagar'>('receber');
  const [payTitle, setPayTitle] = useState<Title | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);

  const { data: snapshot } = useFinanceSnapshot();
  const { data: kpis, isLoading } = useDashboard(monthStr);

  if (isLoading || !kpis || !snapshot) {
    return <div className="p-8 text-center text-muted-foreground">Carregando dashboard...</div>;
  }

  const getContactName = (id: string) => snapshot.contacts.find(c => c.id === id)?.name || '—';
  const getCategoryName = (id: string) => snapshot.categories.find(c => c.id === id)?.name || '—';

  const upcomingTitles = kpis.upcomingTitles.filter(t => t.type === tab);

  const daysOverdue = (dueDate: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(dueDate + 'T12:00:00').getTime()) / 86400000);
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

      {kpis.alerts.length > 0 && (
        <div className="bg-destructive-subtle border border-destructive/20 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-negative flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Alertas
          </h3>
          {kpis.alerts.map((a, i) => (
            <p key={i} className="text-sm text-negative/80">• {a}</p>
          ))}
        </div>
      )}

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
