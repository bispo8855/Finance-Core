import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '@/services/finance';

export function useDeleteTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (titleId: string) => financeService.deleteTitle(titleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] });
    },
  });
}
