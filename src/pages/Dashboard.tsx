import { useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, BarChart3, Calculator, TrendingUp, TrendingDown, Percent, Wallet } from 'lucide-react';

import { useSemanticResult } from '@/hooks/finance/useSemanticResult';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { useDashboardEvolution } from '@/hooks/finance/useManagerialDashboard';
import { buildMonthReading } from '@/domain/finance/monthReading';
import { buildMonthProjection, lastDayOfMonthISO } from '@/domain/finance/monthProjection';
import { formatDate } from '@/utils/formatters';

import { KPICard } from '@/components/shared/KPICard';
import { MonthReading } from '@/components/dre/MonthReading';
import { ResultAlerts } from '@/components/dre/ResultAlerts';
import { ProjectionCard } from '@/components/dashboard/ProjectionCard';
import { EvolutionChart } from '@/components/dashboard/EvolutionChart';
import { FinanceSnapshot } from '@/services/finance/financeService';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CardSkeleton = () => (
  <div className="h-[430px] bg-card rounded-xl border border-border/50 shadow-sm animate-pulse" />
);

// Caixa Atual — puramente de contas/movimentos (mesma fonte de antes), sem managerialDashboard.
function computeCaixaAtual(snapshot: FinanceSnapshot, todayISO: string): number {
  let caixa = 0;
  for (const a of snapshot.accounts) {
    const openDate = a.openingBalanceDate || '1970-01-01';
    if (openDate <= todayISO) {
      let bal = a.openingBalance;
      snapshot.movements
        .filter(m => m.accountId === a.id && m.paymentDate >= openDate && m.paymentDate <= todayISO)
        .forEach(m => { bal += m.type === 'entrada' ? m.valuePaid : -m.valuePaid; });
      caixa += bal;
    }
  }
  return caixa;
}

// Gráfico de evolução — mantido por ora (usa managerialDashboard/competência). Decisão futura.
function EvolutionSection({ monthStr }: { monthStr: string }) {
  const { data, isLoading } = useDashboardEvolution(monthStr, true);
  const deferredData = useDeferredValue(data);
  const deferredLoading = useDeferredValue(isLoading);

  if (!deferredData || deferredLoading) return <CardSkeleton />;
  return (
    <div className="animate-fade-in h-full">
      <EvolutionChart evolucao={deferredData.evolucao} evolucaoInsight={deferredData.evolucaoInsight} />
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeWorkspace } = useAuth();

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = `${monthStr}-${String(now.getDate()).padStart(2, '0')}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const { data: result, isLoading } = useSemanticResult(monthStr);
  const { data: prevResult } = useSemanticResult(prevMonthStr);
  const { data: snapshot } = useFinanceSnapshot();

  const mesLabel = MESES[now.getMonth()];

  if (isLoading || !result || !snapshot) {
    return (
      <div className="space-y-8 max-w-7xl">
        <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-[128px] bg-card rounded-xl border border-border/50 shadow-sm animate-pulse" />)}
        </div>
      </div>
    );
  }

  // KPIs (motor semântico)
  const margemPct = result.receitaBruta !== 0 ? result.resultadoOperacional / result.receitaBruta : null;
  const caixaAtual = computeCaixaAtual(snapshot, todayStr);

  // Badge do cabeçalho — pelo sinal do resultado REALIZADO
  const badgeNeg = result.resultadoPeriodo < 0;

  // Leitura do Mês (mês corrente em andamento) + alertas
  const prevHasActivity = !!prevResult && (prevResult.linhas.some(l => l.value !== 0) || prevResult.foraDoResultado.length > 0);
  const monthReading = buildMonthReading(result, prevHasActivity ? prevResult! : null, true);

  // Projeção do mês (aritmética dos previstos)
  const projection = buildMonthProjection(result.resultadoPeriodo, snapshot.titles, monthStr, todayStr);
  const lastDayLabel = formatDate(lastDayOfMonthISO(monthStr));

  return (
    <div className="space-y-8 max-w-7xl">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/60 uppercase tracking-[0.2em]">
            <span>Aurys</span>
            <span className="text-muted-foreground/30">|</span>
            <span>{activeWorkspace?.name || 'Minha Empresa'}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1.5 border ${
              badgeNeg ? 'bg-destructive/5 text-destructive/70 border-destructive/10' : 'bg-positive/5 text-positive/70 border-positive/10'
            }`}>
              <div className={`w-1 h-1 rounded-full ${badgeNeg ? 'bg-destructive/50' : 'bg-positive/50'}`} />
              {badgeNeg ? 'Atenção' : 'Saudável'}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{mesLabel} até agora — valores realizados</p>
        </div>

        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <Button variant="outline" onClick={() => navigate('/dre')} className="gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" /> Ver Análise de Resultado
          </Button>
          <Button variant="outline" onClick={() => navigate('/precificacao')} className="gap-2">
            <Calculator className="w-4 h-4 text-muted-foreground" /> Precificação
          </Button>
          <Button variant="secondary" onClick={() => navigate('/lancar')} className="gap-1.5 ml-2">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Resultado (até agora)"
          value={fmt(result.resultadoPeriodo)}
          icon={result.resultadoPeriodo >= 0 ? TrendingUp : TrendingDown}
          variant="featured"
          onClick={() => navigate('/dre')}
        />
        <KPICard title="Receita Líquida" value={fmt(result.receitaLiquida)} icon={TrendingUp} variant="default" onClick={() => navigate('/dre')} />
        <KPICard
          title="Margem"
          value={margemPct !== null ? (margemPct * 100).toFixed(1) + '%' : '—'}
          subtitle={margemPct === null ? 'Sem receita no período' : undefined}
          icon={Percent}
          variant={margemPct === null ? 'default' : margemPct >= 0.2 ? 'positive' : margemPct > 0 ? 'warning' : 'negative'}
          onClick={() => navigate('/dre')}
        />
        <KPICard title="Caixa Atual" value={fmt(caixaAtual)} icon={Wallet} variant={caixaAtual >= 0 ? 'default' : 'negative'} onClick={() => navigate('/fluxo')} />
      </div>

      {/* PROJEÇÃO DO MÊS */}
      <ProjectionCard projection={projection} lastDayLabel={lastDayLabel} />

      {/* LEITURA DO MÊS + ALERTAS (reancorados no motor semântico) */}
      <MonthReading sentences={monthReading} />
      <ResultAlerts result={result} />

      {/* EVOLUÇÃO */}
      <EvolutionSection monthStr={monthStr} />
    </div>
  );
}
