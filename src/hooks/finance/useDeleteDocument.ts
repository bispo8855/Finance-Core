import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '@/services/finance';

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => financeService.deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] });
    },
  });
}
