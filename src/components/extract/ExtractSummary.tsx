import { Card } from "@/components/ui/card";
import { ArrowUpCircle, ArrowDownCircle, Wallet, Activity, Plus, Minus, Equal, TrendingDown, ShoppingCart, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExtractStats } from "@/domain/extract";

interface ExtractSummaryProps {
  previousBalance: number;
  inflows: number;
  outflows: number;
  finalBalance: number;
  accountName?: string;
  executiveMessage?: string;
  stats?: ExtractStats;
}

const fmt = (v: number) => 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export function ExtractSummary({
  previousBalance,
  inflows,
  outflows,
  finalBalance,
  accountName,
  executiveMessage,
  stats
}: ExtractSummaryProps) {
  return (
    <div className="space-y-6">
      {/* Row 1: Equação de Fluxo */}
      <div className="flex flex-col lg:flex-row items-stretch gap-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 flex-[3]">
          {/* Saldo Anterior */}
          <Card className="p-5 bg-muted/5 border-muted/40 shadow-sm relative overflow-hidden group flex-1">
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

          {/* + */}
          <div className="hidden md:flex shrink-0 items-center justify-center text-muted-foreground/30">
            <Plus className="w-5 h-5" />
          </div>

          {/* Entradas */}
          <Card className="p-5 bg-emerald-500/[0.02] border-emerald-500/10 shadow-sm relative overflow-hidden group flex-1">
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
              <p className="text-[9px] text-muted-foreground">Movimentos que aumentaram o caixa</p>
            </div>
            <div className="absolute -bottom-1 -right-1 opacity-5 group-hover:scale-110 transition-transform">
               <ArrowUpCircle className="w-16 h-16 text-emerald-500" />
            </div>
          </Card>

          {/* - */}
          <div className="hidden md:flex shrink-0 items-center justify-center text-muted-foreground/30">
            <Minus className="w-5 h-5" />
          </div>

          {/* Saídas */}
          <Card className="p-5 bg-rose-500/[0.02] border-rose-500/10 shadow-sm relative overflow-hidden group flex-1">
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
              <p className="text-[9px] text-muted-foreground">Movimentos que reduziram o caixa</p>
            </div>
            <div className="absolute -bottom-1 -right-1 opacity-5 group-hover:scale-110 transition-transform">
               <ArrowDownCircle className="w-16 h-16 text-rose-500" />
            </div>
          </Card>
        </div>

        {/* Separador Visual */}
        <div className="hidden lg:flex items-center justify-center">
           <Equal className="w-5 h-5 text-muted-foreground/30" />
        </div>

        {/* Saldo Final */}
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
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-500 translate-x-4 -translate-y-4">
             <Wallet className="w-24 h-24 text-white" />
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20" />
        </Card>
      </div>

      {/* Row 2: Marketplace KPIs (only if stats available) */}
      {stats && (stats.totalSales > 0 || stats.totalFees > 0 || stats.totalPending > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.totalSales > 0 && (
            <Card className="p-4 bg-card border shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Vendas</span>
              </div>
              <div className="text-lg font-bold text-foreground">{stats.totalSales}</div>
              {stats.grossSales > 0 && (
                <p className="text-[9px] text-muted-foreground mt-0.5">Bruto: {fmt(stats.grossSales)}</p>
              )}
            </Card>
          )}

          {stats.totalFees > 0 && (
            <Card className="p-4 bg-card border shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-rose-500/10">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Taxas</span>
              </div>
              <div className="text-lg font-bold text-rose-600">{fmt(stats.totalFees)}</div>
              {stats.feePercentage > 0 && (
                <p className="text-[9px] text-muted-foreground mt-0.5">{stats.feePercentage.toFixed(1)}% das vendas</p>
              )}
            </Card>
          )}

          {stats.totalReserves > 0 && (
            <Card className="p-4 bg-card border shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Reservas</span>
              </div>
              <div className="text-lg font-bold text-amber-600">{fmt(stats.totalReserves)}</div>
              <p className="text-[9px] text-muted-foreground mt-0.5">Retido temporariamente</p>
            </Card>
          )}

          {stats.totalPending > 0 && (
            <Card className="p-4 bg-card border border-orange-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-orange-500/10">
                  <span className="text-xs">⏳</span>
                </div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Pendentes</span>
              </div>
              <div className="text-lg font-bold text-orange-600">{stats.totalPending}</div>
              <p className="text-[9px] text-muted-foreground mt-0.5">Aguardando classificação</p>
            </Card>
          )}
        </div>
      )}

      {/* Row 3: Executive Message */}
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
