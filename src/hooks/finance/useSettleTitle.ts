import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '@/services/finance';

export function useSettleTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { titleId: string; accountId: string; paymentDate: string; valuePaid: number; notes?: string }) => 
      financeService.settleTitle(variables.titleId, variables.accountId, variables.paymentDate, variables.valuePaid, variables.notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'titles'] });
    },
  });
}
