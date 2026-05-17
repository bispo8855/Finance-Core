import { useState, useMemo } from 'react';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { PeriodOption, isDateInPeriod } from '@/lib/dateUtils';
import { ExtractHeader } from '@/components/extract/ExtractHeader';
import { ExtractSummary } from '@/components/extract/ExtractSummary';
import { FinancialEventList } from '@/components/extract/FinancialEventList';
import { PeriodFilter } from '@/components/finance/PeriodFilter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { groupMovementsIntoEvents, buildExtractExecutiveMessage, calculateStatementBalances, calculateExtractStats, FinancialEvent } from '@/domain/extract';
import { extractMicrocopy } from '@/config/microcopy';

type EventFilter = 'all' | 'sales' | 'income' | 'fees' | 'reserves' | 'transfers' | 'review' | 'ecommerce';

export default function ExtractPage() {
  const [period, setPeriod] = useState<PeriodOption>('current_month');
  const [accountId, setAccountId] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');

  const { data: snapshot, isLoading } = useFinanceSnapshot();

  const filteredData = useMemo(() => {
    if (!snapshot) return { events: [], filteredEvents: [], balance: 0, inflows: 0, outflows: 0, accountName: '', stats: undefined };

    // 1. Filter raw movements by period and account
    let movements = snapshot.movements.filter(m => isDateInPeriod(m.paymentDate, period));

    if (accountId !== 'all') {
      movements = movements.filter(m => m.accountId === accountId);
    }

    // 2. Transform to events (now with document-level grouping)
    const events = groupMovementsIntoEvents(
      movements,
      snapshot.titles,
      snapshot.documents,
      snapshot.categories,
      snapshot.contacts,
      accountId
    );

    // 3. Calculate Stats
    const balances = calculateStatementBalances(snapshot.movements, snapshot.accounts, period, accountId);
    const accountName = accountId !== 'all' ? snapshot.accounts.find(a => a.id === accountId)?.name : undefined;
    const stats = calculateExtractStats(events);
    const executiveMessage = buildExtractExecutiveMessage(
      { inflows: balances.inflows, outflows: balances.outflows, balance: balances.finalBalance },
      stats
    );

    // 4. Apply event type filter
    const filteredEvents = applyEventFilter(events, eventFilter);

    return { events, filteredEvents, ...balances, accountName, executiveMessage, stats };
  }, [snapshot, period, accountId, eventFilter]);

  if (isLoading || !snapshot) return <div className="p-8 text-center text-muted-foreground">Carregando extrato inteligente...</div>;

  const filterOptions: { id: EventFilter; label: string; count: number }[] = [
    { id: 'all', label: extractMicrocopy.filters.all, count: filteredData.events.length },
    { id: 'sales', label: extractMicrocopy.filters.sales, count: filteredData.events.filter(e => e.eventKind === 'sale_settlement').length },
    { id: 'income', label: extractMicrocopy.filters.income, count: filteredData.events.filter(e => e.type === 'entrada').length },
    { id: 'fees', label: extractMicrocopy.filters.fees, count: filteredData.events.filter(e => e.eventKind === 'standalone_expense' || e.feesAmount > 0).length },
    { id: 'reserves', label: extractMicrocopy.filters.reserves, count: filteredData.events.filter(e => e.eventKind === 'reserve_release' || e.reserveAmount > 0).length },
    { id: 'transfers', label: extractMicrocopy.filters.transfers, count: filteredData.events.filter(e => e.eventKind === 'internal_transfer').length },
    { id: 'review', label: extractMicrocopy.filters.review, count: filteredData.events.filter(e => e.eventKind === 'unclassified').length },
    { id: 'ecommerce', label: extractMicrocopy.filters.ecommerce, count: filteredData.events.filter(e => e.origin === 'ecommerce').length },
  ];

  // Only show filters that have events
  const visibleFilters = filterOptions.filter(f => f.id === 'all' || f.count > 0);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <ExtractHeader />

      {/* Filters Bar */}
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

      {/* Summary */}
      <ExtractSummary
        previousBalance={filteredData.previousBalance}
        inflows={filteredData.inflows}
        outflows={filteredData.outflows}
        finalBalance={filteredData.finalBalance}
        accountName={filteredData.accountName}
        executiveMessage={filteredData.executiveMessage}
        stats={filteredData.stats}
      />

      {/* Event Type Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Eventos Financeiros</h2>
          <div className="flex flex-wrap gap-1.5">
            {visibleFilters.map(f => (
              <button
                key={f.id}
                onClick={() => setEventFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  eventFilter === f.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {f.label}
                {f.id !== 'all' && f.count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    eventFilter === f.id ? 'bg-white/20' : 'bg-muted-foreground/10'
                  }`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <FinancialEventList events={filteredData.filteredEvents} />
      </div>
    </div>
  );
}

function applyEventFilter(events: FinancialEvent[], filter: EventFilter): FinancialEvent[] {
  switch (filter) {
    case 'sales':
      return events.filter(e => e.eventKind === 'sale_settlement');
    case 'income':
      return events.filter(e => e.type === 'entrada');
    case 'fees':
      return events.filter(e => e.eventKind === 'standalone_expense' || e.feesAmount > 0);
    case 'reserves':
      return events.filter(e => e.eventKind === 'reserve_release' || e.reserveAmount > 0);
    case 'transfers':
      return events.filter(e => e.eventKind === 'internal_transfer');
    case 'review':
      return events.filter(e => e.eventKind === 'unclassified');
    case 'ecommerce':
      return events.filter(e => e.origin === 'ecommerce');
    default:
      return events;
  }
}
