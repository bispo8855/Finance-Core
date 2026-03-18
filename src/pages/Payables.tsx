import { useState, useMemo } from 'react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PaymentModal } from '@/components/shared/PaymentModal';
import { NewDocumentSheet } from '@/components/finance/NewDocumentSheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Title, TitleStatus } from '@/types/financial';
import { ArrowUpFromLine, Search, MoreHorizontal, Edit, Trash2, RotateCcw } from 'lucide-react';
import { useTitles } from '@/hooks/finance/useTitles';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { useDeleteTitle } from '@/hooks/finance/useDeleteTitle';
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
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [payTitle, setPayTitle] = useState<Title | null>(null);
  
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editDocumentId, setEditDocumentId] = useState<string | null>(null);
  const [deleteTitleId, setDeleteTitleId] = useState<string | null>(null);
  const [undoTitleId, setUndoTitleId] = useState<string | null>(null);
  const { data: snapshot } = useFinanceSnapshot();
  const { data: pagamentos, isLoading } = useTitles('pagar');
  const { mutateAsync: deleteTitle, isPending: isDeleting } = useDeleteTitle();
  const { mutateAsync: undoSettleTitle, isPending: isUndoing } = useUndoSettleTitle();
  const { toast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];

  const filtered = useMemo(() => {
    if (!pagamentos || !snapshot) return [];
    
    let list = [...pagamentos];

    if (tab === 1) { // Previstos
      list = list.filter(t => t.status === 'previsto' && t.dueDate >= todayStr);
    } else if (tab === 2) { // Vencidos
      list = list.filter(t => t.status === 'previsto' && t.dueDate < todayStr);
    } else if (tab === 3) { // Pagos
      list = list.filter(t => t.status === 'pago');
    }

    if (search) {
      const term = search.toLowerCase();
      list = list.filter(t => {
        const contactName = snapshot.contacts.find(c => c.id === t.contactId)?.name || '';
        return (
          t.description.toLowerCase().includes(term) ||
          contactName.toLowerCase().includes(term) ||
          t.status.toLowerCase().includes(term)
        );
      });
    }

    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [pagamentos, snapshot, tab, search, todayStr]);

  if (isLoading || !snapshot) return <div className="p-8 text-center text-muted-foreground">Carregando títulos...</div>;

  const getContactName = (id: string) => snapshot.contacts.find(c => c.id === id)?.name || '—';

  const handleDeleteConfirm = async () => {
    if (!deleteTitleId) return;
    try {
      await deleteTitle(deleteTitleId);
      toast({ title: 'Sucesso', description: 'Título excluído com sucesso.' });
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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-destructive-subtle flex items-center justify-center">
          <ArrowUpFromLine className="w-5 h-5 text-negative" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} título(s)</p>
        </div>
        <Button className="ml-auto" onClick={() => { setEditDocumentId(null); setSheetOpen(true); }}>
          + Novo a pagar
        </Button>
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
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 w-full sm:w-64">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar fornecedor..." value={search} onChange={e => setSearch(e.target.value)}
              className="border-0 bg-transparent h-auto p-0 text-sm focus-visible:ring-0 shadow-none" />
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
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">{new Date(t.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">{getContactName(t.contactId)}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{t.description}</td>
                  <td className="px-4 py-3">{t.installment}/{t.totalInstallments}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(t.value)}</td>
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
                          <DropdownMenuItem onClick={() => { setEditDocumentId(t.documentId); setSheetOpen(true); }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar Lançamento
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
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Nenhum título encontrado.</td></tr>
              )}
            </tbody>
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
      
      <AlertDialog open={!!deleteTitleId} onOpenChange={(open) => !open && setDeleteTitleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este título? Esta ação não pode ser desfeita.
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
