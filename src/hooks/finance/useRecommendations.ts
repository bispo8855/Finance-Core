import { useMemo } from 'react';
import { useFinanceSnapshot } from './useFinanceSnapshot';
import { generateRecommendations } from '@/domain/finance/recommendationEngine';

export function useRecommendations(currentMonthISO: string) {
  const { data: snapshot, isLoading } = useFinanceSnapshot();

  const recommendations = useMemo(() => {
    if (!snapshot) return [];

    const today = new Date();
    const referenceDateISO = today.toISOString().split('T')[0];

    return generateRecommendations({
      ...snapshot,
      currentMonthISO,
      referenceDateISO
    });
  }, [snapshot, currentMonthISO]);

  return { recommendations, isLoading };
}
