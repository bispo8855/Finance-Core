import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '@/services/finance';

export function useUpdateInitialBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { accountId: string; value: number }) => 
      financeService.updateInitialBalance(variables.accountId, variables.value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] });
    },
  });
}
