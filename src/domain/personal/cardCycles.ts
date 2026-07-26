// ============================================================================
// Aurys Personal — ciclos e faturas de cartão + utilitários de data (base).
// Datas são strings ISO ('YYYY-MM-DD' / 'YYYY-MM'); comparação lexical == cronológica.
// R7 (risco técnico mais alto): card_bill é entidade de 1ª classe com ciclo explícito.
// ============================================================================

import { Card, CardBill } from './types';

export const pad2 = (n: number): string => String(n).padStart(2, '0');

export function daysInMonth(monthISO: string): number {
  const [y, m] = monthISO.split('-').map(Number);
  return new Date(y, m, 0).getDate(); // dia 0 do mês seguinte = último dia deste
}

/** monthISO + day, com clamp ao último dia do mês (ex.: dia 31 em fevereiro → 28/29). */
export function ymd(monthISO: string, day: number): string {
  const dim = daysInMonth(monthISO);
  return `${monthISO}-${pad2(Math.min(day, dim))}`;
}

export const monthOf = (dateISO: string): string => dateISO.slice(0, 7);
export const dayOf = (dateISO: string): number => Number(dateISO.slice(8, 10));
export const endOfMonthISO = (monthISO: string): string => ymd(monthISO, daysInMonth(monthISO));
export const startOfMonthISO = (monthISO: string): string => `${monthISO}-01`;

export function addMonthsISO(monthISO: string, n: number): string {
  const [y, m] = monthISO.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad2(nm)}`;
}

export function addDaysISO(dateISO: string, n: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** min/max cronológico entre duas datas ISO. */
export const minISO = (a: string, b: string): string => (a <= b ? a : b);
export const maxISO = (a: string, b: string): string => (a >= b ? a : b);

/** true se dateISO ∈ [startISO, endISO] (inclusivo). */
export const inWindow = (dateISO: string, startISO: string, endISO: string): boolean =>
  dateISO >= startISO && dateISO <= endISO;

// --------------------------------------------------------------------------
// Ciclos de cartão
// --------------------------------------------------------------------------

export interface CardCycle {
  cardId: string;
  cycleStart: string;
  cycleEnd: string;
  dueDate: string;
}

/**
 * Ciclo cuja FATURA vence em monthISO. O consumo fecha no closingDay e a fatura
 * vence no dueDay. Se dueDay <= closingDay, o vencimento cai no mês seguinte ao
 * fechamento (padrão dos cartões). Modelo conservador para estimativa quando não
 * há CardBill explícita.
 */
export function cycleDueInMonth(card: Card, monthISO: string): CardCycle {
  const dueDate = ymd(monthISO, card.dueDay);
  // O fechamento do ciclo que gera esta fatura é o closingDay imediatamente anterior ao vencimento.
  const closingMonth = card.dueDay > card.closingDay ? monthISO : addMonthsISO(monthISO, -1);
  const cycleEnd = ymd(closingMonth, card.closingDay);
  const cycleStart = addDaysISO(ymd(addMonthsISO(closingMonth, -1), card.closingDay), 1);
  return { cardId: card.id, cycleStart, cycleEnd, dueDate };
}

/** Faturas com vencimento na janela [startISO, endISO]. R1/R2: a fatura é o evento de caixa. */
export function billsDueInWindow(bills: CardBill[], startISO: string, endISO: string): CardBill[] {
  return bills.filter((b) => inWindow(b.dueDate, startISO, endISO));
}
