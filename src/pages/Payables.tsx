import { useState, useMemo } from 'react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PaymentModal } from '@/components/shared/PaymentModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Title, TitleStatus } from '@/types/financial';
import { ArrowUpFromLine, Search } from 'lucide-react';
import { useTitles } from '@/hooks/finance/useTitles';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { daysOverdue } from '@/domain/finance/status';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const tabs: { label: string; statuses: TitleStatus[] }[] = [
  { label: 'Todos', statuses: [] },
  { label: 'Previstos', statuses: ['previsto'] },
  { label: 'Vencidos', statuses: ['atrasado'] },
  { label: 'Pagos', statuses: ['pago'] },
];

export default function Payables() {
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [payTitle, setPayTitle] = useState<Title | null>(null);

  const { data: snapshot } = useFinanceSnapshot();
  const { data: pagamentos, isLoading } = useTitles('pagar');

  const todayStr = new Date().toISOString().split('T')[0];

  const filtered = useMemo(() => {
    if (!pagamentos || !snapshot) return [];
    let list = pagamentos;
    if (tabs[tab].statuses.length > 0) {
      list = list.filter(t => tabs[tab].statuses.includes(t.status));
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(t => {
        const cNome = snapshot.contacts.find(c => c.id === t.contactId)?.name || '';
        return t.description.toLowerCase().includes(s) || cNome.toLowerCase().includes(s);
      });
    }
    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [pagamentos, snapshot, tab, search]);

  if (isLoading || !snapshot) return <div className="p-8 text-center text-muted-foreground">Carregando títulos...</div>;

  const getContactName = (id: string) => snapshot.contacts.find(c => c.id === id)?.name || '—';

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
                  <td className="px-4 py-3 text-center"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-center">
                    {t.status === 'atrasado' ? <span className="text-xs font-medium text-negative">{daysOverdue(t.dueDate, todayStr)}d</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {['previsto', 'atrasado'].includes(t.status) && (
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => setPayTitle(t)}>Baixar</Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum título encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaymentModal title={payTitle} open={!!payTitle} onClose={() => setPayTitle(null)} />
    </div>
  );
}
