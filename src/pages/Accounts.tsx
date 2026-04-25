import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Building2, Plus, Trash2, Pencil } from 'lucide-react';
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from '@/hooks/finance/useCatalogs';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { BankAccount } from '@/types/financial';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export default function Accounts() {
  const { accounts } = useAccounts();
  const { data: snapshot } = useFinanceSnapshot();
  const { mutateAsync: addAccount, isPending: isAdding } = useCreateAccount();
  const { mutateAsync: updateAccount, isPending: isUpdating } = useUpdateAccount();
  const { mutateAsync: deleteAccount, isPending: isDeleting } = useDeleteAccount();

  const activeAccounts = accounts.filter(a => a.isActive !== false);

  const [open, setOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<'banco' | 'caixa'>('banco');
  const [institution, setInstitution] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingBalanceDate, setOpeningBalanceDate] = useState('');

  const getAccountBalance = (accountId: string) => {
    if (!snapshot) return 0;
    const account = snapshot.accounts.find(a => a.id === accountId);
    if (!account) return 0;
    
    const today = new Date().toISOString().split('T')[0];
    const openDate = account.openingBalanceDate || '1970-01-01';
    
    if (openDate > today) return 0;

    let balance = account.openingBalance;
    snapshot.movements.filter(m => m.accountId === accountId).forEach(m => {
      if (m.paymentDate >= openDate && m.paymentDate <= today) {
        if (m.type === 'entrada') balance += m.valuePaid;
        else balance -= m.valuePaid;
      }
    });
    return balance;
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setName('');
    setType('banco');
    setInstitution('');
    setOpeningBalance('');
    setOpeningBalanceDate('');
    setOpen(true);
  };

  const openEditModal = (account: BankAccount) => {
    setModalMode('edit');
    setEditingId(account.id);
    setName(account.name);
    setType(account.type);
    setInstitution(account.institution || '');
    setOpeningBalance(account.openingBalance.toString());
    setOpeningBalanceDate(account.openingBalanceDate || '');
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    
    let defaultBalance = parseFloat(openingBalance) || 0;
    let defaultDate = openingBalanceDate;

    if (openingBalance && !openingBalanceDate) {
      defaultDate = new Date().toISOString().split('T')[0];
    } else if (openingBalanceDate && !openingBalance) {
      defaultBalance = 0;
    }

    const payload = { 
      name: name.trim(), 
      type, 
      institution: institution.trim() || undefined,
      initialBalance: defaultBalance, 
      openingBalance: defaultBalance, 
      openingBalanceDate: defaultDate || null 
    };

    try {
      if (modalMode === 'create') {
        await addAccount(payload);
      } else if (modalMode === 'edit' && editingId) {
        await updateAccount({ id: editingId, payload });
      }
      setOpen(false);
    } catch (error) {
      const e = error as Error;
      console.error("Erro ao salvar conta:", e);
      alert(`Erro ao salvar: ${e.message || 'Verifique se as colunas (institution, is_active) existem no Supabase.'}`);
    }
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
        <Button size="sm" onClick={openCreateModal} className="gap-1.5" disabled={isAdding || isUpdating || isDeleting}>
          <Plus className="w-4 h-4" /> Nova Conta
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="divide-y">
          {activeAccounts.map(a => (
            <div key={a.id} className="flex items-center justify-between px-4 py-4 hover:bg-muted/30 transition-colors">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{a.name} {a.institution ? `(${a.institution})` : ''}</p>
                <p className="text-xs text-muted-foreground capitalize">{a.type}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Saldo atual</p>
                  <p className="text-sm font-bold">{fmt(getAccountBalance(a.id))}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditModal(a)} disabled={isDeleting || isUpdating}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-negative" onClick={() => deleteAccount(a.id)} disabled={isDeleting || isUpdating}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {activeAccounts.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma conta encontrada.</p>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{modalMode === 'create' ? 'Nova Conta' : 'Editar Conta'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Conta</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Minha Conta PJ" disabled={isAdding || isUpdating} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Tipo</Label>
                 <Select value={type} onValueChange={v => setType(v as 'banco' | 'caixa')} disabled={isAdding || isUpdating}>
                   <SelectTrigger><SelectValue /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="banco">Banco</SelectItem>
                     <SelectItem value="caixa">Caixa</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Instituição Financeira</Label>
                 <Input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Ex: Nubank, Itaú..." disabled={isAdding || isUpdating} />
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Saldo Inicial (R$)</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} disabled={isAdding || isUpdating} />
              </div>
              <div className="space-y-2">
                <Label>Data de implantação</Label>
                <Input type="date" value={openingBalanceDate} onChange={e => setOpeningBalanceDate(e.target.value)} disabled={isAdding || isUpdating} max={new Date().toISOString().split('T')[0]} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isAdding || isUpdating}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isAdding || isUpdating || !name.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
