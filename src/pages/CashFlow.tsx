import { useState } from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCashflow } from '@/hooks/finance/useCashflow';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';

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

  if (isLoading || !cashflow || !snapshot) {
    return <div className="p-8 text-center text-muted-foreground">Projetando fluxo de caixa...</div>;
  }

  // Initial balance is starting balance from first line or 0
  const initialBalance = cashflow.lines.length > 0 ? cashflow.lines[0].saldo - cashflow.lines[0].entradas + cashflow.lines[0].saidas : 0;
  const finalBalance = cashflow.lines.length > 0 ? cashflow.lines[cashflow.lines.length - 1].saldo : 0;
  const totalEntradas = cashflow.lines.reduce((s, r) => s + r.entradas, 0);
  const totalSaidas = cashflow.lines.reduce((s, r) => s + r.saidas, 0);

  // Extract pending titles within range from snapshot directly
  const endDate = new Date(todayStr);
  endDate.setDate(endDate.getDate() + rangeDays);
  const endStr = endDate.toISOString().split('T')[0];

  const pendingTitles = snapshot.titles.filter(t => 
    ['previsto', 'atrasado'].includes(t.status) &&
    t.dueDate >= todayStr && t.dueDate <= endStr
  );

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
          <p className="text-xl font-bold mt-1 text-positive">{fmt(totalEntradas)}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground font-medium">Saídas Previstas</p>
          <p className="text-xl font-bold mt-1 text-negative">{fmt(totalSaidas)}</p>
        </div>
        <div className={cn('bg-card rounded-xl border p-4', finalBalance < 0 && 'border-destructive')}>
          <p className="text-xs text-muted-foreground font-medium">Saldo Final Projetado</p>
          <p className={cn('text-xl font-bold mt-1', finalBalance < 0 ? 'text-negative' : 'text-positive')}>{fmt(finalBalance)}</p>
        </div>
      </div>

      {cashflow.alertas.length > 0 && (
        <div className="bg-destructive-subtle border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-negative shrink-0" />
          <div className="space-y-1">
            {cashflow.alertas.map((alerta, i) => (
              <p key={i} className="text-sm text-negative font-medium">{alerta}</p>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Movimentação por dia</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Entradas</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saídas</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cashflow.lines.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhuma movimentação para exibir.</td></tr>
              ) : cashflow.lines.map((r, idx) => (
                <tr key={idx} className={cn('hover:bg-muted/30 transition-colors', r.saldo < 0 && 'bg-destructive-subtle')}>
                  <td className="px-4 py-3">{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right text-positive font-medium">{r.entradas > 0 ? fmt(r.entradas) : '—'}</td>
                  <td className="px-4 py-3 text-right text-negative font-medium">{r.saidas > 0 ? fmt(r.saidas) : '—'}</td>
                  <td className={cn('px-4 py-3 text-right font-bold', r.saldo < 0 ? 'text-negative' : '')}>
                    {fmt(r.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Detalhamento por vencimentos</h3>
        </div>
        <div className="divide-y">
          {pendingTitles.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(t => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t.description}</p>
                <p className="text-xs text-muted-foreground">{new Date(t.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
              <span className={cn('text-sm font-semibold', t.type === 'receber' ? 'text-positive' : 'text-negative')}>
                {t.type === 'receber' ? '+' : '-'} {fmt(t.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
