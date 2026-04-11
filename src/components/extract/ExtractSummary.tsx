import { Card } from "@/components/ui/card";
import { ArrowUpCircle, ArrowDownCircle, Wallet, Activity, Plus, Minus, Equal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExtractSummaryProps {
  previousBalance: number;
  inflows: number;
  outflows: number;
  finalBalance: number;
  accountName?: string;
  executiveMessage?: string;
}

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export function ExtractSummary({ 
  previousBalance, 
  inflows, 
  outflows, 
  finalBalance, 
  accountName, 
  executiveMessage 
}: ExtractSummaryProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row items-stretch gap-4">
        {/* Equação de Fluxo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-[3]">
          {/* Saldo Anterior */}
          <Card className="p-5 bg-muted/5 border-muted/40 shadow-sm relative overflow-hidden group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Saldo Anterior</p>
                <div className="p-1.5 rounded-full bg-muted/20">
                   <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-muted-foreground/80">
                {fmt(previousBalance)}
              </h3>
              <p className="text-[9px] text-muted-foreground">Posição em conta antes do período</p>
            </div>
            <div className="absolute -bottom-1 -right-1 opacity-5 group-hover:scale-110 transition-transform">
               <Wallet className="w-16 h-16" />
            </div>
          </Card>

          {/* Entradas */}
          <Card className="p-5 bg-emerald-500/[0.02] border-emerald-500/10 shadow-sm relative overflow-hidden group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Plus className="w-3 h-3 text-emerald-500/50" />
                    <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-widest">Entradas</p>
                 </div>
                 <div className="p-1.5 rounded-full bg-emerald-500/10">
                    <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-500" />
                 </div>
              </div>
              <h3 className="text-xl font-bold text-emerald-600">
                {fmt(inflows)}
              </h3>
              <p className="text-[9px] text-muted-foreground">Total que entrou no caixa</p>
            </div>
            <div className="absolute -bottom-1 -right-1 opacity-5 group-hover:scale-110 transition-transform">
               <ArrowUpCircle className="w-16 h-16 text-emerald-500" />
            </div>
          </Card>

          {/* Saídas */}
          <Card className="p-5 bg-rose-500/[0.02] border-rose-500/10 shadow-sm relative overflow-hidden group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Minus className="w-3 h-3 text-rose-500/50" />
                    <p className="text-[10px] font-bold text-rose-600/80 uppercase tracking-widest">Saídas</p>
                 </div>
                 <div className="p-1.5 rounded-full bg-rose-500/10">
                    <ArrowDownCircle className="w-3.5 h-3.5 text-rose-500" />
                 </div>
              </div>
              <h3 className="text-xl font-bold text-rose-600">
                {fmt(outflows)}
              </h3>
              <p className="text-[9px] text-muted-foreground">Total que saiu do caixa</p>
            </div>
            <div className="absolute -bottom-1 -right-1 opacity-5 group-hover:scale-110 transition-transform">
               <ArrowDownCircle className="w-16 h-16 text-rose-500" />
            </div>
          </Card>
        </div>

        {/* Separador Visual de Igualdade (apenas desktop) */}
        <div className="hidden lg:flex items-center justify-center">
           <Equal className="w-5 h-5 text-muted-foreground/30" />
        </div>

        {/* Saldo Final (Conclusão) */}
        <Card className={cn(
          "p-6 bg-primary shadow-lg ring-1 ring-primary/20 relative overflow-hidden group flex-1",
          "flex flex-col justify-center min-w-[240px]"
        )}>
          <div className="space-y-2 relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-primary-foreground/70 uppercase tracking-[0.2em]">Saldo Final</p>
              <div className="p-1.5 rounded-full bg-white/10">
                <Wallet className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-primary-foreground tracking-tight">
              {fmt(finalBalance)}
            </h2>
            <p className="text-[10px] text-primary-foreground/60 font-medium">
              Posição {accountName ? `em ${accountName}` : 'Consolidada'} ao fim do período
            </p>
          </div>
          {/* Decorativo */}
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-500 translate-x-4 -translate-y-4">
             <Wallet className="w-24 h-24 text-white" />
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20" />
        </Card>
      </div>

      {executiveMessage && (
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500 relative overflow-hidden group">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground/80 leading-relaxed italic relative z-10">
            "{executiveMessage}"
          </p>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </div>
      )}
    </div>
  );
}
