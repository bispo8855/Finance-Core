import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OutrosReview from '@/components/personal/import/OutrosReview';
import { OutrosDecisions, OutrosItem } from '@/domain/personal/import/outrosReview';

const items: OutrosItem[] = [
  { id: 'A', description: 'PAGAMENTO A FORNECEDORES', amount: 5000, date: '2026-08-10' },
  { id: 'B', description: 'POSTO IPIRANGA', amount: 1000, date: '2026-08-12' },
];

function Harness() {
  const [decisions, setDecisions] = useState<OutrosDecisions>({});
  return <OutrosReview items={items} decisions={decisions} onChange={setDecisions} outrosPct={0.94} />;
}

describe('OutrosReview', () => {
  it('mostra título humano e os maiores itens', () => {
    render(<Harness />);
    expect(screen.getByText('Revise os maiores gastos em Outros')).toBeInTheDocument();
    expect(screen.getByText('PAGAMENTO A FORNECEDORES')).toBeInTheDocument();
    expect(screen.getAllByText('Esse gasto faz parte da sua rotina?').length).toBe(2);
  });

  it('"Sim, é pessoal" revela o seletor de categoria (sem Outros)', () => {
    render(<Harness />);
    // pega o primeiro botão "Sim, é pessoal" (item A)
    fireEvent.click(screen.getAllByText('Sim, é pessoal')[0]);
    const select = screen.getByLabelText('Categoria de PAGAMENTO A FORNECEDORES') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    const opts = Array.from(select.options).map((o) => o.value);
    expect(opts).toContain('Transporte');
    expect(opts).not.toContain('Outros'); // Outros não é opção de reclassificação
  });

  it('"É da empresa" registra a decisão negocio', () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByText('É da empresa')[0]);
    // após clique, o botão fica destacado (estado controlado aplicado)
    const btn = screen.getAllByText('É da empresa')[0];
    expect(btn.className).toMatch(/bg-primary/);
  });
});
