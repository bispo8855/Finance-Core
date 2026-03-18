import { useState, useMemo } from 'react';
import { TrendingUp, AlertTriangle, ChevronDown, ChevronRight, Clock, Calendar, TrendingDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCashflow } from '@/hooks/finance/useCashflow';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const periods = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
];

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

  // State to track expanded months
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  if (isLoading || !cashflow || !snapshot) {
    return <div className="p-8 text-center text-muted-foreground">Projetando fluxo de caixa...</div>;
  }

  // Initial balance is starting balance from first line or 0
  const initialBalance = cashflow.lines.length > 0 ? cashflow.lines[0].saldo - cashflow.lines[0].entradas + cashflow.lines[0].saidas : 0;
  const { totalEntradas, totalSaidas, saldoFinal: finalBalance } = cashflow;
  // Extract pending titles within range from snapshot directly
  const endDate = new Date(todayStr);
  endDate.setDate(endDate.getDate() + rangeDays);
  const endStr = endDate.toISOString().split('T')[0];

  const pendingTitles = snapshot.titles.filter(t => 
    ['previsto', 'atrasado'].includes(t.status) &&
    t.dueDate >= todayStr && t.dueDate <= endStr
  );

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

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground">Projeção de entradas e saídas</p>
        </div>
      </div>

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

      {/* RECONCILIAÇÃO DO FLUXO */}
      <Card className="bg-card border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Reconciliação do Fluxo
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Realizado (movimentos) + Projeções (títulos previstos)</p>
            </div>
            <Badge variant="secondary" className="font-normal text-xs">
              Hoje: {new Date(todayStr + 'T12:00:00').toLocaleDateString('pt-BR')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Left Column: Pendências (Vencidos) */}
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-xs font-semibold uppercase tracking-wider">Pendências (Vencidos)</h3>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">A Receber vencido</span>
                <span className="font-medium text-foreground">{fmt(pendenciasReceber)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">A Pagar vencido</span>
                <span className={cn("font-medium", pendenciasPagar > 0 ? "text-negative" : "text-foreground")}>
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-10"></th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mês</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo Inicial</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Entradas</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saídas</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo Final</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {monthlyData.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma projeção para exibir.</td></tr>
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
                        <td className="px-4 py-3 text-right">{month.entradas > 0 ? fmt(month.entradas) : '—'}</td>
                        <td className="px-4 py-3 text-right">{month.saidas > 0 ? fmt(month.saidas) : '—'}</td>
                        <td className={cn('px-4 py-3 text-right font-bold', month.saldoFinal < 0 ? 'text-negative' : 'text-foreground')}>
                          {fmt(month.saldoFinal)}
                        </td>
                      </tr>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent asChild>
                      <tr>
                        <td colSpan={6} className="p-0 bg-muted/10 border-b">
                          <div className="px-10 py-4 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalhamento Diário ({month.label})</p>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 font-medium text-muted-foreground">Data</th>
                                  <th className="text-right py-2 font-medium text-muted-foreground">Entradas</th>
                                  <th className="text-right py-2 font-medium text-muted-foreground">Saídas</th>
                                  <th className="text-right py-2 font-medium text-muted-foreground">Saldo do Dia</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {month.dailyLines.map((r, idx) => (
                                  <tr key={idx} className="hover:bg-muted/30">
                                    <td className="py-2 text-muted-foreground">{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                    <td className="py-2 text-right">{r.entradas > 0 ? fmt(r.entradas) : '—'}</td>
                                    <td className="py-2 text-right">{r.saidas > 0 ? fmt(r.saidas) : '—'}</td>
                                    <td className={cn('py-2 text-right font-medium', r.saldo < 0 ? 'text-negative' : '')}>
                                      {fmt(r.saldo)}
                                    </td>
                                  </tr>
                                ))}
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
