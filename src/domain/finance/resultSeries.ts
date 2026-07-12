import { FinanceSnapshot } from '@/services/finance/financeService';
import { FinancialEvent } from '@/domain/extract';
import { calculateSemanticResult } from './semanticResult';

// Série de resultado por mês, 100% ancorada no motor semântico.
// buildFinancialComposition roda UMA vez (fora); aqui só chamamos calculateSemanticResult
// (função pura) por mês sobre os MESMOS events.

export interface ResultSeriesPoint {
  mes: string; // 'YYYY-MM'
  receitaLiquida: number;
  resultadoPeriodo: number;
}

export function buildResultSeries(
  events: FinancialEvent[],
  snapshot: FinanceSnapshot,
  months: string[]
): ResultSeriesPoint[] {
  return months.map((mes) => {
    const r = calculateSemanticResult(events, snapshot, mes);
    return { mes, receitaLiquida: r.receitaLiquida, resultadoPeriodo: r.resultadoPeriodo };
  });
}

// Tendência determinística dos últimos 3 meses FECHADOS de resultado (exclui o mês corrente).
// Limiar de 10%; tom neutro, sem alarme.
export function buildResultTrendInsight(
  series: ResultSeriesPoint[],
  currentMonthISO: string
): string {
  const closed = series.filter((p) => p.mes < currentMonthISO);
  const last = closed.slice(-3);
  if (last.length < 2) {
    return 'Ainda não há meses fechados suficientes para identificar uma tendência.';
  }

  const first = last[0].resultadoPeriodo;
  const lastVal = last[last.length - 1].resultadoPeriodo;
  const diff = lastVal - first;

  let direction: 'up' | 'down' | 'flat';
  if (Math.abs(first) === 0) {
    direction = lastVal > 0 ? 'up' : lastVal < 0 ? 'down' : 'flat';
  } else {
    const rel = diff / Math.abs(first);
    direction = rel > 0.1 ? 'up' : rel < -0.1 ? 'down' : 'flat';
  }

  const n = last.length;
  if (direction === 'up') return `O resultado vem subindo nos últimos ${n} meses fechados.`;
  if (direction === 'down') return `O resultado vem recuando nos últimos ${n} meses fechados.`;
  return `O resultado se manteve estável nos últimos ${n} meses fechados.`;
}
