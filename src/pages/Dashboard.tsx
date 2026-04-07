import { useState, useEffect, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, BarChart3, Calculator } from 'lucide-react';
import { 
  useDashboardSummary, 
  useDashboardAlerts, 
  useDashboardDrivers, 
  useDashboardEvolution 
} from '@/hooks/finance/useManagerialDashboard';

import { ExecutiveSummary } from '@/components/dashboard/ExecutiveSummary';
import { ManagerialAlerts } from '@/components/dashboard/ManagerialAlerts';
import { ExecutiveDrivers } from '@/components/dashboard/ExecutiveDrivers';
import { EvolutionChart } from '@/components/dashboard/EvolutionChart';
import { AurysRecommendationsPanel } from '@/components/dashboard/AurysRecommendationsPanel';
import { useRecommendations } from '@/hooks/finance/useRecommendations';
import { Lightbulb, Target, ShieldCheck } from 'lucide-react';

const SummarySkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="h-[128px] bg-card rounded-xl border border-border/50 shadow-sm animate-pulse" />
    ))}
  </div>
);

const AlertsSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2 space-y-4">
      <div className="h-[20px] w-[150px] bg-muted rounded animate-pulse" />
      <div className="h-[80px] bg-card rounded-xl border border-border/50 shadow-sm animate-pulse" />
      <div className="h-[80px] bg-card rounded-xl border border-border/50 shadow-sm animate-pulse" />
    </div>
    <div className="space-y-4">
      <div className="h-[20px] w-[150px] bg-muted rounded animate-pulse" />
      <div className="h-[176px] bg-card rounded-xl border border-border/50 shadow-sm animate-pulse" />
    </div>
  </div>
);

const CardSkeleton = () => (
  <div className="h-[430px] bg-card rounded-xl border border-border/50 shadow-sm animate-pulse" />
);

function DashboardHeader({ monthStr }: { monthStr: string }) {
  const { data, isLoading } = useDashboardSummary(monthStr);
  const statusGeral = data?.statusGeral;
  const mainInsight = data?.insights && data.insights.length > 0 ? data.insights[0] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/60 uppercase tracking-[0.2em]">
          <span>Aurys</span>
          <span className="text-muted-foreground/30">|</span>
          <span>Minha Empresa</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
          {!isLoading && statusGeral && (
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1.5 border transition-all ${
              statusGeral.status === 'saudavel' ? 'bg-positive/5 text-positive/70 border-positive/10' :
              statusGeral.status === 'atencao' ? 'bg-warning/5 text-warning/70 border-warning/10' :
              'bg-destructive/5 text-destructive/70 border-destructive/10'
            }`}>
              <div className={`w-1 h-1 rounded-full ${
                statusGeral.status === 'saudavel' ? 'bg-positive/50' :
                statusGeral.status === 'atencao' ? 'bg-warning/50' :
                'bg-destructive/50'
              }`} />
              {statusGeral.status === 'saudavel' ? 'Saudável' :
               statusGeral.status === 'atencao' ? 'Atenção' : 'Crítico'}
            </div>
          )}
        </div>
      </div>

      {!isLoading && statusGeral && (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 border border-border/40 animate-in fade-in slide-in-from-top-2 duration-700">
          <div className="bg-primary/10 p-1.5 rounded-lg shrink-0">
            <Lightbulb className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">
              {mainInsight ? 'Insight do Aurys' : (statusGeral.status === 'saudavel' ? 'Análise estratégica' : 'Observação importante')}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              {mainInsight ? `"${mainInsight}"` : (statusGeral.message || 'O Aurys precisa de mais dados para gerar análises específicas.')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SummarySection({ monthStr }: { monthStr: string }) {
  const { data, isLoading } = useDashboardSummary(monthStr);
  if (isLoading || !data) return <SummarySkeleton />;
  return <div className="animate-fade-in"><ExecutiveSummary {...data} /></div>;
}

function AlertsSection({ monthStr }: { monthStr: string }) {
  const { data, isLoading } = useDashboardAlerts(monthStr);
  if (isLoading || !data) return <AlertsSkeleton />;
  return <div className="animate-fade-in"><ManagerialAlerts alertas={data.alertas} insights={data.insights} /></div>;
}

function RecommendationsSection({ monthStr }: { monthStr: string }) {
  const { recommendations, isLoading } = useRecommendations(monthStr);
  return <div className="animate-fade-in"><AurysRecommendationsPanel recommendations={recommendations} isLoading={isLoading} /></div>;
}

function DriversSection({ monthStr }: { monthStr: string }) {
  const { data, isLoading } = useDashboardDrivers(monthStr);
  if (isLoading || !data) return <CardSkeleton />;
  return <div className="animate-fade-in"><ExecutiveDrivers drivers={data.drivers} /></div>;
}

function EvolutionSection({ monthStr }: { monthStr: string }) {
  const { data, isLoading } = useDashboardEvolution(monthStr, true);
  // Defer rendering of the heavy chart to low priority
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
  const todayStr = new Date().toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);

  return (
    <div className="space-y-8 max-w-7xl">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <DashboardHeader monthStr={monthStr} />
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <Button variant="outline" onClick={() => navigate('/dre')} className="gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
             Ver Análise de Resultado
          </Button>
          <Button variant="outline" onClick={() => navigate('/precificacao')} className="gap-2">
            <Calculator className="w-4 h-4 text-muted-foreground" />
             Precificação
          </Button>
          <Button variant="secondary" onClick={() => navigate('/lancar')} className="gap-1.5 ml-2">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </div>

      {/* RESUMO EXECUTIVO */}
      <SummarySection monthStr={monthStr} />

      {/* RECOMENDAÇÕES DO AURYS (DECISION ENGINE) */}
      <RecommendationsSection monthStr={monthStr} />

      {/* ALERTS & INSIGHTS */}
      <AlertsSection monthStr={monthStr} />

      {/* DRIVERS & EVOLUCAO */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        <EvolutionSection monthStr={monthStr} />
        <DriversSection monthStr={monthStr} />
      </div>

    </div>
  );
}
