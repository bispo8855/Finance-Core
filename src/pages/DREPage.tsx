import { useState, Fragment } from 'react';
import { BarChart3, CheckCircle2, AlertTriangle, XCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDRE } from '@/hooks/finance/useDRE';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { MonthYearPicker } from '@/components/shared/MonthYearPicker';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (part: number, total: number) => total === 0 ? '0%' : (part / total * 100).toFixed(1) + '%';

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function DREPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
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
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">Análise de Resultado</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O Aurys interpreta sua DRE e identifica os principais impactos no seu resultado
          </p>
        </div>
      </div>

      {/* Alerta Executivo DRE */}
      {dre.receitaLiquida > 0 || dre.riskState === 'critico' ? (
        <Fragment>
          {dre.riskState === 'saudavel' && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-500 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Resultado do mês é positivo e com despesas controladas.</p>
            </div>
          )}
          {dre.riskState === 'atencao' && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
              <div className="text-sm font-medium text-amber-800 dark:text-amber-400">
                Atenção: A estrutura de despesas fixas está consumindo mais de 80% da receita.
              </div>
            </div>
          )}
          {dre.riskState === 'critico' && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0" />
              <div className="text-sm font-medium text-red-800 dark:text-red-400">
                Atenção: A operação finalizou o mês com prejuízo líquido de <strong>{fmt(dre.resultadoLiquido)}</strong>.
              </div>
            </div>
          )}
        </Fragment>
      ) : null}

      <div className="flex w-full items-center">
        <MonthYearPicker date={currentDate} onChange={setCurrentDate} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Margem de Contribuição</p>
          <p className="text-2xl font-bold text-foreground mt-auto">{(dre.kpis.margemPercentual * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">Rentabilidade após custo variável</p>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Custo Fixo sobre Receita</p>
          <p className="text-2xl font-bold text-foreground mt-auto">{(dre.kpis.despesasFixasPercentual * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">Peso da estrutura no faturamento</p>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Ponto de Equilíbrio</p>
          <p className="text-2xl font-bold text-foreground mt-auto">
            {dre.kpis.breakEven > 0 && dre.receitaLiquida > 0 ? fmt(dre.kpis.breakEven) : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Você precisa faturar isso para empatar</p>
        </div>
      </div>

      {dre.actionPlan && (
        <Card className="mb-4 shadow-sm border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle>Plano de Ação</CardTitle>
            <CardDescription>O que fazer com base no seu resultado</CardDescription>
          </CardHeader>
        
          <CardContent className="space-y-3">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <strong className="text-sm text-primary">Ação principal:</strong>
              <p className="text-sm font-medium mt-1">{dre.actionPlan.primary}</p>
            </div>
        
            {dre.actionPlan.alternative && (
              <div className="bg-muted rounded-lg p-3 border border-border/50">
                <strong className="text-sm text-muted-foreground">Alternativa:</strong>
                <p className="text-sm mt-1">{dre.actionPlan.alternative}</p>
              </div>
            )}
        
            {dre.actionPlan.reasoning && (
              <div className="text-sm text-muted-foreground px-1 pt-1 italic">
                {dre.actionPlan.reasoning}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {dre.diagnostics && dre.diagnostics.length > 0 && (
        <Collapsible className="mb-4">
          <CollapsibleTrigger asChild>
            <button className="flex w-fit items-center gap-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-muted-foreground/30">
              Ver análise detalhada
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-muted/10">
                <h3 className="font-semibold text-base">Diagnóstico Estrutural</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Leitura rápida dos resultados do mês</p>
              </div>
              <div className="p-4 space-y-3">
                {dre.diagnostics.map((diag, idx) => (
                  <div key={idx} className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    diag.type === 'positive' && "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300",
                    diag.type === 'warning' && "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-300",
                    diag.type === 'negative' && "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30 text-red-800 dark:text-red-300"
                  )}>
                    {diag.type === 'positive' && <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-500" />}
                    {diag.type === 'warning' && <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />}
                    {diag.type === 'negative' && <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-500" />}
                    <p className="text-sm font-medium leading-relaxed">{diag.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b">
          <h3 className="font-semibold">{months[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
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
        {dre.top5Insight && (
          <div className="px-4 pt-4 pb-1">
            <div className="bg-muted/40 p-3 rounded-lg border border-border/50 flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
              <p className="text-sm font-medium text-muted-foreground">{dre.top5Insight}</p>
            </div>
          </div>
        )}
        <div className="p-4 space-y-3 pt-3">
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
