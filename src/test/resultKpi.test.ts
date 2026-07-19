import { describe, it, expect } from 'vitest';
import { contributionMarginPct, resultBannerText } from '@/domain/finance/resultKpi';

describe('contributionMarginPct', () => {
  it('calcula a razão quando a receita líquida é POSITIVA', () => {
    expect(contributionMarginPct(1000, 250)).toBe(0.25);
    expect(contributionMarginPct(200, 200)).toBe(1);
    // margem negativa com receita positiva continua sendo uma razão válida
    expect(contributionMarginPct(1000, -100)).toBe(-0.1);
  });

  it('devolve null quando a receita líquida é ZERO', () => {
    expect(contributionMarginPct(0, 500)).toBeNull();
    expect(contributionMarginPct(0, 0)).toBeNull();
  });

  it('devolve null quando a receita líquida é NEGATIVA', () => {
    expect(contributionMarginPct(-800, -800)).toBeNull();
    expect(contributionMarginPct(-100, 50)).toBeNull();
  });
});

describe('resultBannerText — 4 ramos', () => {
  it('positivo + mês CORRENTE', () => {
    const b = resultBannerText(1500, true)!;
    expect(b.tone).toBe('positive');
    expect(b.template).toBe('Resultado positivo de {X} até agora.');
    expect(b.amount).toBe(1500);
  });

  it('positivo + mês FECHADO', () => {
    const b = resultBannerText(1500, false)!;
    expect(b.tone).toBe('positive');
    expect(b.template).toBe('Resultado do período positivo de {X}.');
    expect(b.amount).toBe(1500);
  });

  it('negativo + mês CORRENTE (usa magnitude)', () => {
    const b = resultBannerText(-420.5, true)!;
    expect(b.tone).toBe('negative');
    expect(b.template).toBe('O resultado está negativo em {X} até agora.');
    expect(b.amount).toBe(420.5);
  });

  it('negativo + mês FECHADO (usa magnitude)', () => {
    const b = resultBannerText(-420.5, false)!;
    expect(b.tone).toBe('negative');
    expect(b.template).toBe('O período fechou com prejuízo de {X}.');
    expect(b.amount).toBe(420.5);
  });

  it('resultado ZERO não gera banner, em qualquer base temporal', () => {
    expect(resultBannerText(0, true)).toBeNull();
    expect(resultBannerText(0, false)).toBeNull();
  });

  it('o template sempre traz o placeholder {X} e nunca o valor embutido', () => {
    const casos = [
      resultBannerText(10, true)!,
      resultBannerText(10, false)!,
      resultBannerText(-10, true)!,
      resultBannerText(-10, false)!,
    ];
    for (const c of casos) {
      expect(c.template).toContain('{X}');
      expect(c.template).not.toMatch(/\d/); // formatação de moeda fica na página
    }
  });
});
