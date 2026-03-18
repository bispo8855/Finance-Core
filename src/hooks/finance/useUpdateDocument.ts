import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '@/services/finance';
import { CreateDocumentPayload } from '@/services/finance/financeService';

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { documentId: string; payload: CreateDocumentPayload }) => 
      financeService.updateDocument(variables.documentId, variables.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] });
    },
  });
}
