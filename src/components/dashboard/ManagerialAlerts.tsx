import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
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
      
      {/* Alertas - Left Side (2 cols) */}
      <div className="lg:col-span-2 space-y-4">
        {alertas.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Atenção Necessária</h3>
            <div className="space-y-3">
              {alertas.map((alert) => {
                let bg = "bg-secondary";
                let text = "text-secondary-foreground";
                let Icon = Info;
                
                if (alert.type === 'critico') {
                  bg = "bg-destructive/10 border-destructive border-2";
                  text = "text-destructive font-bold";
                  Icon = ShieldAlert;
                } else if (alert.type === 'atencao') {
                  bg = "bg-warning/10 border-warning/30";
                  text = "text-warning-foreground font-medium";
                  Icon = AlertTriangle;
                }

                return (
                  <div key={alert.id} onClick={() => handleAlertClick(alert.id)} className={`flex gap-3 p-4 rounded-xl border items-start animate-fade-in group cursor-pointer hover:bg-muted/50 transition-colors ${bg}`}>
                    <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${text}`} />
                    <div className="flex-1 space-y-0.5">
                      <p className={`text-sm ${text}`}>{alert.title}</p>
                      <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{alert.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Insights - Right Side (1 col) */}
      <div className="space-y-4">
        {insights.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Insights Executivos</h3>
            <div className="bg-card border shadow-sm rounded-xl p-5 space-y-4">
              {insights.map((insight, idx) => (
                <div key={idx} onClick={() => handleInsightClick(insight)} className="flex gap-2 group cursor-pointer hover:bg-muted/10 transition-colors rounded p-1 -m-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <p className="text-sm leading-relaxed text-foreground group-hover:text-primary transition-colors">{insight}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
