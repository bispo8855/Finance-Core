import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PricingResult } from "@/types/pricing";
import { PricingStatusBanner } from "./PricingStatusBanner";
import { PricingDiagnostics } from "./PricingDiagnostics";
import { PricingBreakdown } from "./PricingBreakdown";
import { PricingInsight } from "./PricingInsight";
import { AlertCircle } from "lucide-react";

interface PricingResultsProps {
  result: PricingResult;
}

export function PricingResults({ result }: PricingResultsProps) {
  // Format currency
  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1 }).format(value / 100);
  };

  const isDiscover = result.mode === 'discover_price';
  
  // Color the main card based on status if it's the validate mode, or just keep it strong for discover
  const mainCardColor = result.status === 'invalid' || result.status === 'idle' 
    ? "bg-slate-50 border-slate-200" 
    : isDiscover
      ? "bg-slate-900 border-slate-900 text-white"
      : result.status === 'healthy' 
        ? "bg-emerald-900 border-emerald-900 text-white"
        : result.status === 'adjusted'
          ? "bg-blue-900 border-blue-900 text-white"
          : result.status === 'warning'
            ? "bg-amber-500 border-amber-500 text-white"
            : "bg-red-600 border-red-600 text-white";

  const mainValueColor = result.status === 'invalid' || result.status === 'idle'
    ? "text-slate-400"
    : "text-white";

  const mainLabelColor = result.status === 'invalid' || result.status === 'idle'
    ? "text-slate-500"
    : "text-white/80";

  return (
    <div className="space-y-6">
      
      {/* Visual Banner */}
      {result.status !== 'idle' && result.status !== 'invalid' && (
         <PricingStatusBanner status={result.status} />
      )}

      {/* Main Highlight Card */}
      <Card className={`${mainCardColor} shadow-md transition-all duration-500 ease-in-out transform ${result.status !== 'idle' ? 'scale-100 opacity-100' : 'scale-[0.98] opacity-90'}`}>
        <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center space-y-2">
          <p className={`text-sm font-medium uppercase tracking-wider ${mainLabelColor} transition-colors duration-300`}>
            {isDiscover ? "Preço de Venda Sugerido" : "Margem de Lucro Real"}
          </p>
          <div key={result.suggestedPrice} className="animate-in fade-in zoom-in-95 duration-500">
            <p className={`text-4xl md:text-5xl font-bold tracking-tight ${mainValueColor}`}>
              {result.status === 'idle' || result.status === 'invalid' 
                ? isDiscover ? "R$ 0,00" : "0,0%"
                : isDiscover 
                  ? formatBRL(result.suggestedPrice) 
                  : formatPercent(result.realMarginPercentage)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostics */}
      <PricingDiagnostics result={result} />
      
      {/* Micro-insight */}
      {result.status !== 'idle' && result.status !== 'invalid' && result.insight && (
        <PricingInsight insight={result.insight} />
      )}

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard 
          title="Lucro por Unidade" 
          value={formatBRL(result.unitProfit)} 
          disabled={result.status === 'idle' || result.status === 'invalid'} 
          valueColor={result.unitProfit > 0 ? "text-emerald-600" : result.unitProfit < 0 ? "text-red-600" : undefined}
        />
        <MetricCard 
          title={isDiscover ? "Margem Projetada" : "Preço Analisado"} 
          value={isDiscover ? formatPercent(result.realMarginPercentage) : formatBRL(result.suggestedPrice)} 
          disabled={result.status === 'idle' || result.status === 'invalid'} 
        />
        <MetricCard 
          title="Custo Total" 
          value={formatBRL(result.totalCost)} 
          disabled={result.status === 'idle' || result.status === 'invalid'} 
        />
        <MetricCard 
          title="Markup" 
          value={`${result.markup > 0 ? result.markup.toFixed(2) : "0.00"}x`} 
          subtext={result.markup > 0 && result.status !== 'invalid' ? `Você vende por ${result.markup.toFixed(2)}x o custo` : undefined}
          disabled={result.status === 'idle' || result.status === 'invalid'} 
        />
      </div>

      {result.status !== 'idle' && result.status !== 'invalid' && result.realMarginPercentage < 10 && result.realMarginPercentage > 0 && (
         <div className="flex items-center gap-2 mt-2 px-1 text-xs text-amber-600/90 font-medium">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Margens abaixo de 10% são altamente sensíveis a variações de custo.</span>
         </div>
      )}
      
      {/* Replace Deductions Breakdown with the robust Breakdown / Raio-X */}
      <PricingBreakdown result={result} />

    </div>
  );
}

function MetricCard({ title, value, disabled, valueColor, subtext }: { title: string, value: string, disabled?: boolean, valueColor?: string, subtext?: string }) {
  return (
    <Card className={`shadow-sm transition-all duration-300 ${disabled ? 'opacity-60 bg-slate-50' : 'bg-white hover:shadow-md'}`}>
      <CardContent className="p-4 space-y-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">{title}</p>
        <p className={`text-xl font-bold ${valueColor || 'text-slate-900'}`}>{value}</p>
        {subtext && <p className="text-[11px] leading-tight text-slate-500 pt-0.5">{subtext}</p>}
      </CardContent>
    </Card>
  );
}
