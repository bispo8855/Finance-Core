import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AurysFindings from '@/components/personal/import/AurysFindings';
import { inferFromLines } from '@/domain/personal/import/personalImportInference';
import { NormalizedLine } from '@/domain/personal/import/personalStatementParser';

let seq = 0;
const line = (date: string, description: string, amount: number, direction: 'entrada' | 'saida'): NormalizedLine =>
  ({ date, description, amount, direction, sourceRow: seq++, confidence: 'alta', issues: [] });

// Extrato com conta MISTA (termo PJ) e PERÍODO PARCIAL (início dia 5, fim dia 15).
const summaryMistoParcial = () =>
  inferFromLines([
    line('2026-06-05', 'Salario ACME', 9000, 'entrada'),
    line('2026-07-05', 'Salario ACME', 9000, 'entrada'),
    line('2026-07-10', 'Pagamento a fornecedores', 500, 'saida'),
    line('2026-07-15', 'IFOOD', 45, 'saida'),
  ], { titular: 'joao teste', accountBalance: 1234.5 });

// Extrato "limpo": meses completos (dia 1 → último dia) e sem termos PJ.
const summaryLimpo = () =>
  inferFromLines([
    line('2026-06-01', 'Aluguel Imobiliaria', 1000, 'saida'),
    line('2026-07-31', 'IFOOD', 40, 'saida'),
  ]);

describe('AurysFindings — renderiza os blocos a partir do ImportSummary', () => {
  it('mostra a frase central e os 9 blocos principais', () => {
    const { container } = render(<AurysFindings summary={summaryMistoParcial()} fileName="extrato.xls" />);
    const t = container.textContent ?? '';
    expect(t).toContain('O Aurys leu seu extrato. Nada foi aplicado ainda — você vai revisar antes.');
    // 9 blocos
    expect(t).toContain('Saldo encontrado');
    expect(t).toContain('Rendas prováveis');
    expect(t).toContain('Contas fixas prováveis');
    expect(t).toContain('Transferências próprias');
    expect(t).toContain('Pagamentos de fatura');
    expect(t).toContain('Gastos variáveis');
    expect(t).toContain('Itens em dúvida');
    expect(t).toContain('Atípicos / one-offs');
    expect(t).toContain('Ignorados');
    // garantia de não-aplicação
    expect(t).toContain('Nada foi aplicado ainda. Você vai revisar antes.');
  });

  it('mostra o alerta de conta mista quando summary.alertaContaMista existir', () => {
    const s = summaryMistoParcial();
    expect(s.alertaContaMista).toBeTruthy(); // pré-condição
    const { container } = render(<AurysFindings summary={s} />);
    expect(container.textContent ?? '').toContain('uso misto PF/PJ');
  });

  it('mostra o aviso de período parcial quando houver meses parciais', () => {
    const s = summaryMistoParcial();
    expect(s.period.mesesParciais.length).toBeGreaterThan(0); // pré-condição
    expect(render(<AurysFindings summary={s} />).container.textContent ?? '').toContain('Período parcial');
  });

  it('NÃO mostra alerta de conta mista nem período parcial quando não houver', () => {
    const s = summaryLimpo();
    expect(s.alertaContaMista).toBeNull();
    expect(s.period.mesesParciais).toEqual([]);
    const t = render(<AurysFindings summary={s} />).container.textContent ?? '';
    expect(t).not.toContain('uso misto PF/PJ');
    expect(t).not.toContain('Período parcial');
  });

  it('mostra o saldo encontrado e a fonte quando o summary trouxer saldo', () => {
    const t = render(<AurysFindings summary={summaryMistoParcial()} />).container.textContent ?? '';
    expect(t).toContain('Saldo encontrado');
    expect(t).toMatch(/1\.234,50/); // formatação BRL do saldo
  });
});
