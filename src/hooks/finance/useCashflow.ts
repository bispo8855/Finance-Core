import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/finance';
import { calculateCashflow } from '@/domain/finance/cashflow';

export function useCashflow({ startDateISO, rangeDays }: { startDateISO: string; rangeDays: number }) {
  return useQuery({
    queryKey: ['finance', 'snapshot', 'cashflow', startDateISO, rangeDays],
    queryFn: () => financeService.getSnapshot(),
    select: (snapshot) => calculateCashflow({
      titles: snapshot.titles,
      movements: snapshot.movements,
      accounts: snapshot.accounts,
      startDateISO,
      rangeDays
    }),
  });
}
