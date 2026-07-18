import { describe, it, expect } from 'vitest';
import { buildAccrualComposition } from '@/domain/finance/accrualComposition';
import { Category, Contact, FinancialDocument, Title } from '@/types/financial';

// ---------- fixtures ----------
function cat(id: string, type: Category['type'], dre?: Category['dreClassification']): Category {
  return { id, name: id, type, dreClassification: dre };
}
function doc(over: Partial<FinancialDocument>): FinancialDocument {
  return {
    id: 'd1', type: 'venda', contactId: 'c1', categoryId: 'cat_rec',
    competenceDate: '2026-07-05', totalValue: 1000, description: 'Doc',
    condition: 'avista', installments: 1, createdAt: '2026-07-05',
    ...over,
  };
}
function title(over: Partial<Title>): Title {
  return {
    id: 't1', documentId: 'd1', installment: 1, totalInstallments: 1,
    dueDate: '2026-07-10', value: 1000, status: 'recebido', side: 'receber',
    contactId: 'c1', categoryId: 'cat_rec', description: 'T',
    ...over,
  };
}
const cats: Category[] = [
  cat('cat_rec', 'receita', 'receita_bruta'),
  cat('cat_desp', 'despesa', 'despesa_fixa'),
  cat('cat_custo', 'custo', 'custo_variavel'),
  cat('cat_est', 'despesa', 'estorno_devolucao'),
];
const contacts: Contact[] = [];

