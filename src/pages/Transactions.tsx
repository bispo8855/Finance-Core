import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { PeriodOption, isDateInPeriod } from '@/lib/dateUtils';
import { PeriodFilter as PeriodFilterComponent } from '@/components/finance/PeriodFilter';
import { Input } from '@/components/ui/input';
import { Search, History } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DocumentType, TitleStatus } from '@/types/financial';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { useDeleteDocument } from '@/hooks/finance/useDeleteDocument';
import { useToast } from '@/components/ui/use-toast';
import { NewDocumentSheet } from '@/components/finance/NewDocumentSheet';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCategoryId = searchParams.get('categoryId');
  // period could also be parsed if needed, but keeping isolated state is fine for now

  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<PeriodOption>('current_month');
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editDocumentId, setEditDocumentId] = useState<string | null>(null);

  const { data: snapshot, isLoading } = useFinanceSnapshot();
  const { mutateAsync: deleteDocument, isPending: isDeleting } = useDeleteDocument();
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (!snapshot) return [];
    
    let list = [...snapshot.documents];

    if (queryCategoryId) {
      list = list.filter(d => d.categoryId === queryCategoryId);
    }

    // Filter by period using competenceDate
    list = list.filter(d => isDateInPeriod(d.competenceDate, period));

    // Filter by search
    if (search) {
      const term = search.toLowerCase();
      list = list.filter(d => {
        const contactName = snapshot.contacts.find(c => c.id === d.contactId)?.name || '';
        const catName = snapshot.categories.find(c => c.id === d.categoryId)?.name || '';
        return (
          d.description.toLowerCase().includes(term) ||
          contactName.toLowerCase().includes(term) ||
          catName.toLowerCase().includes(term)
        );
      });
    }

    // Sort by competenceDate descending
    return list.sort((a, b) => b.competenceDate.localeCompare(a.competenceDate));
  }, [snapshot, search, period, queryCategoryId]);

  if (isLoading || !snapshot) return <div className="p-8 text-center text-muted-foreground">Carregando histórico...</div>;

  const handleDeleteConfirm = async () => {
    if (!deleteDocumentId) return;
    try {
      await deleteDocument(deleteDocumentId);
      toast({ title: 'Sucesso', description: 'Lançamento excluído com sucesso.' });
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast({ title: 'Erro', description: err.message || 'Erro ao excluir lançamento.', variant: 'destructive' });
    } finally {
      setDeleteDocumentId(null);
    }
  };

  const getContactName = (id: string) => snapshot.contacts.find(c => c.id === id)?.name || '—';
  const getCategoryName = (id: string) => snapshot.categories.find(c => c.id === id)?.name || '—';

  const getDocumentStatus = (docId: string) => {
    const docTitles = snapshot.titles.filter(t => t.documentId === docId);
    if (docTitles.length === 0) return 'previsto';
    
    const isSettled = (status: string) => status === 'pago' || status === 'recebido';
    
    const docTitleIds = docTitles.map(t => t.id);
    const paidValue = snapshot?.movements
      ?.filter(m => docTitleIds.includes(m.titleId))
      .reduce((sum, m) => sum + m.valuePaid, 0) || 0;
    
    const openValue = docTitles
      .filter(t => !isSettled(t.status))
      .reduce((sum, t) => sum + t.value, 0);

    if (paidValue === 0 && openValue > 0) {
      // Nada baixado, tudo em aberto
      const todayStr = new Date().toISOString().split('T')[0];
      const anyOverdue = docTitles.some(t => t.dueDate < todayStr && !isSettled(t.status));
      if (anyOverdue) return 'atrasado';
      return 'previsto';
    }
    
    if (paidValue > 0 && Math.abs(openValue) > 0.01) {
      // Parte baixada, parte em aberto
      return 'parcial';
    }
    
    if (Math.abs(openValue) <= 0.01 && paidValue > 0) {
      // Tudo liquidado
      return docTitles[0].side === 'receber' ? 'recebido' : 'pago';
    }
    
    // Fallback seguro
    return 'previsto';
  };

  const getDocumentTypeLabel = (type: DocumentType) => {
    switch (type) {
      case 'receita': return 'Receita';
      case 'despesa': return 'Despesa';
      case 'venda': return 'Venda';
      case 'compra': return 'Compra';
      default: return type;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <History className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Histórico de Lançamentos</h1>
          <p className="text-sm text-muted-foreground">Visão geral por documento ({filtered.length} registros)</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PeriodFilterComponent value={period} onChange={setPeriod} className="h-9 w-[160px] text-xs font-medium bg-background border-muted" />
            {queryCategoryId && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium">
                Filtrado por categoria
                <button onClick={() => { searchParams.delete('categoryId'); setSearchParams(searchParams); }} className="hover:text-primary/70 ml-1">
                  ✕
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 w-full sm:w-64">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar lançamento..." value={search} onChange={e => setSearch(e.target.value)}
              className="border-0 bg-transparent h-auto p-0 text-sm focus-visible:ring-0 shadow-none" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Competência</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contato</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Categoria</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descrição</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor Total</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Condição</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status Geral</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(d => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">{new Date(d.competenceDate + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10">
                      {getDocumentTypeLabel(d.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getContactName(d.contactId)}</td>
                  <td className="px-4 py-3">{getCategoryName(d.categoryId)}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{d.description || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium">{fmt(d.totalValue)}</div>
                    {(() => {
                        const docTitles = snapshot?.titles.filter(t => t.documentId === d.id) || [];
                        const isSettled = (status: string) => status === 'pago' || status === 'recebido';
                        
                        const docTitleIds = docTitles.map(t => t.id);
                        const paidValue = snapshot?.movements
                          ?.filter(m => docTitleIds.includes(m.titleId))
                          .reduce((sum, m) => sum + m.valuePaid, 0) || 0;
                        
                        const openValue = docTitles
                          .filter(t => !isSettled(t.status))
                          .reduce((sum, t) => sum + t.value, 0);

                        if (paidValue > 0) {
                           return (
                             <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap flex flex-col items-end">
                               <span>Baixado: {fmt(paidValue)}</span>
                               {Math.abs(openValue) > 0.01 && <span>Aberto: {fmt(openValue)}</span>}
                             </div>
                           );
                        }
                        return null;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {d.condition === 'avista' ? 'À vista' : `Parcelado (${d.installments}x)`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={getDocumentStatus(d.id) as TitleStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditDocumentId(d.id); setSheetOpen(true); }}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar Lançamento
                        </DropdownMenuItem>
                        
                        {(() => {
                           const docTitles = snapshot?.titles.filter(t => t.documentId === d.id);
                           const isSettled = (status: string) => status === 'pago' || status === 'recebido';
                           const hasSettled = docTitles?.some(t => isSettled(t.status));
                           
                           if (!hasSettled) {
                             return (
                               <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground" onClick={() => setDeleteDocumentId(d.id)}>
                                 <Trash2 className="mr-2 h-4 w-4" />
                                 Excluir Lançamento
                               </DropdownMenuItem>
                             );
                           }
                           return null;
                        })()}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum lançamento encontrado neste período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <NewDocumentSheet 
        open={sheetOpen} 
        onOpenChange={setSheetOpen} 
        editDocumentId={editDocumentId} 
      />

      <AlertDialog open={!!deleteDocumentId} onOpenChange={(open) => !open && setDeleteDocumentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const count = snapshot?.titles.filter(x => x.documentId === deleteDocumentId).length || 0;
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
    </div>
  );
}
