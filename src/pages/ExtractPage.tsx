import { useState, useMemo } from 'react';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { PeriodOption, isDateInPeriod } from '@/lib/dateUtils';
import { ExtractHeader } from '@/components/extract/ExtractHeader';
import { ExtractSummary } from '@/components/extract/ExtractSummary';
import { FinancialEventList } from '@/components/extract/FinancialEventList';
import { PeriodFilter } from '@/components/finance/PeriodFilter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { groupMovementsIntoEvents, buildExtractExecutiveMessage, calculateStatementBalances } from '@/domain/extract';

export default function ExtractPage() {
  const [period, setPeriod] = useState<PeriodOption>('current_month');
  const [accountId, setAccountId] = useState<string>('all');

  const { data: snapshot, isLoading } = useFinanceSnapshot();

  const filteredData = useMemo(() => {
    if (!snapshot) return { events: [], balance: 0, inflows: 0, outflows: 0, accountName: '' };

    // 1. Filter raw movements by period and account
    let movements = snapshot.movements.filter(m => isDateInPeriod(m.paymentDate, period));
    
    if (accountId !== 'all') {
      movements = movements.filter(m => m.accountId === accountId);
    }

    // 2. Transform to events
    const events = groupMovementsIntoEvents(
      movements,
      snapshot.titles,
      snapshot.documents,
      snapshot.categories
    );

    // 3. Calculate Stats
    const balances = calculateStatementBalances(snapshot.movements, snapshot.accounts, period, accountId);
    const accountName = accountId !== 'all' ? snapshot.accounts.find(a => a.id === accountId)?.name : undefined;
    const executiveMessage = buildExtractExecutiveMessage({ inflows: balances.inflows, outflows: balances.outflows, balance: balances.finalBalance });

    return { events, ...balances, accountName, executiveMessage };
  }, [snapshot, period, accountId]);

  if (isLoading || !snapshot) return <div className="p-8 text-center text-muted-foreground">Carregando extrato inteligente...</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <ExtractHeader />

      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-xl border border-muted-foreground/10">
        <PeriodFilter value={period} onChange={setPeriod} className="h-9 w-[180px] bg-background" />
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-[220px] h-9 bg-background">
            <SelectValue placeholder="Todas as contas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {snapshot.accounts.map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ExtractSummary 
        previousBalance={filteredData.previousBalance} 
        inflows={filteredData.inflows} 
        outflows={filteredData.outflows} 
        finalBalance={filteredData.finalBalance}
        accountName={filteredData.accountName}
        executiveMessage={filteredData.executiveMessage}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Movimentações Detalhadas</h2>
          <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
            {filteredData.events.length} Eventos
          </span>
        </div>
        <FinancialEventList events={filteredData.events} />
      </div>
    </div>
  );
}
