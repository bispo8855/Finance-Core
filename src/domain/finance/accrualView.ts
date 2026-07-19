import { RecognitionMeta } from './recognitionMeta';

// ============================================================================
// Etapa C2 — Helpers PUROS de apresentação da base Econômica (accrual).
// Sem React, sem I/O. Desenho: docs/etapa-c2-desenho-tecnico.md (§2, §5, §6).
// ============================================================================

const pad = (n: number) => String(n).padStart(2, '0');

/** Data local em 'YYYY-MM-DD' (evita o shift de fuso do toISOString). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Último dia do mês em 'YYYY-MM-DD'. monthISO = 'YYYY-MM'. */
export function endOfMonthISO(monthISO: string): string {
  const [y, m] = monthISO.split('-').map(Number);
  // new Date(y, m, 0): m é 1-based aqui → dia 0 do mês seguinte = último dia do mês m.
  const day = new Date(y, m, 0).getDate();
  return `${monthISO}-${pad(day)}`;
}

/**
 * Regra ÚNICA (Rev. C2 §2): asOf = min(hoje, fim do mês).
 *  - mês corrente → hoje (corta competência futura dentro do mês);
 *  - mês passado  → último dia do mês;
 *  - mês futuro   → HOJE (o Aurys NÃO reconhece forecast).
 * Comparação lexicográfica é segura para 'YYYY-MM-DD'.
 */
export function computeAsOfDate(monthISO: string, now: Date): string {
  const today = toISODate(now);
  const eom = endOfMonthISO(monthISO);
  return today < eom ? today : eom;
}

// Tons de exibição do status de liquidação.
// NENHUM é de erro: 'untracked' é ausência de rastreio, não falha (§7 R7).
export type SettlementTone = 'positive' | 'neutral' | 'info';

export interface SettlementLabel {
  label: string;
  tone: SettlementTone;
}

export function settlementLabel(status: RecognitionMeta['settlementStatus']): SettlementLabel {
  switch (status) {
    case 'settled':
      return { label: 'Liquidado', tone: 'positive' };
    case 'partial':
      return { label: 'Parcial', tone: 'neutral' };
    case 'open':
      return { label: 'Em aberto', tone: 'neutral' };
    case 'untracked':
      return { label: 'Sem título', tone: 'info' };
  }
}
