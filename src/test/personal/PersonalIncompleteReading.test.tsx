import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PersonalIncompleteReading from '@/components/personal/PersonalIncompleteReading';

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
});
