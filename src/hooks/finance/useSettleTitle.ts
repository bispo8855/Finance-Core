import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '@/services/finance';

export function useSettleTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { titleId: string; accountId: string; paymentDate: string; valuePaid: number }) => 
      financeService.settleTitle(variables.titleId, variables.accountId, variables.paymentDate, variables.valuePaid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] });
    },
  });
}
