import { useState, useMemo } from 'react';
import { useFinancial } from '@/contexts/FinancialContext';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const periods = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
];

export default function CashFlow() {
  const { titles, getTotalBalance } = useFinancial();
  const [periodIdx, setPeriodIdx] = useState(2); // default 60 dias

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const data = useMemo(() => {
    const days = periods[periodIdx].days;
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);
    const endStr = endDate.toISOString().split('T')[0];

    const initialBalance = getTotalBalance();

    // Get pending titles in period
    const pendingTitles = titles.filter(t =>
      ['previsto', 'atrasado'].includes(t.status) &&
      t.dueDate >= todayStr && t.dueDate <= endStr
    );

    const totalEntradas = pendingTitles.filter(t => t.type === 'receber').reduce((s, t) => s + t.value, 0);
    const totalSaidas = pendingTitles.filter(t => t.type === 'pagar').reduce((s, t) => s + t.value, 0);
    const saldoFinal = initialBalance + totalEntradas - totalSaidas;

    // Build daily table (grouped by week for longer periods)
    const dailyMap: Record<string, { entradas: number; saidas: number }> = {};
    pendingTitles.forEach(t => {
      if (!dailyMap[t.dueDate]) dailyMap[t.dueDate] = { entradas: 0, saidas: 0 };
      if (t.type === 'receber') dailyMap[t.dueDate].entradas += t.value;
      else dailyMap[t.dueDate].saidas += t.value;
    });

    const sortedDates = Object.keys(dailyMap).sort();
    let runningBalance = initialBalance;
    const rows = sortedDates.map(date => {
      const d = dailyMap[date];
      runningBalance += d.entradas - d.saidas;
      return { date, entradas: d.entradas, saidas: d.saidas, saldo: runningBalance };
    });

    const hasNegative = rows.some(r => r.saldo < 0);

    return { initialBalance, totalEntradas, totalSaidas, saldoFinal, rows, pendingTitles, hasNegative };
  }, [titles, periodIdx, todayStr, getTotalBalance]);

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

      {/* Period Selector */}
      <div className="flex gap-1 bg-muted rounded-lg p-0.5 w-fit">
        {periods.map((p, i) => (
          <button key={i} onClick={() => setPeriodIdx(i)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${periodIdx === i ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground font-medium">Saldo Inicial</p>
          <p className="text-xl font-bold mt-1">{fmt(data.initialBalance)}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground font-medium">Entradas Previstas</p>
          <p className="text-xl font-bold mt-1 text-positive">{fmt(data.totalEntradas)}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground font-medium">Saídas Previstas</p>
          <p className="text-xl font-bold mt-1 text-negative">{fmt(data.totalSaidas)}</p>
        </div>
        <div className={cn('bg-card rounded-xl border p-4', data.saldoFinal < 0 && 'border-destructive')}>
          <p className="text-xs text-muted-foreground font-medium">Saldo Projetado</p>
          <p className={cn('text-xl font-bold mt-1', data.saldoFinal < 0 ? 'text-negative' : 'text-positive')}>{fmt(data.saldoFinal)}</p>
        </div>
      </div>

      {/* Alert */}
      {data.hasNegative && (
        <div className="bg-destructive-subtle border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-negative shrink-0" />
          <p className="text-sm text-negative font-medium">Atenção: O saldo projetado ficará negativo em alguns dias deste período.</p>
        </div>
      )}

      {/* Daily Table */}
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
              {data.rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhuma movimentação prevista no período.</td></tr>
              ) : data.rows.map(r => (
                <tr key={r.date} className={cn('hover:bg-muted/30 transition-colors', r.saldo < 0 && 'bg-destructive-subtle')}>
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

      {/* Detail Titles */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Detalhamento por vencimentos</h3>
        </div>
        <div className="divide-y">
          {data.pendingTitles.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(t => (
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
