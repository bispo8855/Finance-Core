import { useMemo } from 'react';
import { useFinanceSnapshot } from './useFinanceSnapshot';
import { 
  calculateBaseMetrics, 
  calculateAlertsAndStatus, 
  calculateDriversAndInsights, 
  calculateEvolution,
  calculateManagerialDashboard
} from '@/domain/finance/managerialDashboard';

function getReferenceDateISO() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function useDashboardSummary(currentMonthISO: string) {
  const { data: snapshot, isLoading } = useFinanceSnapshot();

  const data = useMemo(() => {
    if (!snapshot) return null;
    const params = { ...snapshot, currentMonthISO, referenceDateISO: getReferenceDateISO() };
    const metrics = calculateBaseMetrics(params);
    const { statusGeral } = calculateAlertsAndStatus(params, metrics);
    
    return {
      receitaLiquida: metrics.receitaLiquida,
      resultadoLiquido: metrics.resultadoLiquido,
      margem: metrics.margem,
      caixaAtual: metrics.caixaAtual,
      statusGeral
    };
  }, [snapshot, currentMonthISO]);

  return { data, isLoading };
}

export function useDashboardAlerts(currentMonthISO: string) {
  const { data: snapshot, isLoading } = useFinanceSnapshot();

  const data = useMemo(() => {
    if (!snapshot) return null;
    const params = { ...snapshot, currentMonthISO, referenceDateISO: getReferenceDateISO() };
    const metrics = calculateBaseMetrics(params);
    const { alertas } = calculateAlertsAndStatus(params, metrics);
    const { insights } = calculateDriversAndInsights(params, metrics, alertas);
    
    return { alertas, insights };
  }, [snapshot, currentMonthISO]);

  return { data, isLoading };
}

export function useDashboardDrivers(currentMonthISO: string) {
  const { data: snapshot, isLoading } = useFinanceSnapshot();

  const data = useMemo(() => {
    if (!snapshot) return null;
    const params = { ...snapshot, currentMonthISO, referenceDateISO: getReferenceDateISO() };
    const metrics = calculateBaseMetrics(params);
    const { alertas } = calculateAlertsAndStatus(params, metrics);
    const { drivers } = calculateDriversAndInsights(params, metrics, alertas);
    
    return { drivers };
  }, [snapshot, currentMonthISO]);

  return { data, isLoading };
}

export function useDashboardEvolution(currentMonthISO: string, enabled: boolean = true) {
  const { data: snapshot, isLoading } = useFinanceSnapshot();

  const data = useMemo(() => {
    if (!enabled || !snapshot) return null;
    const params = { ...snapshot, currentMonthISO, referenceDateISO: getReferenceDateISO() };
    return calculateEvolution(params);
  }, [snapshot, currentMonthISO, enabled]);

  return { data, isLoading };
}

// Keep the old one just in case 
export function useManagerialDashboard(currentMonthISO: string) {
  const { data: snapshot, isLoading } = useFinanceSnapshot();

  const data = useMemo(() => {
    if (!snapshot) return null;
    const params = { ...snapshot, currentMonthISO, referenceDateISO: getReferenceDateISO() };
    return calculateManagerialDashboard(params);
  }, [snapshot, currentMonthISO]);

  return { data, isLoading };
}
