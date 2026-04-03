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

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
        {isLoading && <div className="w-24 h-6 bg-muted rounded-full animate-pulse" />}
        {!isLoading && statusGeral && (
          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border shadow-sm ${
            statusGeral.status === 'saudavel' ? 'bg-positive/10 text-positive border-positive/20' :
            statusGeral.status === 'atencao' ? 'bg-warning/10 text-warning border-warning/20' :
            'bg-destructive/10 text-destructive border-destructive/20'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              statusGeral.status === 'saudavel' ? 'bg-positive' :
              statusGeral.status === 'atencao' ? 'bg-warning' :
              'bg-destructive'
            }`} />
            {statusGeral.status === 'saudavel' ? 'Saudável' :
             statusGeral.status === 'atencao' ? 'Atenção' : 'Crítico'}
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
        <span>Cockpit Gerencial • Mês atual ({new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })})</span>
        {statusGeral?.message && (
          <>
            <span className="text-muted-foreground/30">•</span>
            <span className="animate-fade-in">{statusGeral.message}</span>
          </>
        )}
      </p>
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
             DRE Completo
          </Button>
          <Button variant="outline" onClick={() => navigate('/precificacao')} className="gap-2">
            <Calculator className="w-4 h-4 text-muted-foreground" />
             Precificação
          </Button>
          <Button onClick={() => navigate('/lancar')} className="gap-1.5 ml-2">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </div>

      {/* RESUMO EXECUTIVO */}
      <SummarySection monthStr={monthStr} />

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
