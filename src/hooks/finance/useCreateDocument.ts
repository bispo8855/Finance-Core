import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '@/services/finance';
import { CreateDocumentPayload } from '@/services/finance/financeService';

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { payload: CreateDocumentPayload; payNow?: boolean; accountId?: string }) => 
      financeService.createDocument(variables.payload, variables.payNow, variables.accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] });
    },
  });
}
