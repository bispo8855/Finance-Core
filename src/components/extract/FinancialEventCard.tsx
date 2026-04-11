import { useState } from "react";
import { FinancialEvent } from "@/domain/extract";
import { ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft, Info, ShoppingCart, User, Cpu, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface FinancialEventCardProps {
  event: FinancialEvent;
}

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const OriginIcon = ({ origin }: { origin: string }) => {
  switch (origin) {
    case 'ecommerce': return <ShoppingCart className="w-4 h-4" />;
    case 'manual': return <User className="w-4 h-4" />;
    case 'system': return <Cpu className="w-4 h-4" />;
    default: return <Info className="w-4 h-4" />;
  }
};

const StatusDot = ({ status }: { status: string }) => {
  if (status === 'ok') return null;
  return (
    <div className={cn(
      "w-2.5 h-2.5 rounded-full border border-background shadow-sm",
      status === 'warning' ? "bg-amber-500" : "bg-rose-500"
    )} />
  );
};

export function FinancialEventCard({ event }: FinancialEventCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isDetailed = event.items.length > 1 || event.origin === 'ecommerce' || event.status !== 'ok';

  return (
    <TooltipProvider>
      <div 
        className={cn(
          "bg-card rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer select-none relative",
          isOpen ? "ring-1 ring-primary/30 shadow-lg translate-y-[-2px]" : "hover:shadow-md hover:border-primary/20 hover:bg-accent/5"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Status Indicator (Dot) */}
        {event.status !== 'ok' && (
          <div className="absolute top-3 right-3 z-10">
            <Tooltip>
              <TooltipTrigger asChild>
                <div onClick={(e) => e.stopPropagation()}>
                    <StatusDot status={event.status} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="max-w-xs">{event.statusReason}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Header */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 relative",
              isOpen ? "scale-110" : "",
              event.type === 'entrada' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
            )}>
              {event.type === 'entrada' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate">{event.title}</h3>
                <Badge variant="outline" className="text-[10px] py-0 h-4 bg-muted/50 border-none capitalize flex gap-1 items-center font-normal">
                  <OriginIcon origin={event.origin} />
                  {event.origin === 'manual' ? 'Lançado manualmente' : event.origin}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground font-medium">
                  {event.subtitle || (new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR'))}
                </span>
                {event.subtitle && (
                   <span className="text-[10px] text-muted-foreground/30">•</span>
                )}
                {event.subtitle && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={cn(
                "font-bold text-sm",
                event.type === 'entrada' ? "text-emerald-500" : "text-rose-500"
              )}>
                {event.type === 'entrada' ? '+' : ''} {fmt(event.totalAmount)}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1 font-medium">
                {isOpen ? 'Recolher' : 'Detalhes'} {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </div>
            </div>
          </div>
        </div>

        {/* Insight Banner (Summary view) */}
        {event.insight && !isOpen && (
          <div className="px-4 pb-3 -mt-1 animate-in fade-in duration-500">
            <div className="text-[10px] bg-primary/5 text-primary/80 py-1 px-2 rounded-md inline-flex items-center gap-1.5 border border-primary/10 font-medium">
              <Info className="w-3 h-3" />
              {event.insight}
            </div>
          </div>
        )}

        {/* Expanded Content */}
        <div className={cn(
          "grid transition-all duration-300 ease-in-out border-t bg-muted/10",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="overflow-hidden">
            <div className="p-4 space-y-5">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Impacto</span>
                  <div className="flex gap-2">
                    <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-none text-[9px] h-4 font-bold">CAIXA</Badge>
                    {event.affectsResult && (
                      <Badge className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-none text-[9px] h-4 font-bold">RESULTADO</Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Origem da Movimentação</span>
                  <p className="text-[10px] font-medium flex items-center gap-1 text-foreground/80">
                    <OriginIcon origin={event.origin} />
                    {event.origin === 'ecommerce' ? 'Canal de Venda Conectado' : 'Registro Manual no Aurys'}
                  </p>
                </div>
              </div>

              {/* Status Alert in Expanded View */}
              {event.status !== 'ok' && (
                <div className={cn(
                  "p-3 rounded-lg border flex gap-3",
                  event.status === 'warning' ? "bg-amber-500/5 border-amber-500/10" : "bg-rose-500/5 border-rose-500/10"
                )}>
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                    event.status === 'warning' ? "bg-amber-500" : "bg-rose-500"
                  )} />
                  <div>
                    <h5 className={cn(
                      "text-[10px] font-bold uppercase tracking-wider mb-0.5",
                      event.status === 'warning' ? "text-amber-600" : "text-rose-600"
                    )}>
                      {event.status === 'warning' ? 'Atenção Operacional' : 'Sinal de Problema'}
                    </h5>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{event.statusReason}</p>
                  </div>
                </div>
              )}

              {/* Composition / Breakdown */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1 border-b pb-2">Composição Financeira</h4>
                <div className="space-y-2.5">
                  {event.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs px-1">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground/90">{item.description}</span>
                        <span className="text-[9px] text-muted-foreground">{item.category}</span>
                      </div>
                      <span className={cn(
                        "font-semibold",
                        item.type === 'entrada' ? "text-emerald-500/80" : "text-rose-500/80"
                      )}>
                        {item.type === 'entrada' ? '+' : ''}{fmt(item.amount)}
                      </span>
                    </div>
                  ))}
                  
                  {/* Highlighted Liquid Value */}
                  <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10 mt-4 group">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Caiu no caixa</span>
                      <span className="text-[9px] text-muted-foreground">Valor efetivo após taxas e custos</span>
                    </div>
                    <span className={cn(
                      "text-base font-black tracking-tight",
                      event.type === 'entrada' ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {fmt(event.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
              
              {event.insight && (
                 <div className="mt-4 p-3 bg-secondary/30 rounded-lg border border-border/50 animate-in zoom-in-95 duration-300">
                   <div className="flex gap-2.5">
                     <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                     <div>
                       <p className="text-[11px] font-bold text-foreground">Aurys Insight</p>
                       <p className="text-[11px] text-muted-foreground leading-relaxed">{event.insight}</p>
                     </div>
                   </div>
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
