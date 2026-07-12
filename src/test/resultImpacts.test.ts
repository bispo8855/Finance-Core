import { describe, it, expect } from 'vitest';
import { topNegativeImpacts } from '@/domain/finance/resultImpacts';
import { SemanticResult, ResultLine } from '@/domain/finance/semanticResult';
import { ResultLineKey } from '@/domain/finance/resultMapping';

function line(key: ResultLineKey, label: string, items: { label: string; amount: number; categoryName?: string }[]): ResultLine {
  return {
    key, label,
    value: items.reduce((s, i) => s + i.amount, 0),
    items: items.map((it, i) => ({
      eventId: `e${i}`, date: '2026-07-10', label: it.label, amount: it.amount,
      categoryName: it.categoryName, semanticType: 'manual_expense', motivo: 'm',
    })),
  };
}

function makeResult(linhas: ResultLine[]): SemanticResult {
  return {
    receitaBruta: 0, estornosChargebacks: 0, taxasDeducoesVenda: 0, receitaLiquida: 0,
    custosVariaveis: 0, margemContribuicao: 0, despesasOperacionais: 0, resultadoOperacional: 0,
    resultadoFinanceiro: 0, outros: 0, resultadoFinanceiroOutros: 0, resultadoPeriodo: 0,
    linhas,
    foraDoResultado: [],
    meta: { basis: 'realized', periodo: '2026-07', confidenceThreshold: 0.5, totalAffectsCash: 0, totalAffectsResult: 0, label: '', microcopy: '' },
  };
}

describe('topNegativeImpacts', () => {
  it('junta itens negativos de todas as linhas, ordena por |valor| e corta em 5', () => {
    const r = makeResult([
      line('receitaBruta', 'Receita Bruta', [{ label: 'Venda', amount: 1000 }]), // positivo ignorado
      line('custosVariaveis', 'Custos Variáveis', [{ label: 'Mercadorias', amount: -300 }, { label: 'Frete', amount: -50 }]),
      line('despesasOperacionais', 'Despesas Operacionais', [{ label: 'Aluguel', amount: -600 }, { label: 'Internet', amount: -100 }]),
      line('estornosChargebacks', 'Estornos / Chargebacks', [{ label: 'Estorno X', amount: -409 }]),
      line('taxasDeducoesVenda', 'Taxas e Deduções de Venda', [{ label: 'Taxa ML', amount: -80 }]),
    ]);
    const top = topNegativeImpacts(r, 5);
    expect(top).toHaveLength(5);
    expect(top.map(t => t.label)).toEqual(['Aluguel', 'Estorno X', 'Mercadorias', 'Internet', 'Taxa ML']);
    expect(top.every(t => t.amount < 0)).toBe(true);
    // a linha de origem acompanha o item
    expect(top[0].lineKey).toBe('despesasOperacionais');
    expect(top[1].lineKey).toBe('estornosChargebacks');
  });

  it('menos de 5 itens negativos → retorna todos', () => {
    const r = makeResult([
      line('custosVariaveis', 'Custos Variáveis', [{ label: 'A', amount: -10 }, { label: 'B', amount: -20 }]),
    ]);
    expect(topNegativeImpacts(r, 5)).toHaveLength(2);
  });

  it('empates de |valor| mantêm ambos', () => {
    const r = makeResult([
      line('custosVariaveis', 'Custos Variáveis', [{ label: 'A', amount: -100 }, { label: 'B', amount: -100 }]),
    ]);
    const top = topNegativeImpacts(r, 5);
    expect(top).toHaveLength(2);
    expect(top.map(t => t.label).sort()).toEqual(['A', 'B']);
  });

  it('mês vazio / sem itens negativos → lista vazia', () => {
    const r = makeResult([line('receitaBruta', 'Receita Bruta', [{ label: 'Venda', amount: 500 }])]);
    expect(topNegativeImpacts(r, 5)).toEqual([]);
    expect(topNegativeImpacts(makeResult([]), 5)).toEqual([]);
  });
});
