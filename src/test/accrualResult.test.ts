import { describe, it, expect } from 'vitest';
import { buildAccrualComposition } from '@/domain/finance/accrualComposition';
import { buildFinancialComposition } from '@/domain/extract';
import { calculateSemanticResult, SemanticResult } from '@/domain/finance/semanticResult';
import { FinanceSnapshot } from '@/services/finance/financeService';
import { Category, Contact, FinancialDocument, Title, Movement } from '@/types/financial';

// ---------- fixtures ----------
function cat(id: string, type: Category['type'], dre?: Category['dreClassification']): Category {
  return { id, name: id, type, dreClassification: dre };
}
const cats: Category[] = [
  cat('cat_rec', 'receita', 'receita_bruta'),
  cat('cat_desp', 'despesa', 'despesa_fixa'),
  cat('cat_custo', 'custo', 'custo_variavel'),
  cat('cat_imp', 'despesa', 'deducao_imposto'),
  cat('cat_inv', 'investimento', 'investimento'),
];
const contacts: Contact[] = [];

function doc(over: Partial<FinancialDocument>): FinancialDocument {
  return {
    id: 'd', type: 'venda', contactId: 'c1', categoryId: 'cat_rec',
    competenceDate: '2026-07-05', totalValue: 1000, description: 'Doc',
    condition: 'avista', installments: 1, createdAt: '2026-07-05', ...over,
  };
}
function title(over: Partial<Title>): Title {
  return {
    id: 't', documentId: 'd', installment: 1, totalInstallments: 1,
    dueDate: '2026-07-10', value: 1000, status: 'recebido', side: 'receber',
    contactId: 'c1', categoryId: 'cat_rec', description: 'T', ...over,
  };
}
function mov(over: Partial<Movement>): Movement {
  return { id: 'm', titleId: 't', accountId: 'a1', paymentDate: '2026-07-10', valuePaid: 1000, type: 'entrada', ...over };
}
function snap(documents: FinancialDocument[], titles: Title[], movements: Movement[] = []): FinanceSnapshot {
  return { accounts: [], categories: cats, contacts, documents, titles, movements };
}
function lines(r: SemanticResult) {
  return {
    receitaBruta: r.receitaBruta,
    taxasDeducoesVenda: r.taxasDeducoesVenda,
    estornosChargebacks: r.estornosChargebacks,
    custosVariaveis: r.custosVariaveis,
    despesasOperacionais: r.despesasOperacionais,
    resultadoFinanceiro: r.resultadoFinanceiro,
    outros: r.outros,
    resultadoPeriodo: r.resultadoPeriodo,
  };
}

const MONTH = '2026-07';
const END = '2026-07-31';