describe('C1 — buildAccrualComposition (construtor)', () => {
  it('T-01 venda de serviço reconhece sale_gross na competência, affectsCash=false', () => {
    const d = doc({ id: 'd1', type: 'venda', totalValue: 3000, competenceDate: '2026-07-05' });
    const { events, metaByDocumentId } = buildAccrualComposition([d], [], cats, contacts);
    const ev = events[0];
    expect(ev.date).toBe('2026-07-05');
    expect(ev.semanticBreakdown).toHaveLength(1);
    expect(ev.semanticBreakdown[0].semanticType).toBe('sale_gross');
    expect(ev.semanticBreakdown[0].amount).toBe(3000);
    expect(ev.semanticBreakdown.every((i) => i.affectsCash === false)).toBe(true);
    expect(metaByDocumentId['d1'].documentRecognizedAmount).toBe(3000);
    expect(metaByDocumentId['d1'].resultImpactAmount).toBe(3000);
  });

  it('T-02 venda ecom decompõe gross/fee dos valores do documento', () => {
    const d = doc({ id: 'ml1', type: 'venda', sourceType: 'Mercado Livre', grossAmount: 3000, marketplaceFee: 450, totalValue: 2550 });
    const { events, metaByDocumentId } = buildAccrualComposition([d], [], cats, contacts);
    const sb = events[0].semanticBreakdown;
    expect(sb.find((i) => i.semanticType === 'sale_gross')!.amount).toBe(3000);
    expect(sb.find((i) => i.semanticType === 'marketplace_fee')!.amount).toBe(-450);
    const m = metaByDocumentId['ml1'];
    expect(m.documentRecognizedAmount).toBe(3000);   // âncora = bruto
    expect(m.resultImpactAmount).toBe(2550);         // soma assinada affectsResult
    expect(m.expectedSettlementAmount).toBe(2550);   // líquido esperado
  });

  it('T-10 três valores são distintos numa venda ML', () => {
    const d = doc({ id: 'ml2', type: 'venda', sourceType: 'ML', grossAmount: 3000, marketplaceFee: 450, totalValue: 2550 });
    const m = buildAccrualComposition([d], [], cats, contacts).metaByDocumentId['ml2'];
    expect(m.documentRecognizedAmount).not.toBe(m.resultImpactAmount); // 3000 ≠ 2550
    expect([m.documentRecognizedAmount, m.resultImpactAmount, m.expectedSettlementAmount]).toEqual([3000, 2550, 2550]);
  });

  it('T-03 despesa fixa é reconhecida na competência (aluguel jul pago ago)', () => {
    const d = doc({ id: 'alg', type: 'despesa', categoryId: 'cat_desp', totalValue: 2000, competenceDate: '2026-07-01', description: 'Aluguel' });
    const { events, metaByDocumentId } = buildAccrualComposition([d], [], cats, contacts);
    expect(events[0].date).toBe('2026-07-01');
    expect(events[0].semanticBreakdown[0].semanticType).toBe('manual_expense');
    expect(metaByDocumentId['alg'].documentRecognizedAmount).toBe(-2000); // sinal negativo (§3.4)
  });

  it('T-09 sinais: venda tudo positivo, despesa tudo negativo', () => {
    const venda = doc({ id: 'v', type: 'venda', totalValue: 1000, competenceDate: '2026-07-02' });
    const desp = doc({ id: 'e', type: 'despesa', categoryId: 'cat_desp', totalValue: 800, competenceDate: '2026-07-02' });
    const tVenda = title({ id: 'tv', documentId: 'v', value: 1000, status: 'recebido', side: 'receber' });
    const tDesp = title({ id: 'te', documentId: 'e', value: 800, status: 'pago', side: 'pagar' });
    const m = buildAccrualComposition([venda, desp], [tVenda, tDesp], cats, contacts).metaByDocumentId;
    expect(m['v'].documentRecognizedAmount).toBeGreaterThan(0);
    expect(m['v'].documentSettledAmount).toBe(1000);
    expect(m['e'].documentRecognizedAmount).toBeLessThan(0);
    expect(m['e'].documentSettledAmount).toBe(-800); // pagar → negativo
  });

  it('T-11 settlement: settled / partial / open / untracked', () => {
    const base = (id: string) => doc({ id, type: 'venda', totalValue: 1000, competenceDate: '2026-07-01' });
    const settled = base('s'); const partial = base('p'); const open = base('o'); const untracked = base('u');
    const titles: Title[] = [
      title({ id: 's1', documentId: 's', value: 1000, status: 'recebido' }),
      title({ id: 'p1', documentId: 'p', value: 600, status: 'recebido' }),
      title({ id: 'p2', documentId: 'p', value: 400, status: 'previsto' }),
      title({ id: 'o1', documentId: 'o', value: 1000, status: 'previsto' }),
      // 'u' sem título
    ];
    const m = buildAccrualComposition([settled, partial, open, untracked], titles, cats, contacts).metaByDocumentId;
    expect(m['s'].settlementStatus).toBe('settled');
    expect(m['p'].settlementStatus).toBe('partial');
    expect(m['o'].settlementStatus).toBe('open');
    expect(m['u'].settlementStatus).toBe('untracked');
  });

  it('T-08b documento sem título fica untracked mas continua com valor econômico reconhecido', () => {
    const d = doc({ id: 'nt', type: 'venda', totalValue: 1500, competenceDate: '2026-07-01' });
    const m = buildAccrualComposition([d], [], cats, contacts).metaByDocumentId['nt'];
    expect(m.settlementStatus).toBe('untracked');
    expect(m.unexplainedDiff).toBeUndefined();
    expect(m.documentRecognizedAmount).toBe(1500); // reconhecido, não sumiu
    expect(m.accrualExclusionReason).toBeUndefined();
  });

  it('T-12 unexplainedDiff quando títulos divergem do documento', () => {
    const d = doc({ id: 'dv', type: 'venda', totalValue: 3000, competenceDate: '2026-07-01' });
    const t = title({ id: 'dv1', documentId: 'dv', value: 2850, status: 'recebido', side: 'receber' });
    const m = buildAccrualComposition([d], [t], cats, contacts).metaByDocumentId['dv'];
    expect(m.expectedSettlementAmount).toBe(3000);
    expect(m.documentSettledAmount).toBe(2850);
    expect(m.unexplainedDiff).toBeCloseTo(150, 5);
  });

  it('T-13 netOnly: ecom sem bruto explícito não inventa bruto/taxa', () => {
    const d = doc({ id: 'no', type: 'venda', sourceType: 'ML', totalValue: 2550 }); // sem grossAmount/fee
    const m = buildAccrualComposition([d], [], cats, contacts).metaByDocumentId['no'];
    expect(m.dataQuality.netOnly).toBe(true);
    expect(m.expectedSettlementAmount).toBeUndefined();
  });

  it('T-05 estorno em mês diferente da venda não retroage', () => {
    const est = doc({ id: 'est', type: 'venda', categoryId: 'cat_est', totalValue: 200, competenceDate: '2026-08-03', description: 'Devolução cliente' });
    const { events, metaByDocumentId } = buildAccrualComposition([est], [], cats, contacts);
    expect(events[0].date).toBe('2026-08-03');
    expect(events[0].semanticBreakdown[0].semanticType).toBe('chargeback');
    expect(metaByDocumentId['est'].documentRecognizedAmount).toBe(-200);
  });

  it('T-07 documento sem competenceDate → unknown_review (não some)', () => {
    const d = doc({ id: 'sc', type: 'venda', totalValue: 500, competenceDate: '' });
    const m = buildAccrualComposition([d], [], cats, contacts).metaByDocumentId['sc'];
    expect(m.accrualExclusionReason).toBe('unknown_review');
    expect(m.dataQuality.competenceDateSource).toBe('unknown_review');
  });

  it('T-08 todos os títulos cancelados → revisão (unknown_review), NÃO cancelado', () => {
    const d = doc({ id: 'cc', type: 'venda', totalValue: 500, competenceDate: '2026-07-01' });
    const t1 = title({ id: 'cc1', documentId: 'cc', value: 500, status: 'cancelado' });
    const m = buildAccrualComposition([d], [t1], cats, contacts).metaByDocumentId['cc'];
    expect(m.accrualExclusionReason).toBe('unknown_review');
    expect(m.settlementStatus).toBe('untracked'); // cancelado não é rastreável
  });

  it('T-06 título renegociado fica fora de settled e open', () => {
    const d = doc({ id: 'rg', type: 'venda', totalValue: 1000, competenceDate: '2026-07-01' });
    const t = title({ id: 'rg1', documentId: 'rg', value: 1000, status: 'renegociado' });
    const m = buildAccrualComposition([d], [t], cats, contacts).metaByDocumentId['rg'];
    expect(m.documentSettledAmount).toBe(0);
    expect(m.documentOpenAmount).toBe(0);
    expect(m.settlementStatus).toBe('untracked');
  });
});
