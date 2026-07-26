// ============================================================================
// Aurys Personal — modelo de confiança (R7).
// Propagação pelo PIOR elo: todo número herda a pior confiança de suas entradas.
// ============================================================================

import { Confidence } from './types';

const RANK: Record<Confidence, number> = { baixa: 0, media: 1, alta: 2 };

/**
 * Pior confiança entre as informadas. Sem entradas → 'alta' (nada a rebaixar).
 * É o elemento neutro correto: um número sem premissas incertas não é rebaixado.
 */
export function worst(...cs: (Confidence | undefined)[]): Confidence {
  let w: Confidence = 'alta';
  for (const c of cs) {
    if (c && RANK[c] < RANK[w]) w = c;
  }
  return w;
}

export function worstOf<T>(items: T[], pick: (t: T) => Confidence | undefined): Confidence {
  return worst(...items.map(pick));
}
