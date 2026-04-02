import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, BarChart3, Calculator } from 'lucide-react';
import { useManagerialDashboard } from '@/hooks/finance/useManagerialDashboard';

import { ExecutiveSummary } from '@/components/dashboard/ExecutiveSummary';
import { ManagerialAlerts } from '@/components/dashboard/ManagerialAlerts';
import { ExecutiveDrivers } from '@/components/dashboard/ExecutiveDrivers';
import { EvolutionChart } from '@/components/dashboard/EvolutionChart';

export default function Dashboard() {
  const navigate = useNavigate();

  const todayStr = new Date().toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);

  const { data: kpis, isLoading } = useManagerialDashboard(monthStr);

  if (isLoading || !kpis) {
    return <div className="p-8 text-center text-muted-foreground">Carregando cockpit...</div>;
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
            {kpis && (
              <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border shadow-sm ${
                kpis.statusGeral.status === 'saudavel' ? 'bg-positive/10 text-positive border-positive/20' :
                kpis.statusGeral.status === 'atencao' ? 'bg-warning/10 text-warning border-warning/20' :
                'bg-destructive/10 text-destructive border-destructive/20'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  kpis.statusGeral.status === 'saudavel' ? 'bg-positive' :
                  kpis.statusGeral.status === 'atencao' ? 'bg-warning' :
                  'bg-destructive'
                }`} />
                {kpis.statusGeral.status === 'saudavel' ? 'Saudável' :
                 kpis.statusGeral.status === 'atencao' ? 'Atenção' : 'Crítico'}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <span>Cockpit Gerencial • Mês atual ({new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })})</span>
            <span className="text-muted-foreground/30">•</span>
            <span>{kpis?.statusGeral.message}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
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
      <ExecutiveSummary 
        receitaLiquida={kpis.receitaLiquida}
        resultadoLiquido={kpis.resultadoLiquido}
        margem={kpis.margem}
        caixaAtual={kpis.caixaAtual}
      />

      {/* ALERTS & INSIGHTS */}
      <ManagerialAlerts 
        alertas={kpis.alertas}
        insights={kpis.insights}
      />

      {/* DRIVERS & EVOLUCAO */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <EvolutionChart evolucao={kpis.evolucao} evolucaoInsight={kpis.evolucaoInsight} />
        <ExecutiveDrivers drivers={kpis.drivers} />
      </div>

    </div>
  );
}
