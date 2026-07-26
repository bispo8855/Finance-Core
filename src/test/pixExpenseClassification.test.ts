import { describe, it, expect } from 'vitest';
import { buildFinancialComposition } from '@/domain/extract';
import { buildAccrualComposition } from '@/domain/finance/accrualComposition';
import { calculateSemanticResult } from '@/domain/finance/semanticResult';
import { FinanceSnapshot } from '@/services/finance/financeService';
import {
  Category, Contact, FinancialDocument, Title, Movement,
} from '@/types/financial';

// ============================================================================
// Bug Pix/TED-como-transferência.
// classifyEventType punha o trilho de pagamento (pix/ted/depósito) ACIMA da
// categoria: "Pix enviado Fornecedor" classificado como Compra de Mercadorias
// virava 'transfer' → internal_transfer → excluído da DRE. A correção torna o
// trilho NEUTRO quando há categoria operacional (custo/despesa/receita).
// Prova nas DUAS bases: realizado (extract.ts) e accrual (accrualComposition.ts).
// ============================================================================

const MONTH = '2026-07';
const ASOF = '2026-07-31';
const DATE = '2026-07-05';

const cat = (id: string, type: Category['type'], dre?: Category['dreClassification']): Category =>
  ({ id, name: id, type, dreClassification: dre, isActive: true });

const CATS: Category[] = [
  cat('cat_merc', 'custo', 'custo_variavel'),      // Compra de Mercadorias
  cat('cat_rec', 'receita', 'receita_bruta'),      // Receita operacional
  cat('cat_fin', 'financeiro', 'financeiro'),      // Transferência / Retirada
];
const CONTACTS: Contact[] = [];

const doc = (over: Partial<FinancialDocument>): FinancialDocument => ({
  id: 'd1', type: 'compra', contactId: 'c1', categoryId: 'cat_merc',
  competenceDate: DATE, totalValue: 500, description: 'Doc',
  condition: 'avista', installments: 1, createdAt: DATE,
  ...over,
});
const title = (over: Partial<Title>): Title => ({
  id: 't1', documentId: 'd1', installment: 1, totalInstallments: 1,
  dueDate: DATE, value: 500, status: 'pago', side: 'pagar',
  contactId: 'c1', categoryId: 'cat_merc', description: 'T',
  ...over,
});
const mov = (over: Partial<Movement>): Movement => ({
  id: 'm1', titleId: 't1', accountId: 'acc1', paymentDate: DATE,
  valuePaid: 500, type: 'saida',
  ...over,
});

const snap = (documents: FinancialDocument[]): FinanceSnapshot =>
  ({ accounts: [], categories: CATS, contacts: [], documents, titles: [], movements: [] });

// Base REALIZADO: documento + título + movimento → composição → resultado.
function realized(d: FinancialDocument, t: Title, m: Movement) {
  const events = buildFinancialComposition([m], [t], [d], CATS, CONTACTS);
  const result = calculateSemanticResult(events, snap([d]), MONTH);
  return { events, result };
}

// Base ACCRUAL: documento + título → composição por competência → resultado.
function accrual(d: FinancialDocument, t: Title) {
  const { events, metaByDocumentId } = buildAccrualComposition([d], [t], CATS, CONTACTS);
  const result = calculateSemanticResult(events, snap([d]), MONTH, {
    basis: 'accrual', metaByDocumentId, asOfDate: ASOF,
  });
  return { events, result };
}

const semanticTypes = (events: { semanticBreakdown: { semanticType: string }[] }[]) =>
  events.flatMap((e) => e.semanticBreakdown.map((i) => i.semanticType));

const hasInternalTransfer = (r: ReturnType<typeof realized>['result']) =>
  r.foraDoResultado.some((x) => x.semanticType === 'internal_transfer') ||
  r.linhas.some((l) => l.items.some((i) => i.semanticType === 'internal_transfer'));

