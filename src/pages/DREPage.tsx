import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDRE } from '@/hooks/finance/useDRE';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const pct = (part: number, total: number) => total === 0 ? '0%' : (part / total * 100).toFixed(1) + '%';

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function DREPage() {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState(currentMonth);
  const [year] = useState(currentYear);

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const { data: dre, isLoading } = useDRE(monthStr);

  if (isLoading || !dre) {
    return <div className="p-8 text-center text-muted-foreground">Calculando DRE...</div>;
  }

  const DRERow = ({ label, value, bold, result, indent }: { label: string; value: number; bold?: boolean; result?: boolean; indent?: boolean }) => (
    <div className={cn(
      'flex items-center justify-between py-2.5 px-4',
      bold && 'font-bold',
      result && 'bg-muted/50 rounded-lg',
      indent && 'pl-8',
    )}>
      <span className={cn('text-sm', indent && 'text-muted-foreground')}>{label}</span>
      <div className="flex items-center gap-4">
        <span className={cn('text-sm font-medium tabular-nums', value < 0 ? 'text-negative' : value > 0 ? 'text-positive' : '')}>{fmt(value)}</span>
        <span className="text-xs text-muted-foreground w-14 text-right tabular-nums">{pct(Math.abs(value), dre.receitaBruta || 1)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">DRE — Demonstrativo de Resultado</h1>
          <p className="text-sm text-muted-foreground">Resultado por competência</p>
        </div>
      </div>

      <div className="flex gap-1 bg-muted rounded-lg p-0.5 overflow-x-auto w-fit">
        {months.map((m, i) => (
          <button key={i} onClick={() => setMonth(i)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${month === i ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {m.substring(0, 3)}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b">
          <h3 className="font-semibold">{months[month]} {year}</h3>
        </div>
        <div className="p-2 space-y-0.5">
          <DRERow label="Receita Bruta" value={dre.receitaBruta} bold />
          <DRERow label="(-) Deduções / Impostos" value={-dre.deducoes} indent />
          <DRERow label="(=) Receita Líquida" value={dre.receitaLiquida} result />
          <DRERow label="(-) Custos Variáveis" value={-dre.custosVariaveis} indent />
          <DRERow label="(=) Margem de Contribuição" value={dre.margemContribuicao} result />
          <DRERow label="(-) Despesas Fixas" value={-dre.despesasFixas} indent />
          <DRERow label="(=) Resultado Operacional" value={dre.resultadoOperacional} result bold />
          <DRERow label="(-) Financeiro (juros/tarifas)" value={-dre.financeiro} indent />
          <DRERow label="(=) Resultado Líquido" value={dre.resultadoLiquido} result bold />
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Top 5 gastos por categoria</h3>
        </div>
        <div className="p-4 space-y-3">
          {dre.top5.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum gasto no período.</p>
          ) : dre.top5.map((item, i) => {
            const maxVal = dre.top5[0].value;
            const widthPct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
            return (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="font-medium">{fmt(item.value)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-destructive/60 rounded-full transition-all" style={{ width: `${widthPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
