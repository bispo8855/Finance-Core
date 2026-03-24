import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KPICard } from '@/components/shared/KPICard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PaymentModal } from '@/components/shared/PaymentModal';
import { Button } from '@/components/ui/button';
import { Title } from '@/types/financial';
import {
  TrendingUp, TrendingDown, ArrowDownToLine,
  ArrowUpFromLine, AlertTriangle, CreditCard, Plus, Clock, Info
} from 'lucide-react';
import { useDashboard } from '@/hooks/finance/useDashboard';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

  const upcomingTitles = kpis.upcomingTitles.filter(t => t.side === tab);

  const daysOverdue = (dueDate: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(dueDate + 'T12:00:00').getTime()) / 86400000);
    return diff > 0 ? diff : 0;
  };

  const maxBalance = Math.max(...kpis.projectedBalanceData.map(d => d.balance));
  const minBalance = Math.min(...kpis.projectedBalanceData.map(d => d.balance));
  
  let strokeColor = "url(#splitColor)";
  if (minBalance >= 0) strokeColor = "#10b981"; // always positive
  else if (maxBalance < 0) strokeColor = "#ef4444"; // always negative

  const gradientOffset = () => {
    if (maxBalance <= 0) return 0;
    if (minBalance >= 0) return 1;
    return maxBalance / (maxBalance - minBalance);
  };
  const off = gradientOffset();

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
        <KPICard 
          title="Saldo disponível hoje" 
          value={fmt(kpis.saldoDisponivelHoje)} 
          icon={CreditCard} 
          variant={kpis.saldoDisponivelHoje >= 0 ? 'default' : 'negative'} 
        />
        <KPICard 
          title="A receber (previsto)" 
          value={fmt(kpis.aReceberPrevisto)} 
          icon={ArrowDownToLine} 
          variant="positive"
        />
        <KPICard 
          title="A pagar (previsto)" 
          value={fmt(kpis.aPagarPrevisto)} 
          icon={ArrowUpFromLine} 
          variant="warning" 
        />
        <KPICard 
          title="Saldo projetado final" 
          value={fmt(kpis.saldoProjetadoFinal)} 
          icon={kpis.saldoProjetadoFinal >= 0 ? TrendingUp : TrendingDown} 
          variant={kpis.saldoProjetadoFinal >= 0 ? 'positive' : 'negative'} 
        />
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-4 w-full h-[320px]">
        <h3 className="font-semibold text-sm mb-4">Projeção de Saldo (30 dias)</h3>
        <ResponsiveContainer width="100%" height="100%" className="-ml-4 pb-4">
          <LineChart data={kpis.projectedBalanceData} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset={off} stopColor="#10b981" stopOpacity={1} />
                <stop offset={off} stopColor="#ef4444" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="shortDate" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} minTickGap={30} />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
              tickFormatter={(val) => `R$ ${val.toLocaleString('pt-BR')}`} 
              width={80} 
              domain={[(dataMin: number) => Math.min(0, dataMin - (Math.abs(dataMin)*0.1 || 100)), (dataMax: number) => dataMax + (Math.abs(dataMax)*0.1 || 100)]}
            />
            <Tooltip 
              formatter={(value: number) => [fmt(value), 'Saldo']}
              labelFormatter={(label) => `Data: ${label}`}
              contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
            />
            <Line 
              type="monotone" 
              dataKey="balance" 
              stroke={strokeColor} 
              strokeWidth={3} 
              dot={false}
              activeDot={{ r: 5, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-muted/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border">
        <div className="flex items-center gap-2">
          <div className="bg-secondary p-2 rounded-lg">
            <Info className="w-5 h-5 text-secondary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Atenção</h3>
            <p className="text-xs text-muted-foreground">Resumo de pendências e títulos vencidos</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">A Receber Vencido</span>
            <span className={`text-sm font-bold ${kpis.aReceberVencido > 0 ? 'text-negative' : 'text-foreground'}`}>
              {fmt(kpis.aReceberVencido)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">A Pagar Vencido</span>
            <span className={`text-sm font-bold ${kpis.aPagarVencido > 0 ? 'text-negative' : 'text-foreground'}`}>
              {fmt(kpis.aPagarVencido)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Próximos Vencimentos</span>
            <span className="text-sm font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              {kpis.totalProximosVencimentos} {kpis.totalProximosVencimentos === 1 ? 'título' : 'títulos'}
            </span>
          </div>
        </div>
      </div>

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
          ) : upcomingTitles.map(t => {
            const currentStatus = (t.status === 'previsto' && t.dueDate < todayStr) ? 'atrasado' : t.status;
            return (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{getContactName(t.contactId)} · {new Date(t.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={currentStatus as Title['status']} />
                {currentStatus === 'atrasado' && (
                  <span className="text-xs text-negative font-medium">{daysOverdue(t.dueDate)}d</span>
                )}
                <span className="text-sm font-semibold w-28 text-right">{fmt(t.value)}</span>
                {t.status === 'previsto' && (
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setPayTitle(t)}>
                    Baixar
                  </Button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      <PaymentModal title={payTitle} open={!!payTitle} onClose={() => setPayTitle(null)} />
    </div>
  );
}
