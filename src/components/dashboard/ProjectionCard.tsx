import { TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MonthProjection } from '@/domain/finance/monthProjection';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ProjectionCard({ projection, lastDayLabel }: { projection: MonthProjection; lastDayLabel: string }) {
  const { projecao, aReceberPrevisto, aPagarPrevisto } = projection;

  return (
    <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-6 shadow-sm animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Projeção do mês</p>
          <p className={cn('text-2xl font-bold', projecao < 0 ? 'text-negative' : 'text-positive')}>{fmt(projecao)}</p>
          <p className="text-xs text-muted-foreground">Considera os lançamentos previstos até {lastDayLabel}.</p>
        </div>
        <div className="rounded-lg p-2 bg-primary/10 text-primary shrink-0">
          <TrendingUp className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <ArrowUpRight className="w-3.5 h-3.5 text-positive" />
          a receber <span className="font-semibold text-foreground tabular-nums">{fmt(aReceberPrevisto)}</span>
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <ArrowDownRight className="w-3.5 h-3.5 text-negative" />
          a pagar <span className="font-semibold text-foreground tabular-nums">{fmt(aPagarPrevisto)}</span>
        </span>
      </div>
    </div>
  );
}
