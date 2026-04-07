import { AlertTriangle, Info, ShieldAlert, Target, TrendingUp, Lightbulb } from 'lucide-react';
import { ManagerialAlert } from '@/domain/finance/managerialDashboard';
import { useNavigate } from 'react-router-dom';
import { navigateToCashFlow, navigateToReceivables, navigateToPayables, navigateToDRE, navigateToLaunch } from '@/utils/navigation';

interface ManagerialAlertsProps {
  alertas: ManagerialAlert[];
  insights: string[];
}

export function ManagerialAlerts({ alertas, insights }: ManagerialAlertsProps) {
  const navigate = useNavigate();

  if (alertas.length === 0 && insights.length === 0) return null;

  const handleAlertClick = (id: string) => {
    if (id === 'risco_caixa_critico') navigateToCashFlow(navigate);
    else if (id === 'inadimplencia_alta') navigateToReceivables(navigate, 'atrasado');
    else if (id === 'contas_vencidas') navigateToPayables(navigate, 'vencido');
    else navigateToDRE(navigate);
  };

  const handleInsightClick = (insightText: string) => {
    const text = insightText.toLowerCase();
    if (text.includes('registre') || text.includes('lançamentos')) navigateToLaunch(navigate);
    else if (text.includes('caixa')) navigateToCashFlow(navigate);
    else navigateToDRE(navigate);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Insights do Aurys (Alertas) */}
      <div className="lg:col-span-2 space-y-4">
        {alertas.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-muted-foreground/70 uppercase tracking-widest px-1">Insights do Aurys</h3>
            <div className="space-y-2">
              {alertas.map((alert) => {
                let bg = "bg-white border-border/40 shadow-sm";
                let text = "text-foreground";
                let iconColor = "text-muted-foreground";
                let Icon = Info;
                
                if (alert.type === 'critico') {
                  bg = "bg-destructive/5 border-destructive/10 shadow-sm";
                  text = "text-destructive font-semibold";
                  iconColor = "text-destructive/70";
                  Icon = ShieldAlert;
                } else if (alert.type === 'atencao') {
                  bg = "bg-warning/5 border-warning/10 shadow-sm";
                  text = "text-warning-foreground font-semibold";
                  iconColor = "text-warning/70";
                  Icon = AlertTriangle;
                }

                return (
                  <div key={alert.id} onClick={() => handleAlertClick(alert.id)} className={`flex gap-3 p-3 rounded-xl border items-center animate-fade-in group cursor-pointer hover:bg-muted/30 transition-all ${bg}`}>
                    <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${text}`}>
                        {alert.title}
                      </p>
                      {alert.description && (
                        <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate">
                          {alert.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Oportunidades - Right Side (1 col) */}
      <div className="space-y-4">
        {insights.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-muted-foreground/70 uppercase tracking-widest px-1">Oportunidades</h3>
            <div className="bg-white/50 border border-border/40 shadow-sm rounded-2xl p-5 space-y-4">
              {insights.map((insight, idx) => {
                const isPositive = insight.includes('saudável') || insight.includes('eficiência') || insight.includes('escala');
                return (
                  <div key={idx} onClick={() => handleInsightClick(insight)} className="flex gap-3 group cursor-pointer hover:bg-muted/10 transition-colors rounded p-1 -m-1">
                    <div className={`p-1.5 rounded-lg h-fit transition-colors ${isPositive ? 'bg-positive/10 text-positive' : 'bg-primary/10 text-primary'}`}>
                      {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <Lightbulb className="w-3.5 h-3.5" />}
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground group-hover:text-foreground transition-all">
                      {insight}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
