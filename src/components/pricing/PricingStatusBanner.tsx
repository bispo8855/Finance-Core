import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PricingStatus } from "@/types/pricing";
import { AlertCircle, CheckCircle2, TrendingDown, Info } from "lucide-react";

interface PricingStatusBannerProps {
  status: PricingStatus;
}

export function PricingStatusBanner({ status }: PricingStatusBannerProps) {
  if (status === 'idle') return null;

  if (status === 'invalid') {
    return (
      <Alert variant="destructive" className="bg-red-50 text-red-900 border-red-200">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Cálculo Inválido</AlertTitle>
        <AlertDescription>
          Verifique os valores informados para continuar.
        </AlertDescription>
      </Alert>
    );
  }

  const config = {
    healthy: {
      icon: CheckCircle2,
      title: "Cenário Saudável",
      colorClass: "bg-emerald-50 text-emerald-900 border-emerald-200",
      iconClass: "text-emerald-600"
    },
    adjusted: {
      icon: CheckCircle2,
      title: "Margem Ajustada",
      colorClass: "bg-blue-50 text-blue-900 border-blue-200",
      iconClass: "text-blue-600"
    },
    warning: {
      icon: AlertCircle,
      title: "Atenção à Margem",
      colorClass: "bg-amber-50 text-amber-900 border-amber-200",
      iconClass: "text-amber-600"
    },
    critical: {
      icon: TrendingDown,
      title: "Cenário Crítico (Prejuízo)",
      colorClass: "bg-red-50 text-red-900 border-red-200",
      iconClass: "text-red-600"
    }
  }[status];

  if (!config) return null;

  const Icon = config.icon;

  return (
    <Alert className={`${config.colorClass} border`}>
      <Icon className={`h-4 w-4 ${config.iconClass}`} />
      <AlertTitle className="font-semibold">{config.title}</AlertTitle>
    </Alert>
  );
}
