import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/finance';
import { buildFinancialComposition } from '@/domain/extract';
import { calculateSemanticResult } from '@/domain/finance/semanticResult';

// Resultado Gerencial Realizado — consome a camada semântica (semanticBreakdown)
// e agrega item a item pelo motor calculateSemanticResult.
export function useSemanticResult(monthISO: string, options?: { confidenceThreshold?: number }) {
  return useQuery({
    queryKey: ['finance', 'snapshot', 'semanticResult', monthISO, options?.confidenceThreshold ?? null],
    queryFn: () => financeService.getSnapshot(),
    select: (snapshot) => {
      const events = buildFinancialComposition(
        snapshot.movements,
        snapshot.titles,
        snapshot.documents,
        snapshot.categories,
        snapshot.contacts,
        'all'
      );
      return calculateSemanticResult(events, snapshot, monthISO, options);
    },
  });
}
