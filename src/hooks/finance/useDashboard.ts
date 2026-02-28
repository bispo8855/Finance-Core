import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/finance';
import { calculateDashboardKPIs } from '@/domain/finance/dashboard';

export function useDashboard(monthISO: string) {
  return useQuery({
    queryKey: ['finance', 'snapshot', 'dashboard', monthISO],
    queryFn: () => financeService.getSnapshot(),
    select: (snapshot) => {
      const today = new Date();
      const referenceDateISO = today.toISOString().split('T')[0];
      return calculateDashboardKPIs({
        ...snapshot,
        monthISO,
        referenceDateISO
      });
    },
  });
}
