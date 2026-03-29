import { PricingResult } from "@/types/pricing";

interface PricingBreakdownProps {
  result: PricingResult;
}

export function PricingBreakdown({ result }: PricingBreakdownProps) {
  if (result.status === 'idle' || result.status === 'invalid') return null;

  const price = result.suggestedPrice;
  if (!price) return null;

  const formatBRL = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-5 mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h4 className="text-[11px] uppercase tracking-widest font-bold text-slate-500 mb-1">Estrutura do resultado por unidade</h4>
      <p className="text-[13px] text-slate-500 mb-3">Veja como cada R$ 1 do seu preço é distribuído:</p>
      
      <p className="text-sm font-medium text-slate-800 mb-4 pb-4 border-b border-slate-200">
        De cada <span className="text-slate-900 font-bold">{formatBRL(price)}</span> que entra:
      </p>

      <div className="space-y-3">
        <BreakdownRow 
            label="Custo da Operação" 
            value={result.totalCost} 
            colorClass="bg-red-500" 
            percent={(result.totalCost / price) * 100} 
        />
        <BreakdownRow 
            label="Impostos Retirados" 
            value={result.taxesAmount} 
            colorClass="bg-amber-500" 
            percent={(result.taxesAmount / price) * 100} 
        />
        <BreakdownRow 
            label="Taxas (Gateways/Comissões)" 
            value={result.feesAmount} 
            colorClass="bg-amber-400" 
            percent={(result.feesAmount / price) * 100} 
        />
        <div className="pt-2 mt-2 border-t border-slate-200">
            <BreakdownRow 
                label="Margem Líquida (Lucro Limpo)" 
                value={result.unitProfit} 
                colorClass="bg-emerald-500" 
                percent={(result.unitProfit / price) * 100} 
                isBold
            />
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({ label, value, colorClass, percent, isBold }: { label: string, value: number, colorClass: string, percent: number, isBold?: boolean }) {
  const formatBRL = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colorClass}`} />
        <span className={`text-sm ${isBold ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs ${isBold ? 'font-semibold text-slate-500' : 'text-slate-400'}`}>
           {percent.toFixed(1)}%
        </span>
        <span className={`text-sm ${isBold ? 'font-bold text-slate-900' : 'text-slate-700 font-medium'} text-right w-24`}>
           {formatBRL(value)}
        </span>
      </div>
    </div>
  );
}
