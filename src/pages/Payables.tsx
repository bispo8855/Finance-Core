import { useState, useMemo, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PaymentModal } from '@/components/shared/PaymentModal';
import { NewDocumentSheet } from '@/components/finance/NewDocumentSheet';
import { TitleDetailsSheet } from '@/components/finance/TitleDetailsSheet';
import { KPICard } from '@/components/shared/KPICard';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PeriodFilter } from '@/components/finance/PeriodFilter';
import { PeriodOption, isDateInPeriod } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Title, TitleStatus } from '@/types/financial';
import { ArrowUpFromLine, Search, MoreHorizontal, Edit, Trash2, RotateCcw, Wallet, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useTitles } from '@/hooks/finance/useTitles';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { useDeleteDocument } from '@/hooks/finance/useDeleteDocument';
import { useUndoSettleTitle } from '@/hooks/finance/useUndoSettleTitle';
import { daysOverdue } from '@/domain/finance/status';
import { useToast } from '@/components/ui/use-toast';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const tabs = [
  { label: 'Todos' },
  { label: 'Previstos' },
  { label: 'Vencidos' },
  { label: 'Pagos' },
];

export default function Payables() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('status') === 'vencido' ? 2 : 0;
  
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<PeriodOption>('current_month');
  const [payTitle, setPayTitle] = useState<Title | null>(null);
  
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editDocumentId, setEditDocumentId] = useState<string | null>(null);
  const [titleDetailsOpen, setTitleDetailsOpen] = useState(false);
  const [editTitleId, setEditTitleId] = useState<string | null>(null);
  const [deleteTitleId, setDeleteTitleId] = useState<string | null>(null);
  const [undoTitleId, setUndoTitleId] = useState<string | null>(null);
  const { data: snapshot } = useFinanceSnapshot();
  const { data: pagamentos, isLoading } = useTitles('pagar');
  const { mutateAsync: deleteDocument, isPending: isDeleting } = useDeleteDocument();
  const { mutateAsync: undoSettleTitle, isPending: isUndoing } = useUndoSettleTitle();
  const { toast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];

  const [filtered, outOfPeriodCount] = useMemo(() => {
    if (!pagamentos || !snapshot) return [[], 0] as [Title[], number];
    
    const inPeriod: Title[] = [];
    const outOfPeriod: Title[] = [];

    pagamentos.forEach(t => {
      const isSettled = t.status === 'pago' || t.status === 'recebido';
      const referenceDate = (isSettled && t.settledAt) ? t.settledAt : t.dueDate;
      const tInPeriod = isDateInPeriod(referenceDate, period);
      const isOverdue = !isSettled && t.dueDate < todayStr;

      let keepInPeriod = tInPeriod;
      let keepOutPeriod = !tInPeriod && isOverdue;

      if (tab === 1) { // Previstos
        if (t.status !== 'previsto' || t.dueDate < todayStr) {
          keepInPeriod = false;
          keepOutPeriod = false; // Atrasados não entram em previstos
        }
      } else if (tab === 2) { // Vencidos
        if (t.status !== 'previsto' || t.dueDate >= todayStr) {
          keepInPeriod = false;
          keepOutPeriod = false;
        }
      } else if (tab === 3) { // Pagos
        if (!isSettled) {
          keepInPeriod = false;
          keepOutPeriod = false;
        }
      }

      if (search) {
        const term = search.toLowerCase();
        const doc = snapshot.documents.find(d => d.id === t.documentId);
        const contactName = snapshot.contacts.find(c => c.id === (t.contactId || doc?.contactId))?.name || '';
        const desc = t.description || doc?.description || '';
        const match = desc.toLowerCase().includes(term) ||
                      contactName.toLowerCase().includes(term) ||
                      t.status.toLowerCase().includes(term);
        if (!match) {
          keepInPeriod = false;
          keepOutPeriod = false;
        }
      }

      if (keepInPeriod) inPeriod.push(t);
      else if (keepOutPeriod) outOfPeriod.push(t);
    });

    inPeriod.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    outOfPeriod.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return [[...outOfPeriod, ...inPeriod], outOfPeriod.length] as [Title[], number];
  }, [pagamentos, snapshot, tab, search, period, todayStr]);

  const summaryMetrics = useMemo(() => {
    let totalPagar = 0;
    let totalPago = 0;
    let vencido = 0;
    let aVencer = 0;
    
    filtered.forEach(t => {
      const isSettled = t.status === 'pago' || t.status === 'recebido';
      
      const titleMovements = snapshot?.movements?.filter(m => m.titleId === t.id) || [];
      const paidValue = titleMovements.reduce((sum, m) => sum + m.valuePaid, 0);
      const openValue = isSettled ? 0 : Math.max(0, t.value - paidValue);

      totalPago += paidValue;
      if (!isSettled && openValue > 0) {
        totalPagar += openValue;
        if (t.dueDate < todayStr) {
          vencido += openValue;
        } else {
          aVencer += openValue;
        }
      }
    });
    
    return { totalPagar, totalPago, vencido, aVencer, count: filtered.length };
  }, [filtered, snapshot, todayStr]);

  if (isLoading || !snapshot) return <div className="p-8 text-center text-muted-foreground">Carregando títulos...</div>;

  const getContactName = (id: string) => snapshot.contacts.find(c => c.id === id)?.name || '—';

  const handleDeleteConfirm = async () => {
    if (!deleteTitleId) return;
    try {
      const t = snapshot.titles.find(x => x.id === deleteTitleId);
      if (t) {
        await deleteDocument(t.documentId);
        toast({ title: 'Sucesso', description: 'Lançamento excluído com sucesso.' });
      }
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast({ title: 'Erro', description: err.message || 'Erro ao excluir título.', variant: 'destructive' });
    } finally {
      setDeleteTitleId(null);
    }
  };

  const handleUndoConfirm = async () => {
    if (!undoTitleId) return;
    try {
      await undoSettleTitle(undoTitleId);
      toast({ title: 'Sucesso', description: 'Baixa estornada com sucesso.' });
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast({ title: 'Erro', description: err.message || 'Erro ao estornar baixa.', variant: 'destructive' });
    } finally {
      setUndoTitleId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/60 uppercase tracking-[0.2em]">
            <span>Aurys</span>
            <span className="text-muted-foreground/30">|</span>
            <span>Contas a Pagar</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Contas a Pagar</h1>
            <div className="px-2 py-0.5 rounded-full bg-destructive-subtle/50 text-negative text-[10px] font-bold border border-destructive/10">
              {filtered.length} título(s)
            </div>
          </div>
        </div>
        <Button onClick={() => { setEditDocumentId(null); setSheetOpen(true); }}>
          + Novo a pagar
        </Button>
      </div>

      {summaryMetrics.vencido > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 border border-border/40 animate-in fade-in slide-in-from-top-2 duration-700">
          <div className="bg-primary/10 p-1.5 rounded-lg shrink-0">
            <Lightbulb className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Insight do Aurys</p>
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              "O Aurys identificou {fmt(summaryMetrics.vencido)} em contas vencidas. Regularize para evitar juros e manter seu crédito."
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <KPICard 
          title="Total a Pagar" 
          value={fmt(summaryMetrics.totalPagar)} 
          icon={Wallet} 
          variant="warning" 
        />
        <KPICard 
          title="Total Pago" 
          value={fmt(summaryMetrics.totalPago)} 
          icon={CheckCircle} 
          variant="positive" 
        />
        <KPICard 
          title="Vencido" 
          value={fmt(summaryMetrics.vencido)} 
          icon={AlertTriangle} 
          variant={summaryMetrics.vencido > 0 ? "negative" : "default"} 
        />
        <KPICard 
          title="A Vencer" 
          value={fmt(summaryMetrics.aVencer)} 
          icon={Clock} 
          variant="default" 
        />
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {tabs.map((t, i) => (
              <button key={i} onClick={() => setTab(i)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === i ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <PeriodFilter value={period} onChange={setPeriod} className="h-9 w-[160px] text-xs font-medium bg-background border-muted" />
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar fornecedor..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs" 
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fornecedor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descrição</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Parcela</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Pago em</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Atraso</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((t, index) => (
                <Fragment key={t.id}>
                  {index === 0 && outOfPeriodCount > 0 && (
                    <tr className="bg-destructive/10"><td colSpan={9} className="px-4 py-2 text-xs font-semibold text-destructive uppercase tracking-wide">Títulos Atrasados (Anteriores ao período)</td></tr>
                  )}
                  {index === outOfPeriodCount && filtered.length > outOfPeriodCount && outOfPeriodCount > 0 && period !== 'all' && (
                    <tr className="bg-muted/50"><td colSpan={9} className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">No período selecionado</td></tr>
                  )}
                  <tr className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">{new Date(t.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">{getContactName(t.contactId || snapshot?.documents.find(d => d.id === t.documentId)?.contactId || '')}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate" title={t.description || snapshot?.documents.find(d => d.id === t.documentId)?.description}>
                    {t.description || snapshot?.documents.find(d => d.id === t.documentId)?.description || '—'}
                  </td>
                  <td className="px-4 py-3">{t.installment}/{t.totalInstallments}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium">{fmt(t.value)}</div>
                    {(() => {
                      const titleMovements = snapshot?.movements?.filter(m => m.titleId === t.id) || [];
                      if (titleMovements.length > 0) {
                        const paidValue = titleMovements.reduce((sum, m) => sum + m.valuePaid, 0);
                        const diff = paidValue - t.value;
                        
                        let DiffSpan = null;
                        if (diff > 0.01) {
                          DiffSpan = <span className="text-destructive ml-1">(+{fmt(diff)})</span>; // Pagando a mais, pra despesa é ruim (vermelho) ou neutro
                        } else if (diff < -0.01) {
                          DiffSpan = <span className="text-emerald-500 ml-1">(-{fmt(Math.abs(diff))})</span>; // Pagou a menos, desconto
                        }

                        return (
                          <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                            Pago: {fmt(paidValue)} {DiffSpan}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={(t.status === 'previsto' && t.dueDate < todayStr) ? 'atrasado' : t.status} /></td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {t.status === 'pago' && t.settledAt ? new Date(t.settledAt + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(t.status === 'previsto' && t.dueDate < todayStr) ? <span className="text-xs font-medium text-negative">{daysOverdue(t.dueDate, todayStr)}d</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {t.status === 'previsto' && (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setPayTitle(t)}>Baixar</Button>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditTitleId(t.id); setTitleDetailsOpen(true); }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Detalhes do Título
                          </DropdownMenuItem>
                          
                          { (() => {
                              const hasMovements = snapshot?.movements?.some(m => m.titleId === t.id);
                              const isSettled = t.status === 'pago' || t.status === 'recebido';
                              
                              if (isSettled || hasMovements) {
                                return (
                                  <DropdownMenuItem onClick={() => setUndoTitleId(t.id)}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Estornar baixa
                                  </DropdownMenuItem>
                                );
                              } else {
                                return (
                                  <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground" onClick={() => setDeleteTitleId(t.id)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir Lançamento
                                  </DropdownMenuItem>
                                );
                              }
                          })() }
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Nenhum título encontrado.</td></tr>
              )}
            </tbody>
            <tfoot className="border-t bg-muted/20 font-semibold group">
              <tr>
                <td colSpan={4} className="px-4 py-4 text-right text-muted-foreground">
                  Total do Filtro ({summaryMetrics.count} título{summaryMetrics.count !== 1 ? 's' : ''}):
                </td>
                <td className="px-4 py-4 text-right text-foreground">
                  {fmt(filtered.reduce((acc, t) => acc + t.value, 0))}
                </td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <PaymentModal title={payTitle} open={!!payTitle} onClose={() => setPayTitle(null)} />
      <NewDocumentSheet 
        open={sheetOpen} 
        onOpenChange={setSheetOpen} 
        defaultSide="pagar" 
        editDocumentId={editDocumentId} 
      />
      <TitleDetailsSheet 
        open={titleDetailsOpen} 
        onOpenChange={setTitleDetailsOpen} 
        titleId={editTitleId} 
      />
      
      <AlertDialog open={!!deleteTitleId} onOpenChange={(open) => !open && setDeleteTitleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const t = snapshot?.titles.find(x => x.id === deleteTitleId);
                const count = t ? snapshot?.titles.filter(x => x.documentId === t.documentId).length : 0;
                return (
                  <>
                    Este lançamento possui <strong>{count} parcela(s)</strong>.
                    <br/><br/>
                    Excluir este lançamento removerá todas as parcelas ainda não baixadas. Tem certeza?
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!undoTitleId} onOpenChange={(open) => !open && setUndoTitleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar Baixa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja estornar a baixa deste título? As movimentações vinculadas serão removidas e o título voltará para o status "previsto".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUndoing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUndoConfirm} disabled={isUndoing}>
              {isUndoing ? 'Estornando...' : 'Confirmar Estorno'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
