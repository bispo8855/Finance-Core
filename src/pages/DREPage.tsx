import { useState } from 'react';
import { BarChart3, ShieldCheck, AlertCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticResult } from '@/hooks/finance/useSemanticResult';
import { useSemanticAccrualResult } from '@/hooks/finance/useSemanticAccrualResult';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { ResultBasis } from '@/domain/finance/recognitionMeta';
import { MonthYearPicker } from '@/components/shared/MonthYearPicker';
import { ResultAlerts } from '@/components/dre/ResultAlerts';
import { ResultLineDetailSheet, DetailItem } from '@/components/dre/ResultLineDetailSheet';
import { MonthReading } from '@/components/dre/MonthReading';
import { buildMonthReading } from '@/domain/finance/monthReading';
import { contributionMarginPct, resultBannerText } from '@/domain/finance/resultKpi';

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
  const [sheet, setSheet] = useState<{ title: string; total?: number; items: DetailItem[] } | null>(null);
  // Base ativa da página. Realizado é o PADRÃO (C2 §8.1).
  const [basis, setBasis] = useState<ResultBasis>('realized');

  const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  // Mês anterior (trata janeiro → dezembro do ano anterior). Snapshot é cacheado: sem request extra.
  const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const realized = useSemanticResult(monthStr);
  const accrual = useSemanticAccrualResult(monthStr); // reusa a key ['finance','snapshot'] — sem fetch extra
  const { data: prevResult } = useSemanticResult(prevMonthStr);
  const { data: snapshot } = useFinanceSnapshot();

  const isAccrual = basis === 'accrual';
  const result = isAccrual ? accrual.data : realized.data;
  const isLoading = isAccrual ? accrual.isLoading : realized.isLoading;

  const BasisToggle = () => (
    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {([
        { id: 'realized' as ResultBasis, label: 'Realizado' },
        { id: 'accrual' as ResultBasis, label: 'Econômico' },
      ]).map(opt => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setBasis(opt.id)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            basis === opt.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  if (isLoading || !result) {
    return (
      <div className="space-y-6 max-w-3xl">
        <BasisToggle />
        <div className="p-8 text-center text-muted-foreground">Calculando resultado...</div>
      </div>
    );
  }

  // KPIs recalculados a partir do motor novo (com proteção contra divisão por zero).
  // margemPct é null quando a receita líquida não é positiva → card mostra "—"
  // (e o ponto de equilíbrio, que depende dela, também).
  const margemPct = contributionMarginPct(result.receitaLiquida, result.margemContribuicao);
  const despesasPct = result.receitaLiquida > 0 ? Math.abs(result.despesasOperacionais) / result.receitaLiquida : null;
  const breakEven = margemPct !== null && margemPct > 0 ? Math.abs(result.despesasOperacionais) / margemPct : null;

  // Leitura do Mês — narrativa do REALIZADO. Calculada sempre a partir de realized.data
  // (nunca do accrual) e renderizada só na base Realizado (C2 §7 R1).
  const prevHasActivity = !!prevResult && (prevResult.linhas.some(l => l.value !== 0) || prevResult.foraDoResultado.length > 0);
  const now = new Date();
  const isCurrentMonth = monthStr === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthReading = realized.data
    ? buildMonthReading(realized.data, prevHasActivity ? prevResult! : null, isCurrentMonth)
    : [];

  // Banner de resultado — texto ciente de mês corrente × fechado (helper puro).
  const banner = resultBannerText(result.resultadoPeriodo, isCurrentMonth);

  // Estado vazio: nenhuma linha com valor e nada fora do resultado
  const allLinesZero = result.linhas.every(l => l.value === 0);
  const isEmpty = allLinesZero && result.foraDoResultado.length === 0;
  // Diferencia "nada no mês" de "há lançamentos previstos, mas nada realizado ainda".
  // Calculado na página (não no motor) para não alterar o contrato do SemanticResult.
  const hasDocumentsInMonth = snapshot?.documents.some(d => d.competenceDate.startsWith(monthStr)) ?? false;

  // Agrupamento dos itens fora do resultado (contagem/soma; drill-down por reason abaixo)
  const foraAgrupado = result.foraDoResultado.reduce<Record<string, { count: number; total: number }>>((acc, item) => {
    const key = item.reason;
    if (!acc[key]) acc[key] = { count: 0, total: 0 };
    acc[key].count += 1;
    acc[key].total += Math.abs(item.amount);
    return acc;
  }, {});

  // Itens por linha da cascata (para o drill-down)
  const itemsByKey = new Map<string, DetailItem[]>(result.linhas.map((l) => [l.key, l.items as DetailItem[]]));
  const itemsFor = (key: string): DetailItem[] => itemsByKey.get(key) ?? [];

  const DRERow = ({ label, value, bold, result: isResult, indent, items, drillTitle }: {
    label: string; value: number; bold?: boolean; result?: boolean; indent?: boolean;
    items?: DetailItem[]; drillTitle?: string;
  }) => {
    const clickable = !!items && items.length > 0;
    return (
      <div
        className={cn(
          'flex items-center justify-between py-2.5 px-4',
          bold && 'font-bold',
          isResult && 'bg-muted/50 rounded-lg',
          indent && 'pl-8',
          clickable && 'cursor-pointer hover:bg-muted/40 rounded-lg transition-colors',
        )}
        onClick={clickable ? () => setSheet({ title: drillTitle ?? label, total: value, items: items! }) : undefined}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
      >
        <span className={cn('text-sm flex items-center gap-1.5', indent && 'text-muted-foreground')}>
          {label}
          {clickable && <ChevronRight className="w-3.5 h-3.5 opacity-40" />}
        </span>
        <div className="flex items-center gap-4">
          {/* Valor já vem assinado do motor — NÃO multiplicar por -1 */}
          <span className={cn('text-sm font-medium tabular-nums', value < 0 ? 'text-negative' : value > 0 ? 'text-positive' : '')}>{fmt(value)}</span>
          <span className="text-xs text-muted-foreground w-14 text-right tabular-nums">{pctOf(value, result.receitaBruta)}</span>
        </div>
      </div>
    );
  };

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

      {/* Toggle de base — ABAIXO do cabeçalho (C2 §10.2). Realizado é o padrão. */}
      <BasisToggle />

      {/* Banner de resultado — texto do helper puro; moeda e cores ficam aqui.
          Resultado zero → banner ausente. */}
      {banner?.tone === 'positive' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-500 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
            {banner.template.split('{X}')[0]}
            <strong>{fmt(banner.amount)}</strong>
            {banner.template.split('{X}')[1]}
          </p>
        </div>
      )}
      {banner?.tone === 'negative' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0" />
          <p className="text-sm font-medium text-red-800 dark:text-red-400">
            {banner.template.split('{X}')[0]}
            <strong>{fmt(banner.amount)}</strong>
            {banner.template.split('{X}')[1]}
          </p>
        </div>
      )}

      <div className="flex w-full items-center">
        <MonthYearPicker date={currentDate} onChange={setCurrentDate} />
      </div>

      {/* Alertas de qualidade — SÓ na base Realizado (C2 §7 R1: o gap caixa×resultado
          não faz sentido no accrual, onde affectsCash é sempre false). */}
      {!isAccrual && <ResultAlerts result={result} />}

      {isEmpty ? (
        <div className="bg-card rounded-xl border shadow-sm p-10 text-center text-muted-foreground">
          {isAccrual
            ? 'Nenhum fato econômico reconhecido neste período pela data de competência.'
            : hasDocumentsInMonth
              ? 'Existem lançamentos neste período, mas nenhum valor foi realizado ainda. O Resultado Realizado considera apenas movimentações efetivamente pagas ou recebidas.'
              : 'Nenhum evento realizado neste período.'}
        </div>
      ) : (
        <>
          {/* Leitura do Mês — narrativa do Realizado; oculta no Econômico (C2 §7 R1) */}
          {!isAccrual && <MonthReading sentences={monthReading} />}

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
              <DRERow label="Receita Bruta" value={result.receitaBruta} bold items={itemsFor('receitaBruta')} drillTitle="Receita Bruta" />
              <DRERow label="(-) Estornos / Chargebacks" value={result.estornosChargebacks} indent items={itemsFor('estornosChargebacks')} drillTitle="Estornos / Chargebacks" />
              <DRERow label="(-) Taxas e Deduções de Venda" value={result.taxasDeducoesVenda} indent items={itemsFor('taxasDeducoesVenda')} drillTitle="Taxas e Deduções de Venda" />
              <DRERow label="(=) Receita Líquida" value={result.receitaLiquida} result />
              <DRERow label="(-) Custos Variáveis" value={result.custosVariaveis} indent items={itemsFor('custosVariaveis')} drillTitle="Custos Variáveis" />
              <DRERow label="(=) Margem de Contribuição" value={result.margemContribuicao} result />
              <DRERow label="(-) Despesas Operacionais" value={result.despesasOperacionais} indent items={itemsFor('despesasOperacionais')} drillTitle="Despesas Operacionais" />
              <DRERow label="(=) Resultado Operacional" value={result.resultadoOperacional} result bold />
              <DRERow label="(+/-) Resultado Financeiro" value={result.resultadoFinanceiro} indent items={itemsFor('resultadoFinanceiro')} drillTitle="Resultado Financeiro" />
              <DRERow label="(+/-) Outros" value={result.outros} indent items={itemsFor('outros')} drillTitle="Outros" />
              <DRERow label="(=) Resultado do Período" value={result.resultadoPeriodo} result bold />
            </div>
          </div>

          {/* Transparência: itens que ficam fora do resultado (com drill-down por motivo) */}
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
                {Object.entries(foraAgrupado).map(([reason, agg]) => {
                  const items = result.foraDoResultado.filter(f => f.reason === reason) as DetailItem[];
                  const signedTotal = items.reduce((s, i) => s + i.amount, 0);
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSheet({ title: EXCLUSION_LABELS[reason] || reason, total: signedTotal, items })}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md hover:bg-muted/40 transition-colors text-left"
                    >
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        {EXCLUSION_LABELS[reason] || reason}
                        <span className="text-xs text-muted-foreground/70">({agg.count})</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                      </span>
                      <span className="tabular-nums text-muted-foreground">{fmt(agg.total)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <ResultLineDetailSheet
        open={!!sheet}
        onOpenChange={(o) => { if (!o) setSheet(null); }}
        title={sheet?.title ?? ''}
        total={sheet?.total}
        items={sheet?.items ?? []}
      />
    </div>
  );
}
