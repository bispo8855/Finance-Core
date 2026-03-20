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
  const [description, setDescription] = useState('');

  const title = snapshot?.titles.find(t => t.id === titleId);
  // Se está pago ou recebido, não permite editar
  const isSettled = title?.status === 'pago' || title?.status === 'recebido';

  useEffect(() => {
    if (open && title) {
      setDueDate(title.dueDate);
      setDescription(title.description || '');
    }
  }, [open, title]);

  if (!snapshot || !title) return null;

  const handleSave = async () => {
    if (!dueDate) return;
    try {
      await updateTitle({
        titleId: title.id,
        payload: { dueDate, description }
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
          <div className="flex justify-between items-center bg-muted p-3 rounded-lg text-sm">
            <span className="font-semibold text-lg">
              R$ {title.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <StatusBadge status={title.status as import('@/types/financial').TitleStatus} />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Parcela 1/3"
              disabled={isSettled}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Data de Vencimento</Label>
            <Input 
              type="date" 
              value={dueDate} 
              onChange={e => setDueDate(e.target.value)} 
              disabled={isSettled}
            />
          </div>

          {isSettled && (
             <p className="text-xs text-muted-foreground mt-2">
               Este título já possui baixas vinculadas e não pode ser editado.
             </p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Sair
          </Button>
          {!isSettled && (
            <Button onClick={handleSave} disabled={isPending || !dueDate}>
              {isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
