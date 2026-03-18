import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '@/services/finance';

export function useUndoSettleTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (titleId: string) => financeService.undoSettleTitle(titleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'titles'] });
    },
  });
}
