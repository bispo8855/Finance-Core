import { describe, it, expect } from 'vitest';
import { buildResultSeries, buildResultTrendInsight } from '@/domain/finance/resultSeries';
import { calculateSemanticResult } from '@/domain/finance/semanticResult';
import { FinancialEvent, FinancialCompositionItem, MovementSemanticType } from '@/domain/extract';
import { FinanceSnapshot } from '@/services/finance/financeService';
import { Category, FinancialDocument, CategoryType, DREClassification } from '@/types/financial';

function makeItem(semanticType: MovementSemanticType, amount: number, over: Partial<FinancialCompositionItem> = {}): FinancialCompositionItem {
  return {
    id: 'it_' + Math.random().toString(36).slice(2, 8),
    semanticType, label: semanticType, amount,
    direction: amount >= 0 ? 'inflow' : 'outflow',
    affectsCash: true, affectsResult: true, isTemporary: false, confidence: 1, ...over,
  };
}
function makeEvent(id: string, documentId: string, date: string, items: FinancialCompositionItem[], over: Partial<FinancialEvent> = {}): FinancialEvent {
  const net = items.reduce((s, i) => s + i.amount, 0);
  return {
    id, date, title: id, origin: 'ecommerce', type: net >= 0 ? 'entrada' : 'saida',
    totalAmount: Math.abs(net), netAmount: net, affectsResult: true, affectsCash: true,
    status: 'ok', items: [], documentId, eventType: 'sale', groupKey: `doc:${documentId}`,
    grossAmount: 0, feesAmount: 0, freightAmount: 0, reserveAmount: 0,
    eventKind: 'sale_settlement', resultImpactAmount: net, semanticBreakdown: items, ...over,
  };
}
function cat(id: string, name: string, type: CategoryType, dre?: DREClassification): Category {
  return { id, name, type, dreClassification: dre, isActive: true };
}
function doc(id: string, categoryId: string): FinancialDocument {
  return { id, type: 'venda', contactId: 'c1', categoryId, competenceDate: '2026-01-01', totalValue: 0, description: id, condition: 'avista', installments: 1, createdAt: '2026-01-01T12:00:00Z' };
}
function snapshot(categories: Category[], documents: FinancialDocument[]): FinanceSnapshot {
  return { accounts: [], categories, contacts: [], documents, titles: [], movements: [] };
}

const categories = [cat('cv', 'Venda', 'receita', 'receita_bruta'), cat('cd', 'Despesa', 'despesa', 'outro')];
const documents = [doc('d1', 'cv'), doc('d2', 'cv'), doc('d3', 'cd'), doc('d4', 'cv')];
const events: FinancialEvent[] = [
  makeEvent('e1', 'd1', '2026-05-15T12:00:00.000Z', [makeItem('sale_gross', 100)]),
  makeEvent('e2', 'd2', '2026-06-15T12:00:00.000Z', [makeItem('sale_gross', 200)]),
  makeEvent('e3', 'd3', '2026-06-20T12:00:00.000Z', [makeItem('manual_expense', -50, { confidence: 0.8 })], { eventType: 'expense' }),
  makeEvent('e4', 'd4', '2026-07-15T12:00:00.000Z', [makeItem('sale_gross', 300)]),
];
const snap = snapshot(categories, documents);
const months = ['2026-05', '2026-06', '2026-07'];

describe('buildResultSeries', () => {
  it('retorna os meses na ordem e com valores que batem com calculateSemanticResult', () => {
    const series = buildResultSeries(events, snap, months);
    expect(series.map(p => p.mes)).toEqual(months);
    for (let i = 0; i < months.length; i++) {
      const r = calculateSemanticResult(events, snap, months[i]);
      expect(series[i].receitaLiquida).toBe(r.receitaLiquida);
      expect(series[i].resultadoPeriodo).toBe(r.resultadoPeriodo);
    }
    // Sanidade dos números
    expect(series[0].resultadoPeriodo).toBe(100); // mai
    expect(series[1].resultadoPeriodo).toBe(150); // jun (200 - 50)
    expect(series[2].resultadoPeriodo).toBe(300); // jul (corrente)
  });

  it('mês corrente entra na série mas fica FORA do cálculo de tendência', () => {
    const series = buildResultSeries(events, snap, months);
    // Tendência sobre fechados: 100 → 150 = subindo
    expect(buildResultTrendInsight(series, '2026-07')).toContain('subindo');

    // Alterar o mês corrente (jul) para negativo NÃO muda a tendência (ele é excluído)
    const seriesCurrentNeg = series.map(p => p.mes === '2026-07' ? { ...p, resultadoPeriodo: -9999 } : p);
    expect(buildResultTrendInsight(seriesCurrentNeg, '2026-07')).toContain('subindo');
  });
});

describe('buildResultTrendInsight', () => {
  const mk = (vals: number[]) => vals.map((v, i) => ({ mes: `2026-0${i + 1}`, receitaLiquida: 0, resultadoPeriodo: v }));

  it('subindo, recuando e estável conforme limiar de 10%', () => {
    expect(buildResultTrendInsight([...mk([100, 150]), { mes: '2026-07', receitaLiquida: 0, resultadoPeriodo: 0 }], '2026-07')).toContain('subindo');
    expect(buildResultTrendInsight([...mk([100, 80]), { mes: '2026-07', receitaLiquida: 0, resultadoPeriodo: 0 }], '2026-07')).toContain('recuando');
    expect(buildResultTrendInsight([...mk([100, 105]), { mes: '2026-07', receitaLiquida: 0, resultadoPeriodo: 0 }], '2026-07')).toContain('estável');
  });

  it('sem meses fechados suficientes → mensagem neutra', () => {
    const series = [{ mes: '2026-07', receitaLiquida: 0, resultadoPeriodo: 100 }];
    expect(buildResultTrendInsight(series, '2026-07')).toContain('não há meses fechados suficientes');
  });
});
