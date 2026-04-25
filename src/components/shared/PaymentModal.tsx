import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Title } from '@/types/financial';
import { useSettleTitle } from '@/hooks/finance/useSettleTitle';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';

interface PaymentModalProps {
  title: Title | null;
  open: boolean;
  onClose: () => void;
}

export function PaymentModal({ title, open, onClose }: PaymentModalProps) {
  const { data: snapshot } = useFinanceSnapshot();
  const { mutateAsync: settleTitle, isPending } = useSettleTitle();

  const accounts = snapshot?.accounts || [];
  
  const [accountId, setAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [valuePaid, setValuePaid] = useState('');
  const [notes, setNotes] = useState('');

  const handleOpen = () => {
    if (title) {
      setValuePaid(title.value.toFixed(2));
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setAccountId(accounts[0]?.id ?? '');
      setNotes('');
    }
  };

  const handleConfirm = async () => {
    if (!title || !accountId) return;
    try {
      await settleTitle({
        titleId: title.id,
        accountId,
        paymentDate,
        valuePaid: parseFloat(valuePaid),
        notes: notes.trim() || undefined
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert('Erro ao baixar título');
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent 
        className="sm:max-w-md" 
        onOpenAutoFocus={handleOpen}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Baixar Título</DialogTitle>
          <DialogDescription className="hidden">Preencha os dados para registrar o pagamento.</DialogDescription>
        </DialogHeader>
        {title && (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium">{title.description}</p>
              <p className="text-muted-foreground">Valor: R$ {title.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-muted-foreground">Vencimento: {new Date(title.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={accountId} onValueChange={setAccountId} disabled={isPending}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>Valor pago (R$)</Label>
              <Input type="number" step="0.01" value={valuePaid} onChange={e => setValuePaid(e.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>Observação (Opcional)</Label>
              <Input type="text" placeholder="Ex: Pago via PIX" value={notes} onChange={e => setNotes(e.target.value)} disabled={isPending} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={isPending || !accountId}>Confirmar Baixa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
