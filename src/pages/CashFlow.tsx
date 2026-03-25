import { useState, useMemo, Fragment } from 'react';
import { TrendingUp, AlertTriangle, ChevronDown, ChevronRight, Clock, Calendar, TrendingDown, ShieldCheck, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCashflow } from '@/hooks/finance/useCashflow';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const periods = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border p-3 rounded-lg shadow-lg text-sm min-w-[200px]">
        <p className="font-semibold mb-2">{new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
        <p className="text-muted-foreground flex justify-between gap-4">
          <span>Entradas:</span>
          <span className="font-medium text-foreground">{fmt(data.entradas)}</span>
        </p>
        <p className="text-muted-foreground flex justify-between gap-4 mb-1">
          <span>Saídas:</span>
          <span className="font-medium text-foreground">{fmt(data.saidas)}</span>
        </p>
        <div className="h-px bg-border my-2" />
        <p className="flex justify-between gap-4">
          <span className="font-medium">Saldo:</span>
          <span className={cn("font-bold", data.saldo < 0 ? "text-negative" : "text-foreground")}>{fmt(data.saldo)}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function CashFlow() {
  const [periodIdx, setPeriodIdx] = useState(2); // default 60 dias
  const todayStr = new Date().toISOString().split('T')[0];
  const rangeDays = periods[periodIdx].days;

  const { data: snapshot } = useFinanceSnapshot();
  const { data: cashflow, isLoading } = useCashflow({ startDateISO: todayStr, rangeDays });

  // Group cashflow lines by Month/Year
  const monthlyData = useMemo(() => {
    if (!cashflow) return [];
    
    const groups: Record<string, typeof cashflow.lines> = {};
    
    cashflow.lines.forEach(line => {
      const [year, month] = line.date.split('-');
      const key = `${year}-${month}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(line);
    });

    const monthNames = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, lines]) => {
      const [year, monthStr] = key.split('-');
      const monthIdx = parseInt(monthStr, 10);
      const label = `${monthNames[monthIdx]}/${year}`;

      const saldoInicial = lines[0].saldo - lines[0].entradas + lines[0].saidas;
      const saldoFinal = lines[lines.length - 1].saldo;
      const entradas = lines.reduce((acc, l) => acc + l.entradas, 0);
      const saidas = lines.reduce((acc, l) => acc + l.saidas, 0);

      const dailyLines = lines.filter(l => l.entradas > 0 || l.saidas > 0);

      return { key, label, saldoInicial, saldoFinal, entradas, saidas, dailyLines };
    });
  }, [cashflow]);

  // State to track expanded months and days
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  if (isLoading || !cashflow || !snapshot) {
    return <div className="p-8 text-center text-muted-foreground">Projetando fluxo de caixa...</div>;
  }

  const { totalEntradas, totalSaidas, saldoFinal: finalBalance, initialBalance } = cashflow;
  
  // Extract pending titles within range from snapshot directly
  const endDate = new Date(todayStr);
  endDate.setDate(endDate.getDate() + rangeDays);

  // Reconciliation Block Calculations (visao do dia, independente do filtro de range)
  const pendenciasReceber = snapshot.titles
    .filter(t => t.side === 'receber' && ['previsto', 'atrasado'].includes(t.status) && t.dueDate < todayStr)
    .reduce((acc, t) => acc + t.value, 0);

  const pendenciasPagar = snapshot.titles
    .filter(t => t.side === 'pagar' && ['previsto', 'atrasado'].includes(t.status) && t.dueDate < todayStr)
    .reduce((acc, t) => acc + t.value, 0);

  const proximosReceber = snapshot.titles
    .filter(t => t.side === 'receber' && ['previsto', 'atrasado'].includes(t.status) && t.dueDate >= todayStr)
    .reduce((acc, t) => acc + t.value, 0);

  const proximosPagar = snapshot.titles
    .filter(t => t.side === 'pagar' && ['previsto', 'atrasado'].includes(t.status) && t.dueDate >= todayStr)
    .reduce((acc, t) => acc + t.value, 0);

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDay = (key: string) => {
    setExpandedDays(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasNegativePoints = cashflow.minBalance < 0;

  return (
    <div className="space-y-6 max-w-7xl pb-16">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground">Projeção e decisão financeira</p>
        </div>
      </div>

      {/* Alerta de Risco */}
      {cashflow.riskState === 'saudavel' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-500 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Caixa projetado permanece positivo em todo o período.</p>
        </div>
      )}
      {cashflow.riskState === 'atencao' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
          <div className="text-sm font-medium text-amber-800 dark:text-amber-400">
            Atenção: A projeção indica forte consumo de caixa. Menor saldo: <strong>{fmt(cashflow.minBalance)}</strong> em {cashflow.minBalanceDate ? new Date(cashflow.minBalanceDate + 'T12:00:00').toLocaleDateString('pt-BR') : ''}.
          </div>
        </div>
      )}
      {cashflow.riskState === 'critico' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0" />
          <div className="text-sm font-medium text-red-800 dark:text-red-400">
            Atenção: Saldo projetado fica <strong>negativo ({fmt(cashflow.minBalance)})</strong> em {cashflow.minBalanceDate ? new Date(cashflow.minBalanceDate + 'T12:00:00').toLocaleDateString('pt-BR') : ''}. Ação necessária.
          </div>
        </div>
      )}

      {cashflow.hasMissingOpeningDates && (
        <div className="bg-muted text-muted-foreground text-xs px-3 py-2 rounded-md max-w-2xl border border-border">
          Nota: Algumas contas não possuem "Data de Implantação" definida. O saldo dessas contas pode não estar preciso.
        </div>
      )}

      <div className="flex gap-1 bg-muted rounded-lg p-0.5 w-fit">
        {periods.map((p, i) => (
          <button key={i} onClick={() => setPeriodIdx(i)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${periodIdx === i ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground font-medium">Saldo Inicial</p>
          <p className="text-xl font-bold mt-1">{fmt(initialBalance)}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground font-medium">Entradas Previstas</p>
          <p className="text-xl font-bold mt-1 text-foreground">{fmt(totalEntradas)}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground font-medium">Saídas Previstas</p>
          <p className="text-xl font-bold mt-1 text-foreground">{fmt(totalSaidas)}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground font-medium">Saldo Final Projetado</p>
          <p className={cn('text-xl font-bold mt-1', finalBalance < 0 ? 'text-negative' : 'text-foreground')}>{fmt(finalBalance)}</p>
        </div>
      </div>

      {/* CHART DE TRAJETÓRIA DIÁRIA */}
      <Card className="bg-card border shadow-sm">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-base font-semibold">Trajetória Diária do Caixa</CardTitle>
          <p className="text-xs text-muted-foreground">{rangeDays} dias projetados</p>
        </CardHeader>
        <CardContent className="p-4 pt-6">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashflow.lines} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => new Date(val + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  dy={10}
                />
                <YAxis 
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                {hasNegativePoints && (
                  <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                )}
                <Line 
                  type="monotone" 
                  dataKey="saldo" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={(props: any) => {
                    if (props.payload.saldo < 0) {
                      return (
                        <circle cx={props.cx} cy={props.cy} r={4} fill="hsl(var(--destructive))" stroke="white" strokeWidth={2} />
                      );
                    }
                    if (props.payload.date === cashflow.minBalanceDate) {
                      return (
                        <circle cx={props.cx} cy={props.cy} r={4} fill="hsl(var(--warning) / 0.8)" stroke="white" strokeWidth={2} />
                      );
                    }
                    return <circle cx={props.cx} cy={props.cy} r={0} />;
                  }}
                  activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* RECONCILIAÇÃO DO FLUXO */}
      <Card className="bg-card border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Reconciliação e Pendências
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Status atual das obrigações vs Projeções</p>
            </div>
            <Badge variant="outline" className="font-medium">
              Hoje: {new Date(todayStr + 'T12:00:00').toLocaleDateString('pt-BR')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Left Column: Pendências (Vencidos) */}
            <div className="p-5 space-y-4 bg-red-50/20 dark:bg-red-950/10">
              <div className="flex items-center gap-2 text-negative mb-3">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Pendências (Atrasados)</h3>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">A Receber em atraso</span>
                <span className="font-semibold text-foreground">{fmt(pendenciasReceber)}</span>
              </div>
              <Separator className="bg-red-100 dark:bg-red-900/30" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">A Pagar em atraso</span>
                <span className={cn("font-bold text-lg", pendenciasPagar > 0 ? "text-negative" : "text-foreground")}>
                  {pendenciasPagar > 0 ? `-${fmt(pendenciasPagar)}` : fmt(0)}
                </span>
              </div>
            </div>

            {/* Right Column: Próximos (Previstos) */}
            <div className="p-5 space-y-4 bg-muted/5">
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <Clock className="w-4 h-4" />
                <h3 className="text-xs font-semibold uppercase tracking-wider">Próximos (Previstos)</h3>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">A Receber previsto</span>
                <span className="font-medium text-foreground">{fmt(proximosReceber)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">A Pagar previsto</span>
                <span className="font-medium text-foreground">{fmt(proximosPagar)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/20">
          <h3 className="text-base font-bold">Composição Diária</h3>
          <p className="text-xs text-muted-foreground mt-1">Expanda os meses e dias para entender exatamente o que move o saldo.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-10"></th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Período</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo Inicial</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Entradas</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saídas</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo Final</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {monthlyData.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma projeção para exibir no período selecionado.</td></tr>
              ) : monthlyData.map((month) => (
                <Collapsible 
                  key={month.key} 
                  asChild 
                  open={!!expandedMonths[month.key]} 
                  onOpenChange={() => toggleMonth(month.key)}
                >
                  <>
                    <CollapsibleTrigger asChild>
                      <tr className="hover:bg-muted/30 transition-colors cursor-pointer group">
                        <td className="px-4 py-3 text-muted-foreground">
                          {expandedMonths[month.key] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 font-semibold flex items-center gap-2">
                          {month.label}
                          {month.saldoFinal < 0 && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-negative bg-destructive-subtle px-1.5 py-0.5 rounded-sm">Caixa Negativo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{fmt(month.saldoInicial)}</td>
                        <td className="px-4 py-3 text-right text-positive">{month.entradas > 0 ? fmt(month.entradas) : '—'}</td>
                        <td className="px-4 py-3 text-right text-negative">{month.saidas > 0 ? fmt(month.saidas) : '—'}</td>
                        <td className={cn('px-4 py-3 text-right font-bold', month.saldoFinal < 0 ? 'text-negative' : 'text-foreground')}>
                          {fmt(month.saldoFinal)}
                        </td>
                      </tr>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent asChild>
                      <tr>
                        <td colSpan={6} className="p-0 bg-muted/5 border-b shadow-inner">
                          <div className="pl-6 pr-4 py-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border/50 text-xs">
                                  <th className="w-8"></th>
                                  <th className="text-left py-2 font-medium text-muted-foreground">Data</th>
                                  <th className="text-right py-2 font-medium text-muted-foreground">Enthradas do Dia</th>
                                  <th className="text-right py-2 font-medium text-muted-foreground">Saídas do Dia</th>
                                  <th className="text-right py-2 font-medium text-muted-foreground">Saldo do Dia</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {month.dailyLines.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground">Sem movimentações relevantes neste mês.</td>
                                  </tr>
                                )}
                                {month.dailyLines.map((r, idx) => {
                                  const dayKey = r.date;
                                  const isExpanded = expandedDays[dayKey];
                                  return (
                                    <Fragment key={idx}>
                                      <tr className={cn(
                                        "hover:bg-card/60 cursor-pointer transition-colors",
                                        isExpanded ? "bg-card/50" : ""
                                      )} onClick={() => toggleDay(dayKey)}>
                                        <td className="py-2 pl-2">
                                          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground/50 hover:text-foreground" />}
                                        </td>
                                        <td className="py-2 font-medium">
                                          {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                        </td>
                                        <td className="py-2 text-right">{r.entradas > 0 ? <span className="text-positive">{fmt(r.entradas)}</span> : <span className="text-muted-foreground/30">—</span>}</td>
                                        <td className="py-2 text-right">{r.saidas > 0 ? <span className="text-negative">{fmt(r.saidas)}</span> : <span className="text-muted-foreground/30">—</span>}</td>
                                        <td className={cn('py-2 text-right font-bold', r.saldo < 0 ? 'text-negative bg-red-50 dark:bg-red-950/20 px-1 rounded' : '')}>
                                          {fmt(r.saldo)}
                                        </td>
                                      </tr>
                                      
                                      {/* EXPANSÃO DO DIA */}
                                      {isExpanded && (
                                        <tr className="bg-background border-b border-border shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                                          <td colSpan={5} className="p-0">
                                            <div className="pl-12 pr-4 py-4 border-l-2 border-primary/20 ml-3 my-2">
                                              
                                              {r.details.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">Nenhum detalhe encontrado para o dia.</p>
                                              ) : (
                                                <div className="space-y-4">
                                                  
                                                  {/* Entradas */}
                                                  {r.details.filter(d => d.type === 'entrada').length > 0 && (
                                                    <div>
                                                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex flex-col gap-0.5">
                                                        <span>Entradas</span>
                                                      </h4>
                                                      <ul className="space-y-1.5 border border-border/40 rounded-md p-2 bg-card">
                                                        {r.details.filter(d => d.type === 'entrada').map(item => (
                                                          <li key={item.id} className="flex justify-between items-center text-sm py-1">
                                                            <div className="flex items-center gap-2">
                                                              <span className="w-1.5 h-1.5 rounded-full bg-positive flex-shrink-0" />
                                                              <span className="text-foreground">{item.description}</span>
                                                              <span className={cn(
                                                                "text-[10px] px-1.5 py-0.5 rounded uppercase font-medium",
                                                                item.origin === 'movement' ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                                                              )}>
                                                                {item.origin === 'movement' ? 'Realizado' : 'Previsto'}
                                                              </span>
                                                            </div>
                                                            <span className="font-medium text-positive">+{fmt(item.value)}</span>
                                                          </li>
                                                        ))}
                                                      </ul>
                                                    </div>
                                                  )}

                                                  {/* Saídas */}
                                                  {r.details.filter(d => d.type === 'saida').length > 0 && (
                                                    <div>
                                                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex flex-col gap-0.5">
                                                        <span>Saídas</span>
                                                      </h4>
                                                      <ul className="space-y-1.5 border border-border/40 rounded-md p-2 bg-card">
                                                        {r.details.filter(d => d.type === 'saida').map(item => (
                                                          <li key={item.id} className="flex justify-between items-center text-sm py-1">
                                                            <div className="flex items-center gap-2">
                                                              <span className="w-1.5 h-1.5 rounded-full bg-negative flex-shrink-0" />
                                                              <span className="text-foreground">{item.description}</span>
                                                              <span className={cn(
                                                                "text-[10px] px-1.5 py-0.5 rounded uppercase font-medium",
                                                                item.origin === 'movement' ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                                                              )}>
                                                                {item.origin === 'movement' ? 'Realizado' : 'Previsto'}
                                                              </span>
                                                            </div>
                                                            <span className="font-medium text-negative">-{fmt(item.value)}</span>
                                                          </li>
                                                        ))}
                                                      </ul>
                                                    </div>
                                                  )}

                                                </div>
                                              )}
                                              
                                              <div className="flex justify-end gap-6 pt-3 mt-3 border-t border-border/50 text-xs">
                                                <div className="text-muted-foreground">
                                                  Total Entradas: <span className="font-medium text-foreground">{fmt(r.entradas)}</span>
                                                </div>
                                                <div className="text-muted-foreground">
                                                  Total Saídas: <span className="font-medium text-foreground">{fmt(r.saidas)}</span>
                                                </div>
                                              </div>

                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
