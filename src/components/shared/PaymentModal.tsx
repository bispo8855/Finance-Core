import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinancial } from '@/contexts/FinancialContext';
import { Title } from '@/types/financial';

interface PaymentModalProps {
  title: Title | null;
  open: boolean;
  onClose: () => void;
}

export function PaymentModal({ title, open, onClose }: PaymentModalProps) {
  const { accounts, payTitle } = useFinancial();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [valuePaid, setValuePaid] = useState('');

  const handleOpen = () => {
    if (title) {
      setValuePaid(title.value.toFixed(2));
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setAccountId(accounts[0]?.id ?? '');
    }
  };

  const handleConfirm = () => {
    if (!title) return;
    payTitle(title.id, accountId, paymentDate, parseFloat(valuePaid));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle>Baixar Título</DialogTitle>
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
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valor pago (R$)</Label>
              <Input type="number" step="0.01" value={valuePaid} onChange={e => setValuePaid(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm}>Confirmar Baixa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
