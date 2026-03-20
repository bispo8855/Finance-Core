import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '@/services/finance';

export function useUpdateTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ titleId, payload }: { titleId: string, payload: { dueDate?: string; description?: string } }) => {
      return financeService.updateTitle(titleId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-snapshot'] });
      queryClient.invalidateQueries({ queryKey: ['titles'] });
    },
  });
}
