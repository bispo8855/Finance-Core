import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/finance';
import { deriveStatus } from '@/domain/finance/status';

export function useTitles(type: 'receber' | 'pagar') {
  return useQuery({
    queryKey: ['finance', 'snapshot', 'titles', type],
    queryFn: () => financeService.getSnapshot(),
    select: (snapshot) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const virtualTitles = snapshot.titles.map(t => ({
        ...t,
        status: deriveStatus(t, todayStr)
      }));
      return virtualTitles.filter(t => t.side === type);
    },
  });
}
