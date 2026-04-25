import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImportEvent, ImportEventStatus } from '@/types/import';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { ChevronDown, ChevronUp, Check, X, AlertTriangle, AlertCircle, ShoppingBag, Store, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { microcopy } from '@/config/microcopy';
import { settlementDaysBySource } from '@/config/settlementDays';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

interface ImportEventCardProps {
  event: ImportEvent;
  onStatusChange: (id: string, status: ImportEventStatus) => void;
  onUpdateCategory?: (id: string, categoryId: string) => void;
  onUpdateEvent?: (id: string, updates: Partial<ImportEvent>) => void;
}

export default function ImportEventCard({ event, onStatusChange, onUpdateCategory, onUpdateEvent }: ImportEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  
  // Confidences mapping
  const confidenceConfig = {
    alta: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Check, label: 'Alta Confiança' },
    media: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Check, label: 'Sugestão (Média)' },
    revisar: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertTriangle, label: 'Revisar' },
    incompleto: { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle, label: 'Incompleto' },
    duplicidade: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle, label: 'Duplicidade' },
  };
  
  const StatusObj = confidenceConfig[event.confidence];
  const Icon = StatusObj.icon;

  const handleApprove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(event.id, 'aprovado');
  };

  const handleIgnore = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(event.id, 'ignorado');
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200",
      event.status === 'ignorado' ? 'opacity-50 grayscale bg-slate-50' : 'bg-white',
      event.status === 'aprovado' ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : ''
    )}>
      {/* HEADER CARD */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className={cn("p-2 rounded-lg border", StatusObj.color)}>
            <Icon className="w-5 h-5" />
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-slate-900">{event.title}</h4>
              {event.status === 'aprovado' && <Badge className="bg-emerald-500 rounded"><Check className="w-3 h-3 mr-1" /> Aprovado</Badge>}
              {event.status === 'ignorado' && <Badge variant="outline" className="text-slate-500">Ignorado</Badge>}
              
              {event.status !== 'aprovado' && event.status !== 'ignorado' && event.confidence !== 'alta' && (
                <Badge variant="secondary" className={cn("ml-2 border font-medium text-[10px] uppercase", StatusObj.color)}>
                   {StatusObj.label}
                </Badge>
              )}
              
              {event.flags?.includes('duplicate') && (
                <Badge variant="secondary" className="ml-2 border border-orange-200 bg-orange-100 text-orange-800 font-medium text-[10px] uppercase">
                  {microcopy.duplicateLabel}
                </Badge>
              )}

              {event.historical && (
                <Badge variant="secondary" className="ml-2 border border-blue-200 bg-blue-100 text-blue-800 font-medium text-[10px] uppercase">
                  {event.mode === 'bank' || event.primaryType === 'entrada_liquidada' ? 'Pagamento recebido' : microcopy.historicalLabel}
                </Badge>
              )}

              {event.reconciliationType === 'match' && (
                <Badge variant="secondary" className="ml-2 border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium text-[10px] uppercase">
                  ✨ Conciliação Sugerida
                </Badge>
              )}

              {event.status !== 'aprovado' && event.status !== 'ignorado' && event.reconciliationType === 'multiple' && (
                <Badge variant="secondary" className="ml-2 border border-amber-200 bg-amber-50 text-amber-700 font-medium text-[10px] uppercase">
                  ⚠️ Múltiplas Correspondências
                </Badge>
              )}

              {event.status !== 'aprovado' && event.status !== 'ignorado' && event.reconciliationType === 'divergence' && (
                <Badge variant="secondary" className="ml-2 border border-orange-200 bg-orange-50 text-orange-700 font-medium text-[10px] uppercase">
                  ⚠️ Possível Divergência
                </Badge>
              )}

              {event.status !== 'aprovado' && event.reconciliationType === 'none' && ['repasse', 'liberacao', 'transferencia', 'deposito', 'antecipacao', 'entrada_liquidada'].includes(event.primaryType) && (
                <Badge variant="secondary" className={cn(
                  "ml-2 border font-medium text-[10px] uppercase",
                  event.reference 
                    ? "border-red-200 bg-red-50 text-red-700" 
                    : (Math.abs(event.netAmount) >= 100 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-blue-200 bg-blue-50 text-blue-700")
                )}>
                  {event.reference ? '🔴 Sem correspondência encontrada' : (Math.abs(event.netAmount) >= 100 ? '🟡 Entrada Avulsa (Revisar)' : 'ℹ️ Entrada Avulsa Detectada')}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
              <span>{formatDate(event.date)}</span>
              <span>•</span>
              <span>{event.source}</span>
              <span>•</span>
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-slate-100">
                {event.rawLines.length} linha{event.rawLines.length !== 1 && 's'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block mb-1">
              {event.primaryType === 'entrada_liquidada' || event.mode === 'bank' ? 'Valor Recebido' : microcopy.mainLabel}
            </span>
            <span className={cn("font-bold text-lg block leading-none", event.netAmount >= 0 ? "text-emerald-600" : "text-red-600")}>
              {formatCurrency(event.netAmount)}
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block italic font-medium">
              {event.mode === 'bank' || event.primaryType === 'entrada_liquidada' ? (
                `Recebido em ${formatDate(event.date)}`
              ) : (
                <>{microcopy.predictedLabel} {(() => {
                  const days = settlementDaysBySource[event.source] ?? settlementDaysBySource.default;
                  const date = new Date(event.date);
                  date.setDate(date.getDate() + days);
                  return formatDate(date.toISOString());
                })()}</>
              )}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {event.status === 'pendente' && (
              <>
                <Button size="sm" variant="outline" className="text-slate-500 hover:text-red-600" onClick={handleIgnore}>
                  <X className="w-4 h-4 mr-1" /> Ignorar
                </Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApprove}>
                  <Check className="w-4 h-4 mr-1" /> Aprovar
                </Button>
              </>
            )}
            
            {event.status !== 'pendente' && (
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onStatusChange(event.id, 'pendente'); }}>
                Desfazer
              </Button>
            )}
            
            <div className="w-px h-8 bg-slate-200 mx-1"></div>
            
            <Button size="icon" variant="ghost" className="text-slate-400">
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* EXPANDED CONTENT */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-6 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Breakdown */}
            <div className="md:col-span-1 space-y-4">
              <h5 className="text-sm font-bold tracking-tight text-slate-900 uppercase">Breakdown</h5>
              
              {(event.primaryType === 'entrada_liquidada' || event.mode === 'bank') ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Valor Recebido</span>
                    <span className={cn("font-medium", event.netAmount >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {formatCurrency(event.netAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Data Recebida</span>
                    <span className="font-medium text-slate-900">{formatDate(event.date)}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Venda Bruta</span>
                    <span className="font-medium text-slate-900">{formatCurrency(event.grossAmount)}</span>
                  </div>
                  {event.feeAmount < 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Taxas e Comissões</span>
                      <span className="font-medium text-red-600">{formatCurrency(event.feeAmount)}</span>
                    </div>
                  )}
                  {event.freightAmount < 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Custo de Frete</span>
                      <span className="font-medium text-red-600">{formatCurrency(event.freightAmount)}</span>
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold">
                    <span className="text-slate-900">Total Líquido</span>
                    <span className={event.netAmount >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {formatCurrency(event.netAmount)}
                    </span>
                  </div>
                </div>
              )}

              {event.explanation && (
                <div className="mt-4 bg-blue-50/50 p-3 rounded-md border border-blue-100 text-xs text-blue-800">
                  <span className="font-semibold block mb-1">Resultado da Análise:</span>
                  {event.explanation}
                </div>
              )}

              {event.status !== 'aprovado' && event.status !== 'ignorado' && event.confidence === 'revisar' && event.primaryType === 'entrada_liquidada' && (
                <div className="mt-4 border border-violet-200 bg-violet-50/50 rounded-md p-3">
                  <h6 className="text-xs font-bold text-violet-900 uppercase tracking-tight flex items-center gap-1.5 mb-2">
                    <Search className="w-3.5 h-3.5" /> Ação Recomendada
                  </h6>
                  
                  {event.reconciliationType === 'divergence' ? (
                    <>
                      <p className="text-xs text-violet-800 mb-3">Existe venda com valor semelhante. Você pode vincular manualmente apontando para a correspondência certa.</p>
                      
                      <Button variant="outline" size="sm" className="w-full text-xs h-8 border-violet-200 text-violet-700 hover:bg-violet-100" onClick={(e) => {
                        e.stopPropagation();
                        setShowMatchModal(true);
                      }}>
                        Vincular venda
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-violet-800 mb-3">Nenhuma venda correspondente encontrada. Escolha uma ação:</p>
                      <div className="flex flex-col gap-2 mt-2">
                        <Button variant="outline" size="sm" className="w-full text-xs h-8 border-violet-200 text-violet-700 hover:bg-violet-100" onClick={(e) => {
                          e.stopPropagation();
                          setShowMatchModal(true);
                        }}>
                          Vincular venda
                        </Button>
                        <Button variant="outline" size="sm" className="w-full text-xs h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-100" onClick={(e) => {
                          e.stopPropagation();
                          if (onUpdateEvent) {
                            onUpdateEvent(event.id, { explanation: 'Entrada manual avulsa solicitada pelo usuário.' });
                          }
                          onStatusChange(event.id, 'aprovado');
                        }}>
                          Criar entrada avulsa
                        </Button>
                        <Button variant="outline" size="sm" className="w-full text-xs h-8 border-slate-200 text-slate-700 hover:bg-slate-100" onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(event.id, 'ignorado');
                        }}>
                          Ignorar
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal de Vinculação */}
            <Dialog open={showMatchModal} onOpenChange={setShowMatchModal}>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Vincular Recebimento</DialogTitle>
                  <DialogDescription>
                    Selecione um dos lançamentos abaixo para vincular o recebimento de {formatCurrency(Math.abs(event.netAmount))} oriundo de {event.source}.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-3 mt-4 max-h-[60vh] overflow-y-auto pr-2">
                  {event.reconciliationCandidates && event.reconciliationCandidates.length > 0 ? (
                    event.reconciliationCandidates.map(cand => (
                      <div key={cand.id} className="flex justify-between items-center bg-slate-50 border border-slate-200 p-3 rounded-lg hover:border-primary transition-colors cursor-pointer" onClick={() => {
                        if (onUpdateEvent) {
                          onUpdateEvent(event.id, {
                            reconciliationId: cand.id,
                            reconciliationType: 'match',
                            confidence: 'alta',
                            explanation: `Vinculado manualmente a: ${cand.description}`,
                            status: 'aprovado'
                          });
                        }
                        setShowMatchModal(false);
                      }}>
                        <div className="overflow-hidden pr-4">
                          <span className="font-semibold text-sm text-slate-900 block truncate" title={cand.description}>{cand.description}</span>
                          <span className="text-xs text-slate-500 mt-0.5 block">
                            Data Prevista: {formatDate(cand.date)}
                          </span>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-2">
                          <span className="font-bold text-slate-900">{formatCurrency(cand.value)}</span>
                          <Button size="sm" variant="secondary" className="h-7 text-[10px]">Vincular a esta venda</Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                      <p className="text-sm">Parâmetros ausentes para buscar candidatos locais.</p>
                      <p className="text-xs mt-1 text-slate-400">Tente cadastrar o título no Contas a Receber primeiro.</p>
                    </div>
                  )}
                </div>

                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button variant="ghost">Cancelar</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Linhas Originais */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-bold tracking-tight text-slate-900 uppercase">Linhas Lidas da Planilha</h5>
                {event.confidence === 'revisar' && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-medium">
                    Revise os tipos detectados
                  </span>
                )}
              </div>
              
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                    <tr>
                      <th className="text-left py-2 px-3">Data</th>
                      <th className="text-left py-2 px-3">Descrição Original</th>
                      <th className="text-left py-2 px-3">Tipo Detectado</th>
                      <th className="text-right py-2 px-3">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {event.rawLines.map((line, idx) => (
                      <tr key={line.id || idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{formatDate(line.date)}</td>
                        <td className="py-2 px-3 text-slate-900 truncate max-w-[200px]" title={line.description}>
                          {line.description || '-'}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className={cn(
                            "font-medium text-xs",
                            line.detectedType === 'venda' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                            line.detectedType === 'taxa' && "bg-red-50 text-red-700 border-red-200",
                            line.detectedType === 'frete' && "bg-orange-50 text-orange-700 border-orange-200",
                            line.detectedType === 'desconhecido' && "bg-slate-100 text-slate-700 border-slate-300"
                          )}>
                            {line.detectedType.toUpperCase()}
                          </Badge>
                        </td>
                        <td className={cn("py-2 px-3 text-right font-medium whitespace-nowrap", line.amount >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {formatCurrency(line.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </Card>
  );
}