describe('C1 — calculateSemanticResult base accrual (agregador)', () => {
  it('T-ID identidade do Realizado: sem options ≡ { basis: "realized" }', () => {
    const documents = [doc({ id: 'v', type: 'venda', totalValue: 1000 })];
    const titles = [title({ id: 'tv', documentId: 'v' })];
    const movements = [mov({ id: 'mv', titleId: 'tv' })];
    const s = snap(documents, titles, movements);
    const events = buildFinancialComposition(s.movements, s.titles, s.documents, s.categories, s.contacts, 'all');
    const a = calculateSemanticResult(events, s, MONTH);
    const b = calculateSemanticResult(events, s, MONTH, { basis: 'realized' });
    expect(a).toEqual(b);
    expect(a.meta.basis).toBe('realized');
    expect((a.meta as any).costMethod).toBeUndefined(); // realizado não ganha campos accrual
  });

  it('T-CB consistência entre bases: docs 100% liquidados no mês da competência', () => {
    const documents = [
      doc({ id: 'v', type: 'venda', categoryId: 'cat_rec', totalValue: 1000, competenceDate: '2026-07-10' }),
      doc({ id: 'e', type: 'despesa', categoryId: 'cat_desp', totalValue: 500, competenceDate: '2026-07-10' }),
    ];
    const titles = [
      title({ id: 'tv', documentId: 'v', value: 1000, status: 'recebido', side: 'receber' }),
      title({ id: 'te', documentId: 'e', value: 500, status: 'pago', side: 'pagar', categoryId: 'cat_desp' }),
    ];
    const movements = [
      mov({ id: 'mv', titleId: 'tv', valuePaid: 1000, type: 'entrada' }),
      mov({ id: 'me', titleId: 'te', valuePaid: 500, type: 'saida' }),
    ];
    const s = snap(documents, titles, movements);

    const realizedEvents = buildFinancialComposition(s.movements, s.titles, s.documents, s.categories, s.contacts, 'all');
    const realized = calculateSemanticResult(realizedEvents, s, MONTH);

    const acc = buildAccrualComposition(s.documents, s.titles, s.categories, s.contacts);
    const accrual = calculateSemanticResult(acc.events, s, MONTH, { basis: 'accrual', metaByDocumentId: acc.metaByDocumentId, asOfDate: END });

    expect(lines(accrual)).toEqual(lines(realized));
    expect(realized.receitaBruta).toBe(1000);
    expect(realized.despesasOperacionais).toBe(-500);
  });

  it('T-14 as-of: competência futura no mês corrente não é reconhecida', () => {
    const documents = [
      doc({ id: 'past', type: 'venda', totalValue: 1000, competenceDate: '2026-07-05' }),
      doc({ id: 'future', type: 'venda', totalValue: 500, competenceDate: '2026-07-25' }),
    ];
    const s = snap(documents, []);
    const acc = buildAccrualComposition(s.documents, s.titles, s.categories, s.contacts);
    const r = calculateSemanticResult(acc.events, s, MONTH, { basis: 'accrual', metaByDocumentId: acc.metaByDocumentId, asOfDate: '2026-07-18' });
    expect(r.receitaBruta).toBe(1000); // future (25) fora
  });

  it('T-15 cascata accrual fecha para negócio híbrido (venda + custo + despesa)', () => {
    const documents = [
      doc({ id: 'v', type: 'venda', totalValue: 2000, competenceDate: '2026-07-02' }),
      doc({ id: 'cmv', type: 'compra', categoryId: 'cat_custo', totalValue: 800, competenceDate: '2026-07-02' }),
      doc({ id: 'op', type: 'despesa', categoryId: 'cat_desp', totalValue: 300, competenceDate: '2026-07-02' }),
    ];
    const s = snap(documents, []);
    const acc = buildAccrualComposition(s.documents, s.titles, s.categories, s.contacts);
    const r = calculateSemanticResult(acc.events, s, MONTH, { basis: 'accrual', metaByDocumentId: acc.metaByDocumentId, asOfDate: END });
    expect(r.receitaBruta).toBe(2000);
    expect(r.custosVariaveis).toBe(-800);
    expect(r.despesasOperacionais).toBe(-300);
    expect(r.resultadoPeriodo).toBe(900);
    expect(r.meta.costMethod).toBe('purchase_date_proxy');
    expect(r.meta.marginApproximated).toBe(true);
  });

  it('T-16 tax só reduz receita com deducao_imposto', () => {
    const documents = [
      doc({ id: 'v', type: 'venda', totalValue: 1000, competenceDate: '2026-07-02' }),
      doc({ id: 'imp', type: 'despesa', categoryId: 'cat_imp', totalValue: 100, competenceDate: '2026-07-02', description: 'Imposto s/ venda' }),
    ];
    const s = snap(documents, []);
    const acc = buildAccrualComposition(s.documents, s.titles, s.categories, s.contacts);
    const r = calculateSemanticResult(acc.events, s, MONTH, { basis: 'accrual', metaByDocumentId: acc.metaByDocumentId, asOfDate: END });
    expect(r.taxasDeducoesVenda).toBe(-100);
    expect(r.receitaBruta).toBe(1000);
  });

  it('T-TR transferência positiva com descrição de transferência NÃO entra em Receita Bruta', () => {
    // Bug herdado do persister: transferência gravada como type 'venda'.
    const documents = [doc({ id: 'tr', type: 'venda', totalValue: 1000, competenceDate: '2026-07-02', description: 'Transferência recebida' })];
    const s = snap(documents, []);
    const acc = buildAccrualComposition(s.documents, s.titles, s.categories, s.contacts);
    const r = calculateSemanticResult(acc.events, s, MONTH, { basis: 'accrual', metaByDocumentId: acc.metaByDocumentId, asOfDate: END });
    expect(r.receitaBruta).toBe(0);
    expect(r.foraDoResultado.some((x) => x.semanticType === 'internal_transfer')).toBe(true);
  });

  it('T-17 investimento fica fora do resultado', () => {
    const documents = [doc({ id: 'inv', type: 'despesa', categoryId: 'cat_inv', totalValue: 5000, competenceDate: '2026-07-02', description: 'Aporte' })];
    const s = snap(documents, []);
    const acc = buildAccrualComposition(s.documents, s.titles, s.categories, s.contacts);
    const r = calculateSemanticResult(acc.events, s, MONTH, { basis: 'accrual', metaByDocumentId: acc.metaByDocumentId, asOfDate: END });
    expect(r.despesasOperacionais).toBe(0);
    expect(r.foraDoResultado.some((x) => x.reason === 'investimento')).toBe(true);
  });

  it('documento em revisão (sem competência) aparece em foraDoResultado, não some', () => {
    const documents = [doc({ id: 'rev', type: 'venda', totalValue: 700, competenceDate: '', createdAt: '2026-07-03' })];
    const s = snap(documents, []);
    const acc = buildAccrualComposition(s.documents, s.titles, s.categories, s.contacts);
    const r = calculateSemanticResult(acc.events, s, MONTH, { basis: 'accrual', metaByDocumentId: acc.metaByDocumentId, asOfDate: END });
    expect(r.receitaBruta).toBe(0);
    const ex = r.foraDoResultado.find((x) => x.documentId === 'rev');
    expect(ex).toBeDefined();
    expect(ex!.recognitionMeta?.accrualExclusionReason).toBe('unknown_review');
  });

  it('RecognitionMeta é anexado aos contribuintes na base accrual (e ausente no realizado)', () => {
    const documents = [doc({ id: 'v', type: 'venda', totalValue: 1000, competenceDate: '2026-07-02' })];
    const s = snap(documents, []);
    const acc = buildAccrualComposition(s.documents, s.titles, s.categories, s.contacts);
    const r = calculateSemanticResult(acc.events, s, MONTH, { basis: 'accrual', metaByDocumentId: acc.metaByDocumentId, asOfDate: END });
    const contrib = r.linhas.find((l) => l.key === 'receitaBruta')!.items[0];
    expect(contrib.recognitionMeta?.documentId).toBe('v');
    // realizado não anexa recognitionMeta
    const realizedEvents = buildFinancialComposition(s.movements, s.titles, s.documents, s.categories, s.contacts, 'all');
    const rr = calculateSemanticResult(realizedEvents, s, MONTH);
    const rc = rr.linhas.find((l) => l.key === 'receitaBruta')!.items[0];
    if (rc) expect(rc.recognitionMeta).toBeUndefined();
  });
});
