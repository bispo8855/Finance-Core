import { describe, it, expect } from 'vitest';
import { formatDate } from '@/utils/formatters';

describe('formatDate', () => {
  it("parseia 'YYYY-MM-DD' como data local (sem shift de fuso)", () => {
    expect(formatDate('2026-06-01')).toBe('01/06/2026');
    expect(formatDate('2026-05-31')).toBe('31/05/2026');
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });

  it('mantém o comportamento para strings com hora (ISO com T)', () => {
    // Meio-dia evita qualquer ambiguidade de fuso na conversão
    expect(formatDate('2026-06-01T12:00:00.000Z')).toMatch(/^\d{2}\/06\/2026$/);
  });

  it('aceita objeto Date', () => {
    expect(formatDate(new Date(2026, 5, 1))).toBe('01/06/2026');
  });

  it('retorna string vazia para entrada inválida ou vazia', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('data-invalida')).toBe('');
  });
});
