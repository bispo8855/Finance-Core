// ============================================================================
// Etapa C2.1 — Helpers PUROS de KPI e banner da página Resultado.
// Sem React, sem formatação de moeda, sem cor: a página decide a apresentação.
// ============================================================================

/**
 * Margem de contribuição percentual (fração, não %).
 * Só é definida quando há receita líquida POSITIVA — com receita zero ou
 * negativa a razão não tem leitura honesta, então devolve null ("—" na UI).
 */
export function contributionMarginPct(
  receitaLiquida: number,
  margemContribuicao: number
): number | null {
  return receitaLiquida > 0 ? margemContribuicao / receitaLiquida : null;
}

export type ResultBannerTone = 'positive' | 'negative';

export interface ResultBannerText {
  tone: ResultBannerTone;
  /** Texto com {X} no lugar do valor — a página formata a moeda. */
  template: string;
  /** Valor a exibir (magnitude; a página aplica o formato). */
  amount: number;
}

/**
 * Texto do banner de resultado, ciente de mês corrente × fechado.
 * Resultado zero → null (sem banner).
 */
export function resultBannerText(
  resultadoPeriodo: number,
  isCurrentMonth: boolean
): ResultBannerText | null {
  if (resultadoPeriodo > 0) {
    return {
      tone: 'positive',
      template: isCurrentMonth
        ? 'Resultado positivo de {X} até agora.'
        : 'Resultado do período positivo de {X}.',
      amount: resultadoPeriodo,
    };
  }
  if (resultadoPeriodo < 0) {
    return {
      tone: 'negative',
      template: isCurrentMonth
        ? 'O resultado está negativo em {X} até agora.'
        : 'O período fechou com prejuízo de {X}.',
      amount: Math.abs(resultadoPeriodo),
    };
  }
  return null; // zero: sem banner
}
