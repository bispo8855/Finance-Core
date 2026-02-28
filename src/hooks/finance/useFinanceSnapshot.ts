import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/finance';

export function useFinanceSnapshot() {
  return useQuery({
    queryKey: ['finance', 'snapshot'],
    queryFn: () => financeService.getSnapshot(),
  });
}
