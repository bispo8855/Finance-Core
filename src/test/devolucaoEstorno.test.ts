import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { processImportFile } from '@/services/importEngine';
import { buildFinancialComposition } from '@/domain/extract';
import { calculateSemanticResult } from '@/domain/finance/semanticResult';
import { FinanceSnapshot } from '@/services/finance/financeService';
import { Category, FinancialDocument, Title, Movement } from '@/types/financial';

function bankFile(desc: string, ref: string, net: string): ArrayBuffer {
  const headers = ['release_date', 'transaction_type', 'reference_id', 'transaction_net_amount', 'partial_balance'];
  const ws = XLSX.utils.aoa_to_sheet([headers, ['2026-07-10', desc, ref, net, '9999,99']]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

// ---------- importEngine: sugestão na importação ----------

describe('Import: sugestão de Devolução/Estorno vs Retenção', () => {
  it('"dinheiro retido" (retenção ML) é sugerido como Devolução/Estorno por padrão, em revisão', async () => {
    const batch = await processImportFile(
      bankFile('Débito por dívida/dinheiro retido', 'REF_RET1', '-330,07'),
      'x.xlsx', 'xlsx', 'Mercado Pago', 'bank'
    );
    const ev = batch.events.find(e => e.reference === 'REF_RET1')!;
    expect(ev.suggestedCategoryName).toBe('Devoluções e Estornos');
    expect(ev.classificationStatus).toBe('pending_review');
  });

  it('reversão POSITIVA ("estorno revertido") sugere Devolução/Estorno, não venda', async () => {
    const batch = await processImportFile(
      bankFile('Estorno revertido - reclamação devolvida', 'REF_REV1', '330,07'),
      'x.xlsx', 'xlsx', 'Mercado Pago', 'bank'
    );
    const ev = batch.events.find(e => e.reference === 'REF_REV1')!;
    expect(ev.suggestedCategoryName).toBe('Devoluções e Estornos');
    expect(ev.classificationStatus).toBe('pending_review');
  });

  it('"dinheiro retido - devolução" sugere Devoluções e Estornos', async () => {
    const batch = await processImportFile(
      bankFile('Dinheiro retido - devolução', 'REF_DEV2', '-79,17'),
      'x.xlsx', 'xlsx', 'Mercado Pago', 'bank'
    );
    const ev = batch.events.find(e => e.reference === 'REF_DEV2')!;
    expect(ev.suggestedCategoryName).toBe('Devoluções e Estornos');
    expect(ev.classificationStatus).toBe('pending_review');
  });
});

// ---------- extract keyword: 'devolução' → chargeback → Estornos ----------

function cat(id: string, name: string, type: Category['type'], dre: Category['dreClassification']): Category {
  return { id, name, type, dreClassification: dre, isActive: true };
}
function docFor(id: string, over: Partial<FinancialDocument>): FinancialDocument {
  return {
    id, type: 'despesa', contactId: 'c1', categoryId: 'cat_x',
    competenceDate: '2026-07-10', totalValue: 0, description: '', condition: 'avista',
    installments: 1, createdAt: '2026-07-10T12:00:00.000Z', ...over,
  };
}
function titleFor(id: string, docId: string, over: Partial<Title>): Title {
  return {
    id, documentId: docId, installment: 1, totalInstallments: 1, dueDate: '2026-07-10',
    value: 0, status: 'pago', side: 'pagar', contactId: 'c1', categoryId: 'cat_x', description: 'x', ...over,
  };
}
function movFor(id: string, titleId: string, valuePaid: number, type: 'entrada' | 'saida'): Movement {
  return { id, titleId, accountId: 'a1', paymentDate: '2026-07-10', valuePaid, type };
}
function snap(categories: Category[], documents: FinancialDocument[], titles: Title[], movements: Movement[]): FinanceSnapshot {
  return { accounts: [], categories, contacts: [], documents, titles, movements };
}

describe('Extract: devolução/estorno na descrição vira Estornos/Chargebacks', () => {
  it('doc com "devolução"/"estorno" na descrição → chargeback → Estornos (reduz receita)', () => {
    const categories = [cat('cat_x', 'Retenção', 'financeiro', 'outro')];
    const documents = [docFor('d1', { description: 'Estorno por devolução de mercadoria', totalValue: 409.24, sourceType: 'Mercado Livre' })];
    const titles = [titleFor('t1', 'd1', { value: 409.24 })];
    const movements = [movFor('m1', 't1', 409.24, 'saida')];

    const events = buildFinancialComposition(movements, titles, documents, categories, [], 'all');
    const fe = events.find(e => e.documentId === 'd1')!;
    const types = fe.semanticBreakdown.map(i => i.semanticType);
    expect(types).toContain('chargeback');

    const r = calculateSemanticResult(events, snap(categories, documents, titles, movements), '2026-07');
    expect(r.estornosChargebacks).toBeCloseTo(-409.24, 2);
    expect(r.despesasOperacionais).toBe(0);
    expect(r.receitaBruta).toBe(0);
  });

  it('reversão POSITIVA (doc venda + categoria estorno) vai para Estornos positivo, não Receita Bruta; par com o débito zera', () => {
    const categories = [cat('cat_est', 'Devoluções e Estornos', 'despesa', 'estorno_devolucao')];
    const documents = [
      docFor('d_neg', { type: 'despesa', categoryId: 'cat_est', description: 'Estorno devolução', totalValue: 100, sourceType: 'Mercado Livre' }),
      docFor('d_pos', { type: 'venda', categoryId: 'cat_est', description: 'Reversão de estorno', totalValue: 100, grossAmount: 100, sourceType: 'Mercado Livre' }),
    ];
    const titles = [
      titleFor('t_neg', 'd_neg', { categoryId: 'cat_est', side: 'pagar', status: 'pago', value: 100 }),
      titleFor('t_pos', 'd_pos', { categoryId: 'cat_est', side: 'receber', status: 'recebido', value: 100 }),
    ];
    const movements = [
      movFor('m_neg', 't_neg', 100, 'saida'),
      movFor('m_pos', 't_pos', 100, 'entrada'),
    ];

    const events = buildFinancialComposition(movements, titles, documents, categories, [], 'all');
    const fePos = events.find(e => e.documentId === 'd_pos')!;
    const posTypes = fePos.semanticBreakdown.map(i => i.semanticType);
    expect(posTypes).toContain('chargeback');   // reversão positiva vira estorno
    expect(posTypes).not.toContain('sale_gross'); // NUNCA Receita Bruta

    const r = calculateSemanticResult(events, snap(categories, documents, titles, movements), '2026-07');
    expect(r.receitaBruta).toBe(0);
    expect(r.estornosChargebacks).toBeCloseTo(0, 2); // -100 (débito) + 100 (reversão)
  });

  it('venda legítima permanece receita (não vira estorno)', () => {
    const categories = [cat('cat_v', 'Venda de Produtos', 'receita', 'receita_bruta')];
    const documents = [docFor('d2', { type: 'venda', categoryId: 'cat_v', description: 'Venda Produto X', totalValue: 100, grossAmount: 100, marketplaceFee: 0, sourceType: 'Mercado Livre' })];
    const titles = [titleFor('t2', 'd2', { categoryId: 'cat_v', side: 'receber', status: 'recebido', value: 100 })];
    const movements = [movFor('m2', 't2', 100, 'entrada')];

    const events = buildFinancialComposition(movements, titles, documents, categories, [], 'all');
    const fe = events.find(e => e.documentId === 'd2')!;
    const types = fe.semanticBreakdown.map(i => i.semanticType);
    expect(types).toContain('sale_gross');
    expect(types).not.toContain('chargeback');

    const r = calculateSemanticResult(events, snap(categories, documents, titles, movements), '2026-07');
    expect(r.receitaBruta).toBeCloseTo(100, 2);
    expect(r.estornosChargebacks).toBe(0);
  });
});
