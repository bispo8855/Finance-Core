import { SemanticResult } from './semanticResult';

// Alertas de qualidade do Resultado Gerencial Realizado.
// Função PURA (testável) — não altera o motor; deriva tudo do result já calculado.

export type ResultAlertTone = 'amber' | 'info';

export interface ResultAlert {
  id: 'review' | 'card' | 'cash_result_gap' | 'investment';
  tone: ResultAlertTone;
  message: string;
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function buildResultAlerts(result: SemanticResult): ResultAlert[] {
  const fora = result.foraDoResultado;
  const byReasons = (reasons: string[]) => fora.filter((f) => reasons.includes(f.reason));
  const sumAbs = (items: { amount: number }[]) => items.reduce((s, i) => s + Math.abs(i.amount), 0);

  // Empurrados na ordem de prioridade b > a > c > d; corte em 3 no final.
  const alerts: ResultAlert[] = [];

  // b. Pendentes / sem categoria / baixa confiança
  const review = byReasons(['pending', 'unclassified', 'categoria_nao_resolvida', 'low_confidence']);
  if (review.length > 0) {
    const n = review.length;
    alerts.push({
      id: 'review',
      tone: 'amber',
      message: `${n} ${n === 1 ? 'movimentação precisa' : 'movimentações precisam'} de revisão e ${n === 1 ? 'pode' : 'podem'} alterar o resultado.`,
    });
  }

  // a. Pagamento de cartão (movimentação financeira neutra)
  const card = byReasons(['financial_movement']);
  if (card.length > 0) {
    alerts.push({
      id: 'card',
      tone: 'amber',
      message:
        'Pagamentos de cartão foram tratados como movimentação financeira. Classifique os gastos internos da fatura para refletir corretamente o resultado.',
    });
  }

  // c. Divergência caixa × resultado (> 1% da receita bruta E > R$ 1)
  // Compara o caixa com o RESULTADO do período: itens como cartão entram nos dois totais
  // de affectsResult e mascarariam o gap se comparássemos com totalAffectsResult.
  const gap = Math.abs(result.meta.totalAffectsCash - result.resultadoPeriodo);
  const relThreshold = Math.abs(result.receitaBruta) * 0.01;
  if (gap > relThreshold && gap > 1) {
    alerts.push({
      id: 'cash_result_gap',
      tone: 'info',
      message: `O caixa do período difere do resultado em ${brl(gap)} — normalmente por reservas, transferências ou parcelamentos.`,
    });
  }

  // d. Investimentos fora do resultado
  const invest = byReasons(['investimento']);
  if (invest.length > 0) {
    alerts.push({
      id: 'investment',
      tone: 'info',
      message: `Investimentos de ${brl(sumAbs(invest))} ficaram fora do resultado operacional.`,
    });
  }

  return alerts.slice(0, 3);
}