describe('Pix como DESPESA quando há categoria operacional', () => {
  const d = doc({ description: 'Pix enviado Fornecedor Ltda' });
  const t = title({});
  const m = mov({});

  it('REALIZADO: entra em CUSTOS VARIÁVEIS, sem internal_transfer', () => {
    const { events, result } = realized(d, t, m);
    expect(semanticTypes(events)).not.toContain('internal_transfer');
    expect(semanticTypes(events)).toContain('manual_expense');
    expect(result.custosVariaveis).toBeLessThan(0);          // despesa assinada negativa
    expect(result.custosVariaveis).toBeCloseTo(-500, 2);
    expect(hasInternalTransfer(result)).toBe(false);
  });

  it('ACCRUAL: entra em CUSTOS VARIÁVEIS, sem internal_transfer', () => {
    const { events, result } = accrual(d, t);
    expect(semanticTypes(events)).not.toContain('internal_transfer');
    expect(semanticTypes(events)).toContain('manual_expense');
    expect(result.custosVariaveis).toBeCloseTo(-500, 2);
    expect(hasInternalTransfer(result)).toBe(false);
  });
});

describe('REGRESSÃO — palavra "transferência" continua sendo transferência', () => {
  // A palavra semântica tem precedência mantida, independente da categoria (T-TR).
  const d = doc({ description: 'Transferência recebida', type: 'receita', categoryId: 'cat_fin' });
  const t = title({ side: 'receber', status: 'recebido', categoryId: 'cat_fin' });
  const m = mov({ type: 'entrada' });

  it('REALIZADO: segue internal_transfer / fora do resultado', () => {
    const { events, result } = realized(d, t, m);
    expect(semanticTypes(events)).toContain('internal_transfer');
    expect(result.receitaBruta).toBe(0);
    expect(hasInternalTransfer(result)).toBe(true);
  });

  it('ACCRUAL: segue internal_transfer / fora do resultado', () => {
    const { events, result } = accrual(d, t);
    expect(semanticTypes(events)).toContain('internal_transfer');
    expect(result.receitaBruta).toBe(0);
    expect(hasInternalTransfer(result)).toBe(true);
  });
});

describe('REGRESSÃO — Pix + categoria FINANCEIRA continua transferência', () => {
  // Sem categoria operacional, o trilho de pagamento volta a indicar transferência.
  const d = doc({ description: 'Pix enviado', type: 'despesa', categoryId: 'cat_fin' });
  const t = title({ categoryId: 'cat_fin' });
  const m = mov({});

  it('REALIZADO: segue internal_transfer', () => {
    const { events, result } = realized(d, t, m);
    expect(semanticTypes(events)).toContain('internal_transfer');
    expect(semanticTypes(events)).not.toContain('manual_expense');
    expect(hasInternalTransfer(result)).toBe(true);
  });

  it('ACCRUAL: segue internal_transfer', () => {
    const { events } = accrual(d, t);
    expect(semanticTypes(events)).toContain('internal_transfer');
    expect(semanticTypes(events)).not.toContain('manual_expense');
  });
});

describe('Recebimento Pix + categoria RECEITA entra em Receita Bruta', () => {
  const d = doc({ description: 'Recebimento Pix', type: 'receita', categoryId: 'cat_rec' });
  const t = title({ side: 'receber', status: 'recebido', categoryId: 'cat_rec' });
  const m = mov({ type: 'entrada' });

  it('REALIZADO: Receita Bruta, sem internal_transfer', () => {
    const { events, result } = realized(d, t, m);
    expect(semanticTypes(events)).not.toContain('internal_transfer');
    expect(semanticTypes(events)).toContain('manual_income');
    expect(result.receitaBruta).toBeCloseTo(500, 2);
  });

  it('ACCRUAL: Receita Bruta, sem internal_transfer', () => {
    const { events, result } = accrual(d, t);
    expect(semanticTypes(events)).not.toContain('internal_transfer');
    expect(semanticTypes(events)).toContain('manual_income');
    expect(result.receitaBruta).toBeCloseTo(500, 2);
  });
});
