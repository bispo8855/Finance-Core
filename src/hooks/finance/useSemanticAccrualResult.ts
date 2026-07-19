import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/finance';
import { buildAccrualComposition } from '@/domain/finance/accrualComposition';
import { calculateSemanticResult } from '@/domain/finance/semanticResult';
import { computeAsOfDate } from '@/domain/finance/accrualView';

// ============================================================================
// Etapa C2 — Resultado Gerencial ECONÔMICO (base 'accrual').
//
// CACHE (decisão do desenho §2 / §8.10): esta query reusa a MESMA queryKey do
// useFinanceSnapshot — ['finance','snapshot'] — e faz todo o cálculo no `select`.
// O React Query deduplica observers de mesma key, então o accrual NÃO adiciona
// nenhuma chamada de getSnapshot além da que a página já fazia.
//
// O `select` roda por observer (memoizado pelo React Query) sobre o mesmo dado cru,
// e reage a mudanças de monthISO capturadas no closure.
// ============================================================================
export function useSemanticAccrualResult(
  monthISO: string,
  options?: { confidenceThreshold?: number }
) {
  return useQuery({
    queryKey: ['finance', 'snapshot'], // MESMA key do useFinanceSnapshot (fetch compartilhado)
    queryFn: () => financeService.getSnapshot(),
    select: (snapshot) => {
      const { events, metaByDocumentId } = buildAccrualComposition(
        snapshot.documents,
        snapshot.titles,
        snapshot.categories,
        snapshot.contacts
      );
      const asOfDate = computeAsOfDate(monthISO, new Date());
      return calculateSemanticResult(events, snapshot, monthISO, {
        basis: 'accrual',
        metaByDocumentId,
        asOfDate,
        confidenceThreshold: options?.confidenceThreshold,
      });
    },
  });
}
