import { useState } from 'react';
import { BarChart3, ShieldCheck, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticResult } from '@/hooks/finance/useSemanticResult';
import { MonthYearPicker } from '@/components/shared/MonthYearPicker';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctOf = (part: number, total: number) => total === 0 ? '—' : (Math.abs(part) / Math.abs(total) * 100).toFixed(1) + '%';

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Rótulos amigáveis para os motivos de exclusão (transparência, sem drill-down aqui)
const EXCLUSION_LABELS: Record<string, string> = {
  internal_transfer: 'Transferências',
  reserve: 'Reservas / retenções',
  pending: 'Pendentes de classificação',
  unclassified: 'Sem classificação',
  financial_movement: 'Movimentações financeiras (cartão, etc.)',
  investimento: 'Investimentos',
  categoria_nao_resolvida: 'Sem categoria confiável',
  affects_result_false: 'Sem impacto no resultado',
  low_confidence: 'Baixa confiança (revisão)',
};

export default function DREPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const { data: result, isLoading } = useSemanticResult(monthStr);

  if (isLoading || !result) {
    return <div className="p-8 text-center text-muted-foreground">Calculando resultado...</div>;
  }

  // KPIs recalculados a partir do motor novo (com proteção contra divisão por zero)
  const margemPct = result.receitaLiquida !== 0 ? result.margemContribuicao / result.receitaLiquida : null;
  const despesasPct = result.receitaLiquida > 0 ? Math.abs(result.despesasOperacionais) / result.receitaLiquida : null;
  const breakEven = margemPct !== null && margemPct > 0 ? Math.abs(result.despesasOperacionais) / margemPct : null;

  // Estado vazio: nenhuma linha com valor e nada fora do resultado
  const allLinesZero = result.linhas.every(l => l.value === 0);
  const isEmpty = allLinesZero && result.foraDoResultado.length === 0;

  // Agrupamento dos itens fora do resultado (só contagem e soma — drill-down é Etapa 3)
  const foraAgrupado = result.foraDoResultado.reduce<Record<string, { count: number; total: number }>>((acc, item) => {
    const key = item.reason;
    if (!acc[key]) acc[key] = { count: 0, total: 0 };
    acc[key].count += 1;
    acc[key].total += Math.abs(item.amount);
    return acc;
  }, {});

  const DRERow = ({ label, value, bold, result: isResult, indent }: {
    label: string; value: number; bold?: boolean; result?: boolean; indent?: boolean;
  }) => (
    <div className={cn(
      'flex items-center justify-between py-2.5 px-4',
      bold && 'font-bold',
      isResult && 'bg-muted/50 rounded-lg',
      indent && 'pl-8',
    )}>
      <span className={cn('text-sm', indent && 'text-muted-foreground')}>{label}</span>
      <div className="flex items-center gap-4">
        {/* Valor já vem assinado do motor — NÃO multiplicar por -1 */}
        <span className={cn('text-sm font-medium tabular-nums', value < 0 ? 'text-negative' : value > 0 ? 'text-positive' : '')}>{fmt(value)}</span>
        <span className="text-xs text-muted-foreground w-14 text-right tabular-nums">{pctOf(value, result.receitaBruta)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-accent-foreground" />
        </div>
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">{result.meta.label}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{result.meta.microcopy}</p>
        </div>
      </div>

      {/* Banner simples de resultado (riskState/Plano/Diagnóstico voltam na Etapa 3) */}
      {result.resultadoPeriodo > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-500 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
            Resultado do período positivo de <strong>{fmt(result.resultadoPeriodo)}</strong>.
          </p>
        </div>
      )}
      {result.resultadoPeriodo < 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0" />
          <p className="text-sm font-medium text-red-800 dark:text-red-400">
            O período fechou com prejuízo de <strong>{fmt(Math.abs(result.resultadoPeriodo))}</strong>.
          </p>
        </div>
      )}

      <div className="flex w-full items-center">
        <MonthYearPicker date={currentDate} onChange={setCurrentDate} />
      </div>

      {isEmpty ? (
        <div className="bg-card rounded-xl border shadow-sm p-10 text-center text-muted-foreground">
          Nenhum evento realizado neste período.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Margem de Contribuição</p>
              <p className="text-2xl font-bold text-foreground mt-auto">{margemPct !== null ? (margemPct * 100).toFixed(1) + '%' : '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">Rentabilidade após custo variável</p>
            </div>
            <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Despesas Op. sobre Receita</p>
              <p className="text-2xl font-bold text-foreground mt-auto">{despesasPct !== null ? (despesasPct * 100).toFixed(1) + '%' : '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">Peso da estrutura no faturamento</p>
            </div>
            <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Ponto de Equilíbrio</p>
              <p className="text-2xl font-bold text-foreground mt-auto">{breakEven !== null ? fmt(breakEven) : '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">Você precisa faturar isso para empatar</p>
            </div>
          </div>

          <div className="bg-card rounded-xl border shadow-sm">
            <div className="p-4 border-b">
              <h3 className="font-semibold">{months[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
            </div>
            <div className="p-2 space-y-0.5">
              <DRERow label="Receita Bruta" value={result.receitaBruta} bold />
              <DRERow label="(-) Estornos / Chargebacks" value={result.estornosChargebacks} indent />
              <DRERow label="(-) Taxas e Deduções de Venda" value={result.taxasDeducoesVenda} indent />
              <DRERow label="(=) Receita Líquida" value={result.receitaLiquida} result />
              <DRERow label="(-) Custos Variáveis" value={result.custosVariaveis} indent />
              <DRERow label="(=) Margem de Contribuição" value={result.margemContribuicao} result />
              <DRERow label="(-) Despesas Operacionais" value={result.despesasOperacionais} indent />
              <DRERow label="(=) Resultado Operacional" value={result.resultadoOperacional} result bold />
              <DRERow label="(+/-) Resultado Financeiro" value={result.resultadoFinanceiro} indent />
              <DRERow label="(+/-) Outros" value={result.outros} indent />
              <DRERow label="(=) Resultado do Período" value={result.resultadoPeriodo} result bold />
            </div>
          </div>

          {/* Transparência: itens que ficam fora do resultado (sem drill-down — Etapa 3) */}
          {result.foraDoResultado.length > 0 && (
            <div className="bg-card rounded-xl border shadow-sm">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-sm">
                  {result.foraDoResultado.length} movimentaç{result.foraDoResultado.length === 1 ? 'ão' : 'ões'} não entra{result.foraDoResultado.length === 1 ? '' : 'm'} neste resultado
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Transferências, reservas, pendentes ou sem categoria — preservadas, mas fora do resultado do período.
                </p>
              </div>
              <div className="p-3 space-y-1">
                {Object.entries(foraAgrupado).map(([reason, agg]) => (
                  <div key={reason} className="flex items-center justify-between px-2 py-1.5 text-sm">
                    <span className="text-muted-foreground">
                      {EXCLUSION_LABELS[reason] || reason}
                      <span className="ml-2 text-xs text-muted-foreground/70">({agg.count})</span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">{fmt(agg.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
