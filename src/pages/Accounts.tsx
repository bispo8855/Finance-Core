import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { useAccounts, useCreateAccount, useDeleteAccount } from '@/hooks/finance/useCatalogs';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export default function Accounts() {
  const { accounts } = useAccounts();
  const { data: snapshot } = useFinanceSnapshot();
  const { mutateAsync: addAccount, isPending: isAdding } = useCreateAccount();
  const { mutateAsync: deleteAccount, isPending: isDeleting } = useDeleteAccount();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'banco' | 'caixa'>('banco');
  const [initialBalance, setInitialBalance] = useState('0');

  const getAccountBalance = (accountId: string) => {
    if (!snapshot) return 0;
    const account = snapshot.accounts.find(a => a.id === accountId);
    if (!account) return 0;
    
    let balance = account.initialBalance;
    snapshot.movements.filter(m => m.accountId === accountId).forEach(m => {
      if (m.type === 'entrada') balance += m.valuePaid;
      else balance -= m.valuePaid;
    });
    return balance;
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    await addAccount({ name: name.trim(), type, initialBalance: parseFloat(initialBalance) || 0 });
    setName('');
    setInitialBalance('0');
    setOpen(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Building2 className="w-5 h-5 text-accent-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Contas</h1>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5" disabled={isAdding || isDeleting}>
          <Plus className="w-4 h-4" /> Nova Conta
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="divide-y">
          {accounts.map(a => (
            <div key={a.id} className="flex items-center justify-between px-4 py-4 hover:bg-muted/30 transition-colors">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{a.type}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Saldo atual</p>
                  <p className="text-sm font-bold">{fmt(getAccountBalance(a.id))}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-negative" onClick={() => deleteAccount(a.id)} disabled={isDeleting}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {accounts.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma conta encontrada.</p>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova Conta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Nubank" disabled={isAdding} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={v => setType(v as 'banco' | 'caixa')} disabled={isAdding}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="banco">Banco</SelectItem>
                  <SelectItem value="caixa">Caixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Saldo Inicial (R$)</Label>
              <Input type="number" step="0.01" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} disabled={isAdding} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isAdding}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={isAdding}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
