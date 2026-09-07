import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PersonalIncompleteReading, { describeMissingForReading } from '@/components/personal/PersonalIncompleteReading';

const renderIt = (props: React.ComponentProps<typeof PersonalIncompleteReading>) =>
  render(<MemoryRouter><PersonalIncompleteReading {...props} /></MemoryRouter>).container.textContent ?? '';

describe('PersonalIncompleteReading', () => {
  it('mostra estado honesto: saldo, renda e o que falta — sem sobra/projeção/prudente', () => {
    const t = renderIt({ saldoAtual: 65, renda: [{ label: 'CLT', amount: 22000 }], missing: ['dia a dia', 'cartão/fatura', 'contas fixas'] });
    expect(t).toContain('Sua leitura ainda está incompleta.');
    expect(t).toContain('Saldo atual');
    expect(t).toMatch(/65,00/);
    expect(t).toContain('Renda identificada');
    expect(t).toMatch(/22\.000,00/);
    expect(t).toContain('Ainda falta:');
    expect(t).toContain('dia a dia');
    // NÃO deve apresentar conclusões de leitura completa:
    expect(t).not.toMatch(/Sobra estrutural/i);
    expect(t).not.toMatch(/Disponível prudente/i);
    expect(t).not.toMatch(/rotina cabe na renda/i);
    expect(t).not.toMatch(/Saldo projetado/i);
  });

  it('sem conta conhecida → não mostra saldo (não vira zero confiável)', () => {
    const t = renderIt({ saldoAtual: null, renda: [], missing: ['conta', 'renda', 'dia a dia'] });
    expect(t).not.toContain('Saldo atual');
    expect(t).toContain('Ainda falta:');
  });

  it('copy superior reflete o missing real (dia a dia + cartão/fatura)', () => {
    const t = renderIt({ saldoAtual: 65, renda: [], missing: ['dia a dia', 'cartão/fatura'] });
    expect(t).toContain('Ainda preciso entender seus gastos do dia a dia e cartão para calcular quanto realmente sobra.');
    expect(t).not.toContain('contas fixas'); // não menciona o que não falta
  });

  it('copy superior com um único item (contas fixas)', () => {
    const t = renderIt({ saldoAtual: 65, renda: [], missing: ['contas fixas'] });
    expect(t).toContain('Ainda preciso entender suas contas fixas para calcular quanto realmente sobra.');
  });
});

describe('describeMissingForReading', () => {
  it('1 item → sem conjunção', () => {
    expect(describeMissingForReading(['contas fixas'])).toBe('suas contas fixas');
  });
  it('2 itens → "a e b"', () => {
    expect(describeMissingForReading(['dia a dia', 'cartão/fatura'])).toBe('seus gastos do dia a dia e cartão');
  });
  it('3 itens → "a, b e c"', () => {
    expect(describeMissingForReading(['dia a dia', 'contas fixas', 'cartão/fatura']))
      .toBe('seus gastos do dia a dia, suas contas fixas e cartão');
  });
  it('vazio → string vazia', () => {
    expect(describeMissingForReading([])).toBe('');
  });
});
