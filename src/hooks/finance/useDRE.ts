import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/finance';
import { calculateDRE } from '@/domain/finance/dre';

export function useDRE(monthISO: string) {
  return useQuery({
    queryKey: ['finance', 'snapshot', 'dre', monthISO],
    queryFn: () => financeService.getSnapshot(),
    select: (snapshot) => calculateDRE({
      documents: snapshot.documents,
      categories: snapshot.categories,
      monthISO
    }),
  });
}
