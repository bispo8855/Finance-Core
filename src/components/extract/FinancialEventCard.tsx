import { useState } from "react";
import { FinancialEvent } from "@/domain/extract";
import { extractMicrocopy } from "@/config/microcopy";
import { ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft, Info, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface FinancialEventCardProps {
  event: FinancialEvent;
}

const fmt = (v: number) => 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const StatusDot = ({ status }: { status: string }) => {
  if (status === 'ok') return null;
  return (
    <div className={cn(
      "w-2.5 h-2.5 rounded-full border border-background shadow-sm",
      status === 'warning' ? "bg-amber-500" : "bg-rose-500"
    )} />
  );
};

const EventTypeTag = ({ eventType }: { eventType: string }) => {
  const icon = extractMicrocopy.eventTypeIcons[eventType] || '📋';
  const label = extractMicrocopy.eventTypeLabels[eventType] || 'Outro';

  const colorMap: Record<string, string> = {
    sale: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
    repasse: 'bg-blue-500/10 text-blue-700 border-blue-200',
    transfer: 'bg-slate-500/10 text-slate-700 border-slate-200',
    expense: 'bg-rose-500/10 text-rose-700 border-rose-200',
    revenue: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
    reserve: 'bg-amber-500/10 text-amber-700 border-amber-200',
    chargeback: 'bg-rose-500/10 text-rose-700 border-rose-200',
    adjustment: 'bg-violet-500/10 text-violet-700 border-violet-200',
    pending: 'bg-orange-500/10 text-orange-700 border-orange-200',
    other: 'bg-slate-500/10 text-slate-700 border-slate-200',
  };

  return (
    <Badge variant="outline" className={cn(
      "text-[10px] py-0 h-5 font-semibold gap-1 border",
      colorMap[eventType] || colorMap.other
    )}>
      <span>{icon}</span>
      {label}
    </Badge>
  );
};

const ItemTag = ({ tag }: { tag?: string }) => {
  if (!tag) return null;
  const colorMap: Record<string, string> = {
    'Venda': 'bg-emerald-100 text-emerald-700',
    'Taxa': 'bg-rose-100 text-rose-700',
    'Frete': 'bg-orange-100 text-orange-700',
    'Reserva': 'bg-amber-100 text-amber-700',
    'Repasse': 'bg-blue-100 text-blue-700',
    'Estorno': 'bg-rose-100 text-rose-700',
    'Ajuste': 'bg-violet-100 text-violet-700',
  };
  return (
    <span className={cn(
      "text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide",
      colorMap[tag] || 'bg-slate-100 text-slate-600'
    )}>
      {tag}
    </span>
  );
};

export function FinancialEventCard({ event }: FinancialEventCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isEntrada = event.type === 'entrada' || event.netAmount > 0;
  const signedAmount = isEntrada ? event.totalAmount : -event.totalAmount;
  const isPending = event.eventType === 'pending';

  let netCashMicrocopy = "Valor efetivo após taxas e custos";
  if (event.eventKind === 'sale_settlement') {
    netCashMicrocopy = event.feesAmount > 0 ? "Valor líquido após taxas e custos" : "Valor recebido no caixa";
  } else if (event.eventKind === 'internal_transfer') {
    netCashMicrocopy = "Valor movimentado nesta conta";
  } else if (event.eventKind === 'standalone_income') {
    netCashMicrocopy = "Valor recebido no caixa";
  } else if (event.eventKind === 'standalone_expense') {
    netCashMicrocopy = "Valor pago no caixa";
  } else if (event.eventKind === 'reserve_release') {
    netCashMicrocopy = "Valor liberado para o caixa";
  } else if (event.eventKind === 'unclassified') {
    netCashMicrocopy = "Valor movimentado no caixa, aguardando revisão";
  }

  const resultImpactDiff = event.resultImpactAmount !== undefined ? Math.abs(event.resultImpactAmount - event.netAmount) : 0;

  return (
    <TooltipProvider>
      <div
        className={cn(
          "bg-card rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer select-none relative",
          isPending && "border-orange-200/60 bg-orange-50/20",
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

        {/* ===== HEADER ===== */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Direction Icon */}
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 text-lg",
              isOpen ? "scale-110" : "",
              isPending ? "bg-orange-500/10" :
              isEntrada ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
            )}>
              {isPending ? '⏳' :
               isEntrada ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate max-w-[300px]">{event.title}</h3>
                <EventTypeTag eventType={event.eventType} />
                {event.sourceType && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4 bg-muted/50 border-none font-normal text-muted-foreground">
                    {event.sourceType}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground font-medium">
                  {new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </span>
                {event.subtitle && (
                  <>
                    <span className="text-[10px] text-muted-foreground/30">•</span>
                    <span className="text-[10px] text-muted-foreground">{event.subtitle}</span>
                  </>
                )}
                {event.contactName && (
                  <>
                    <span className="text-[10px] text-muted-foreground/30">•</span>
                    <span className="text-[10px] text-muted-foreground">{event.contactName}</span>
                  </>
                )}
                {event.externalReference && (
                  <>
                    <span className="text-[10px] text-muted-foreground/30">•</span>
                    <span className="text-[10px] text-muted-foreground font-mono">#{event.externalReference}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className={cn(
                "font-bold text-sm tabular-nums",
                isPending ? "text-orange-600" :
                isEntrada ? "text-emerald-500" : "text-rose-500"
              )}>
                {isEntrada ? '+' : '-'} {fmt(event.totalAmount)}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1 font-medium">
                {isOpen ? 'Recolher' : 'Detalhes'} {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </div>
            </div>
          </div>
        </div>

        {/* ===== INSIGHT BANNER (collapsed) ===== */}
        {event.humanSummary && !isOpen && (
          <div className="px-4 pb-3 -mt-1 animate-in fade-in duration-500">
            <div className="text-[10px] bg-primary/5 text-primary/80 py-1 px-2.5 rounded-md inline-flex items-center gap-1.5 border border-primary/10 font-medium max-w-full">
              <Info className="w-3 h-3 shrink-0" />
              <span className="truncate">{event.humanSummary}</span>
            </div>
          </div>
        )}

        {/* ===== EXPANDED CONTENT ===== */}
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
                    {event.affectsCash && (
                      <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-none text-[9px] h-4 font-bold">
                        {extractMicrocopy.impactLabels.cash}
                      </Badge>
                    )}
                    {event.affectsResult && (
                      <Badge className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-none text-[9px] h-4 font-bold">
                        {extractMicrocopy.impactLabels.result}
                      </Badge>
                    )}
                    {!event.affectsCash && !event.affectsResult && (
                      <Badge className="bg-slate-500/10 text-slate-500 border-none text-[9px] h-4 font-bold">
                        NENHUM
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Origem</span>
                  <p className="text-[10px] font-medium flex items-center gap-1 text-foreground/80">
                    {event.origin === 'ecommerce' ? '🛒 Canal de Venda Conectado' :
                     event.origin === 'manual' ? '✏️ Registro Manual' :
                     event.origin === 'system' ? '⚙️ Sistema' : '📋 Outro'}
                    {event.sourceType && <span className="text-muted-foreground ml-1">({event.sourceType})</span>}
                  </p>
                </div>
              </div>

              {/* Status Alert */}
              {event.status !== 'ok' && (
                <div className={cn(
                  "p-3 rounded-lg border flex gap-3",
                  event.status === 'warning' ? "bg-amber-500/5 border-amber-500/10" : "bg-rose-500/5 border-rose-500/10"
                )}>
                  <AlertCircle className={cn(
                    "w-4 h-4 mt-0.5 shrink-0",
                    event.status === 'warning' ? "text-amber-500" : "text-rose-500"
                  )} />
                  <div>
                    <h5 className={cn(
                      "text-[10px] font-bold uppercase tracking-wider mb-0.5",
                      event.status === 'warning' ? "text-amber-600" : "text-rose-600"
                    )}>
                      {event.status === 'warning' ? 'Atenção' : 'Problema'}
                    </h5>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{event.statusReason}</p>
                  </div>
                </div>
              )}

              {/* ===== BREAKDOWN (Recibo Style) ===== */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1 border-b pb-2">
                  Composição Financeira
                </h4>
                <div className="space-y-0">
                  {event.semanticBreakdown ? (
                    event.semanticBreakdown.map((item, idx) => (
                      <div key={item.id} className={cn(
                        "flex items-center justify-between py-2 px-2 text-xs",
                        idx < event.semanticBreakdown!.length - 1 && "border-b border-dashed border-muted-foreground/10"
                      )}>
                        <div className="flex items-center gap-2 min-w-0">
                          <ItemTag tag={item.label} />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-foreground/90 truncate">{item.label}</span>
                            {item.explanation && (
                              <span className="text-[9px] text-muted-foreground">{item.explanation}</span>
                            )}
                          </div>
                        </div>
                        <span className={cn(
                          "font-semibold tabular-nums whitespace-nowrap ml-4",
                          item.direction === 'inflow' ? "text-emerald-500/80" : "text-rose-500/80"
                        )}>
                          {item.direction === 'inflow' ? '+' : '-'}{fmt(item.amount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    event.items.map((item, idx) => (
                      <div key={item.id} className={cn(
                        "flex items-center justify-between py-2 px-2 text-xs",
                        idx < event.items.length - 1 && "border-b border-dashed border-muted-foreground/10"
                      )}>
                        <div className="flex items-center gap-2 min-w-0">
                          <ItemTag tag={item.tag} />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-foreground/90 truncate">{item.description}</span>
                            {item.category && (
                              <span className="text-[9px] text-muted-foreground">{item.category}</span>
                            )}
                          </div>
                        </div>
                        <span className={cn(
                          "font-semibold tabular-nums whitespace-nowrap ml-4",
                          item.amount >= 0 ? "text-emerald-500/80" : "text-rose-500/80"
                        )}>
                          {item.amount >= 0 ? '+' : '-'}{fmt(item.amount)}
                        </span>
                      </div>
                    ))
                  )}

                  {/* ===== NET AMOUNT HIGHLIGHT ===== */}
                  <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10 mt-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        {isEntrada ? 'Caiu no caixa' : 'Saiu do caixa'}
                      </span>
                      <span className="text-[9px] text-muted-foreground">{netCashMicrocopy}</span>
                    </div>
                    <span className={cn(
                      "text-base font-black tracking-tight tabular-nums",
                      isEntrada ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {isEntrada ? '+' : '-'}{fmt(event.totalAmount)}
                    </span>
                  </div>

                  {/* ===== RESULT IMPACT (Optional) ===== */}
                  {event.resultImpactAmount !== undefined && resultImpactDiff > 0.01 && (
                     <div className="flex flex-col gap-2 p-3 bg-purple-500/5 rounded-lg border border-purple-500/10 mt-2">
                       <div className="flex items-center justify-between">
                         <div className="flex flex-col">
                           <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                             Impacto no Resultado
                           </span>
                           <span className="text-[9px] text-muted-foreground">Valor considerado no DRE</span>
                         </div>
                         <span className={cn(
                           "text-sm font-bold tracking-tight tabular-nums",
                           event.resultImpactAmount >= 0 ? "text-purple-600" : "text-rose-500"
                         )}>
                           {event.resultImpactAmount >= 0 ? '+' : '-'}{fmt(event.resultImpactAmount)}
                         </span>
                       </div>
                       
                       <div className="pt-2 mt-1 border-t border-purple-500/10 flex items-center justify-between">
                         <span className="text-[9px] text-muted-foreground font-medium">Diferença explicada:</span>
                         <span className="text-[9px] font-semibold text-muted-foreground">
                           {fmt(resultImpactDiff)} retidos/liberados/ajustados
                         </span>
                       </div>
                     </div>
                  )}
                </div>
              </div>

              {/* ===== HUMAN SUMMARY / INSIGHT ===== */}
              {event.humanSummary && (
                <div className="p-3 bg-secondary/30 rounded-lg border border-border/50 animate-in zoom-in-95 duration-300">
                  <div className="flex gap-2.5">
                    <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[11px] font-bold text-foreground">Aurys Insight</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{event.humanSummary}</p>
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
