import { describe, it, expect } from 'vitest';
import { buildResultAlerts } from '@/domain/finance/resultAlerts';
import { SemanticResult, ExcludedItem } from '@/domain/finance/semanticResult';
import { ExclusionReason } from '@/domain/finance/resultMapping';

function fora(reason: ExclusionReason, amount: number): ExcludedItem {
  return {
    reason,
    eventId: 'e_' + Math.random().toString(36).slice(2, 7),
    date: '2026-05-10',
    label: reason,
    amount,
    semanticType: 'manual_expense',
    motivo: 'motivo',
  };
}

function makeResult(over: Partial<SemanticResult> = {}): SemanticResult {
  return {
    receitaBruta: 0,
    estornosChargebacks: 0,
    taxasDeducoesVenda: 0,
    receitaLiquida: 0,
    custosVariaveis: 0,
    margemContribuicao: 0,
    despesasOperacionais: 0,
    resultadoOperacional: 0,
    resultadoFinanceiro: 0,
    outros: 0,
    resultadoFinanceiroOutros: 0,
    resultadoPeriodo: 0,
    linhas: [],
    foraDoResultado: [],
    meta: {
      basis: 'realized',
      periodo: '2026-05',
      confidenceThreshold: 0.5,
      totalAffectsCash: 0,
      totalAffectsResult: 0,
      label: 'Resultado Gerencial Realizado',
      microcopy: '',
    },
    ...over,
  };
}

describe('buildResultAlerts', () => {
  it('nenhum alerta quando não há motivos', () => {
    expect(buildResultAlerts(makeResult())).toHaveLength(0);
  });

  it('cartão presente gera alerta amber de cartão', () => {
    const r = makeResult({ foraDoResultado: [fora('financial_movement', -300)] });
    const alerts = buildResultAlerts(r);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('card');
    expect(alerts[0].tone).toBe('amber');
    expect(alerts[0].message).toContain('cartão');
  });

  it('pendentes/sem categoria/baixa confiança geram alerta de revisão com contagem', () => {
    const r = makeResult({
      foraDoResultado: [
        fora('pending', 10),
        fora('categoria_nao_resolvida', -20),
        fora('low_confidence', 5),
      ],
    });
    const alerts = buildResultAlerts(r);
    expect(alerts[0].id).toBe('review');
    expect(alerts[0].message).toContain('3 movimentações precisam');
  });

  it('revisão no singular quando há apenas 1 item', () => {
    const r = makeResult({ foraDoResultado: [fora('unclassified', -8)] });
    const alerts = buildResultAlerts(r);
    expect(alerts[0].message).toContain('1 movimentação precisa');
  });

  it('divergência caixa × resultado relevante gera alerta informativo', () => {
    const r = makeResult({
      receitaBruta: 300,
      meta: {
        basis: 'realized', periodo: '2026-05', confidenceThreshold: 0.5,
        totalAffectsCash: 1000, totalAffectsResult: 200, label: '', microcopy: '',
      },
    });
    const alerts = buildResultAlerts(r);
    const gap = alerts.find((a) => a.id === 'cash_result_gap');
    expect(gap).toBeDefined();
    expect(gap!.tone).toBe('info');
  });

  it('divergência abaixo do limiar (<=1% da receita ou <= R$1) NÃO gera alerta', () => {
    const r = makeResult({
      receitaBruta: 100000,
      meta: {
        basis: 'realized', periodo: '2026-05', confidenceThreshold: 0.5,
        totalAffectsCash: 100, totalAffectsResult: 100.5, label: '', microcopy: '',
      },
    });
    expect(buildResultAlerts(r).some((a) => a.id === 'cash_result_gap')).toBe(false);
  });

  it('investimento fora do resultado gera alerta informativo', () => {
    const r = makeResult({ foraDoResultado: [fora('investimento', -1000)] });
    const alerts = buildResultAlerts(r);
    expect(alerts[0].id).toBe('investment');
    expect(alerts[0].message).toContain('fora do resultado operacional');
  });

  it('prioriza b > a > c > d e limita a 3 alertas', () => {
    const r = makeResult({
      receitaBruta: 300,
      foraDoResultado: [
        fora('pending', 10),             // b (review)
        fora('financial_movement', -300),// a (card)
        fora('investimento', -1000),     // d (investment)
      ],
      meta: {
        basis: 'realized', periodo: '2026-05', confidenceThreshold: 0.5,
        totalAffectsCash: 1000, totalAffectsResult: 200, label: '', microcopy: '', // c (gap)
      },
    });
    const alerts = buildResultAlerts(r);
    expect(alerts).toHaveLength(3);
    expect(alerts.map((a) => a.id)).toEqual(['review', 'card', 'cash_result_gap']);
    // investment (d) foi cortado pelo limite de 3
    expect(alerts.some((a) => a.id === 'investment')).toBe(false);
  });
});
