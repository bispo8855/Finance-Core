import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/finance';
import { calculateManagerialDashboard } from '@/domain/finance/managerialDashboard';

export function useManagerialDashboard(currentMonthISO: string) {
  return useQuery({
    queryKey: ['finance', 'managerial-dashboard', currentMonthISO],
    queryFn: () => financeService.getSnapshot(),
    select: (snapshot) => {
      const today = new Date();
      // Ensure local timezone doesn't mess up the reference date
      // We'll just generate the ISO string formatted manually
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const referenceDateISO = `${y}-${m}-${d}`;

      return calculateManagerialDashboard({
        ...snapshot,
        currentMonthISO,
        referenceDateISO
      });
    },
  });
}
