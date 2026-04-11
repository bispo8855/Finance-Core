import { useState, useEffect } from 'react';
import { Title } from '@/types/financial';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { useUpdateTitle } from '@/hooks/finance/useUpdateTitle';
import { useToast } from '@/components/ui/use-toast';

interface TitleDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId?: string | null;
}

export function TitleDetailsSheet({ open, onOpenChange, titleId }: TitleDetailsSheetProps) {
  const { data: snapshot } = useFinanceSnapshot();
  const { mutateAsync: updateTitle, isPending } = useUpdateTitle();
  const { toast } = useToast();

  const [dueDate, setDueDate] = useState('');

  const title = snapshot?.titles.find(t => t.id === titleId);
  const document = snapshot?.documents.find(d => d.id === title?.documentId);
  const contact = snapshot?.contacts.find(c => c.id === document?.contactId);

  // Se tem data de baixa, ID de movimento ou status finalizado, não permite editar
  const isSettled = !!title?.settledAt || 
                    !!title?.settlementMovementId || 
                    title?.status === 'pago' || 
                    title?.status === 'recebido';

  useEffect(() => {
    if (open && title) {
      setDueDate(title.dueDate);
    }
  }, [open, title]);

  if (!snapshot || !title) return null;

  const handleSave = async () => {
    if (!dueDate) return;
    try {
      await updateTitle({
        titleId: title.id,
        payload: { dueDate }
      });
      toast({ title: 'Título atualizado com sucesso!' });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Erro ao atualizar título.';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do Título</DialogTitle>
          <DialogDescription>
            Visualize e edite os dados desta parcela específica.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex justify-between items-center bg-muted p-4 rounded-lg">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground uppercase font-bold">Valor da Parcela</span>
              <span className="font-semibold text-2xl">
                R$ {title.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <StatusBadge status={title.status as import('@/types/financial').TitleStatus} />
          </div>

          <div className="space-y-1 p-3 border rounded-lg bg-card">
            <Label className="text-[10px] uppercase text-muted-foreground font-bold">Contexto do Lançamento</Label>
            <p className="text-sm font-medium">{document?.description || 'Sem descrição'}</p>
            <p className="text-xs text-muted-foreground">{contact?.name}</p>
          </div>

          <div className="space-y-2">
            <Label>Data de Vencimento</Label>
            <Input 
              type="date" 
              value={dueDate} 
              onChange={e => setDueDate(e.target.value)} 
              disabled={isSettled}
              className="h-10"
            />
          </div>

          {isSettled && (
             <div className="bg-amber-50 border border-amber-200 p-3 rounded-md mt-2">
               <p className="text-xs text-amber-800 font-medium">
                 Este título já foi baixado. Para alterar dados financeiros, realize o estorno da baixa antes.
               </p>
             </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Sair
          </Button>
          {!isSettled && (
            <Button onClick={handleSave} disabled={isPending || !dueDate || dueDate === title.dueDate}>
              {isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
