import { describe, it, expect } from 'vitest';
import {
  computeAsOfDate,
  endOfMonthISO,
  toISODate,
  settlementLabel,
} from '@/domain/finance/accrualView';

// Datas construídas em horário local (evita shift de fuso).
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe('toISODate / endOfMonthISO', () => {
  it('toISODate devolve YYYY-MM-DD local', () => {
    expect(toISODate(at(2026, 7, 5))).toBe('2026-07-05');
    expect(toISODate(at(2026, 12, 31))).toBe('2026-12-31');
  });

  it('endOfMonthISO cobre 30/31 dias e fevereiro', () => {
    expect(endOfMonthISO('2026-07')).toBe('2026-07-31');
    expect(endOfMonthISO('2026-06')).toBe('2026-06-30');
    expect(endOfMonthISO('2026-02')).toBe('2026-02-28');
    expect(endOfMonthISO('2024-02')).toBe('2024-02-29'); // bissexto
  });
});

describe('computeAsOfDate — regra única min(hoje, fim do mês)', () => {
  it('mês CORRENTE → hoje', () => {
    expect(computeAsOfDate('2026-07', at(2026, 7, 18))).toBe('2026-07-18');
  });

  it('mês PASSADO → último dia do mês', () => {
    expect(computeAsOfDate('2026-06', at(2026, 7, 18))).toBe('2026-06-30');
    expect(computeAsOfDate('2026-02', at(2026, 7, 18))).toBe('2026-02-28');
  });

  it('mês FUTURO → HOJE (sem forecast, nunca o fim do mês futuro)', () => {
    expect(computeAsOfDate('2026-09', at(2026, 7, 18))).toBe('2026-07-18');
    expect(computeAsOfDate('2027-01', at(2026, 7, 18))).toBe('2026-07-18');
  });

  it('virada de mês e de ano', () => {
    // Último dia do mês corrente → hoje (== fim do mês)
    expect(computeAsOfDate('2026-07', at(2026, 7, 31))).toBe('2026-07-31');
    // Primeiro dia do mês seguinte: julho vira mês passado
    expect(computeAsOfDate('2026-07', at(2026, 8, 1))).toBe('2026-07-31');
    // Virada de ano: dezembro fechado visto em janeiro
    expect(computeAsOfDate('2026-12', at(2027, 1, 3))).toBe('2026-12-31');
    // Janeiro corrente
    expect(computeAsOfDate('2027-01', at(2027, 1, 3))).toBe('2027-01-03');
  });

  it('saída sempre no formato YYYY-MM-DD', () => {
    const casos = [
      computeAsOfDate('2026-07', at(2026, 7, 1)),
      computeAsOfDate('2026-01', at(2026, 7, 18)),
      computeAsOfDate('2030-05', at(2026, 7, 18)),
    ];
    for (const d of casos) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('settlementLabel', () => {
  it('mapeia os 4 status para label + tone', () => {
    expect(settlementLabel('settled')).toEqual({ label: 'Liquidado', tone: 'positive' });
    expect(settlementLabel('partial')).toEqual({ label: 'Parcial', tone: 'neutral' });
    expect(settlementLabel('open')).toEqual({ label: 'Em aberto', tone: 'neutral' });
    expect(settlementLabel('untracked')).toEqual({ label: 'Sem título', tone: 'info' });
  });

  it('untracked NUNCA tem tom de erro (é ausência de rastreio, não falha)', () => {
    const { tone, label } = settlementLabel('untracked');
    expect(['positive', 'neutral', 'info']).toContain(tone);
    expect(tone).not.toBe('error');
    expect(tone).not.toBe('destructive');
    expect(label).toBe('Sem título');
  });

  it('nenhum dos status usa tom de erro', () => {
    const status = ['settled', 'partial', 'open', 'untracked'] as const;
    for (const s of status) {
      expect(['positive', 'neutral', 'info']).toContain(settlementLabel(s).tone);
    }
  });
});
