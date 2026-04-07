import { useNavigate } from 'react-router-dom';
import { Recommendation } from '@/types/recommendations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lightbulb, Settings, ArrowRight, ShieldCheck, TrendingUp, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AurysRecommendationsPanelProps {
  recommendations: Recommendation[];
  isLoading?: boolean;
}

const typeConfig = {
  risk: {
    icon: AlertTriangle,
    color: 'text-negative',
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-100 dark:border-red-900/30'
  },
  opportunity: {
    icon: Lightbulb,
    color: 'text-primary',
    bg: 'bg-primary/5',
    border: 'border-primary/10'
  },
  efficiency: {
    icon: Settings,
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
    border: 'border-border'
  }
};

const areaIcons = {
  caixa: Wallet,
  resultado: TrendingUp,
  margem: ShieldCheck
};

export function AurysRecommendationsPanel({ recommendations, isLoading }: AurysRecommendationsPanelProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground/70 uppercase tracking-widest pl-1">Recomendações do Aurys</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-xl border border-border/50" />
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  const handleAction = (rec: Recommendation) => {
    if (!rec.action.targetPath) return;
    
    let path = rec.action.targetPath;
    if (rec.action.queryParams) {
      const params = new URLSearchParams(rec.action.queryParams);
      path += `?${params.toString()}`;
    }
    
    navigate(path);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-700">
      <div className="flex items-center gap-2 pl-1 text-primary">
        <ShieldCheck className="w-4 h-4" />
        <h2 className="text-sm font-semibold text-muted-foreground/70 uppercase tracking-widest">Recomendações do Aurys</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recommendations.map((rec) => {
          const config = typeConfig[rec.type];
          const AreaIcon = areaIcons[rec.impact.area];
          
          return (
            <Card key={rec.id} className={cn(
              "flex flex-col h-full border overflow-hidden hover:shadow-md transition-all duration-300 group",
              config.border
            )}>
              <CardContent className="p-5 flex flex-col h-full space-y-4">
                {/* Header: Type & Title */}
                <div className="flex items-start justify-between gap-3">
                  <div className={cn("p-1.5 rounded-lg shrink-0", config.bg)}>
                    <config.icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground leading-tight">{rec.title}</h3>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {rec.description}
                </p>

                {/* Impact area */}
                <div className="pt-2 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded-md">
                    <AreaIcon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Impacto: {rec.impact.area}
                    </span>
                  </div>
                  {rec.impact.estimatedValue && (
                    <span className="text-[10px] font-bold text-foreground">
                      ~ R$ {rec.impact.estimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>

                {/* Actions (pushed to bottom) */}
                <div className="mt-auto pt-2 space-y-2">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="w-full text-xs font-bold gap-2 group-hover:translate-x-0.5 transition-transform"
                    onClick={() => handleAction(rec)}
                  >
                    {rec.action.primary}
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                  {rec.action.secondary && (
                    <p className="text-[10px] text-center text-muted-foreground italic">
                      {rec.action.secondary}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
