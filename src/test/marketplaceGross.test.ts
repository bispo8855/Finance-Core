import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { processImportFile } from '@/services/importEngine';
import { persistApprovedEvents } from '@/services/importPersister';
import { supabaseFinanceService } from '@/services/finance/supabaseFinanceService';
import { buildFinancialComposition } from '@/domain/extract';
import { calculateSemanticResult } from '@/domain/finance/semanticResult';
import { ImportEvent } from '@/types/import';

// Banco em-memória simulando o Supabase
const db: Record<string, any[]> = {
  accounts: [], categories: [], contacts: [], documents: [], titles: [], movements: [],
};

vi.mock('@/lib/supabaseClient', () => {
  const mockFrom = (table: string) => ({
    select: () => {
      const rows = db[table] || [];
      return {
        eq: (col: string, val: any) => {
          const filtered = rows.filter((r) => r[col] === val);
          return {
            single: async () => filtered.length === 0
              ? { data: null, error: { code: 'PGRST116', message: 'No rows' } }
              : { data: filtered[0], error: null },
            maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
            then: (resolve: any) => resolve({ data: filtered, error: null }),
          };
        },
        then: (resolve: any) => resolve({ data: rows, error: null }),
      };
    },
    insert: (data: any) => {
      const items = Array.isArray(data) ? data : [data];
      const inserted: any[] = [];
      for (const item of items) {
        const id = item.id || `id_${Math.random().toString(36).substring(2, 9)}`;
        const newItem = { id, ...item };
        db[table].push(newItem);
        inserted.push(newItem);
      }
      return {
        select: () => ({
          single: async () => ({ data: inserted[0], error: null }),
          then: (resolve: any) => resolve({ data: inserted, error: null }),
        }),
        then: (resolve: any) => resolve({ data: inserted, error: null }),
      };
    },
    update: (data: any) => ({
      eq: (col: string, val: any) => {
        const updated: any[] = [];
        for (const row of (db[table] || [])) {
          if (row[col] === val) { Object.assign(row, data); updated.push(row); }
        }
        return {
          select: () => ({ single: async () => ({ data: updated[0], error: null }) }),
          then: (resolve: any) => resolve({ data: updated, error: null }),
        };
      },
    }),
  });

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: async () => ({ data: { user: { id: 'mock-user-id', email: 't@a.com' } }, error: null }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  };
});

function bankFileLiberacao(desc: string, ref: string, net: string): ArrayBuffer {
  const headers = ['release_date', 'transaction_type', 'reference_id', 'transaction_net_amount', 'partial_balance'];
  const rows = [['2026-06-10', desc, ref, net, '9999,99']];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('Dupla dedução de taxa em liberações ML/MP (fix Opção A)', () => {
  beforeEach(() => {
    db.categories = [];
    db.contacts = [];
    db.documents = [];
    db.titles = [];
    db.movements = [];
    db.accounts = [{
      id: 'acc_1', user_id: 'mock-user-id', name: 'Conta MP',
      initial_balance: 1000, opening_balance: 1000, opening_balance_date: '2026-06-01', is_active: true,
    }];
    supabaseFinanceService.setUserId('mock-user-id');
  });

  it('liberação líquida de 79,17 (modo bank): sem taxa fantasma nem adjustment twin', async () => {
    // 1. Processar importação
    const batch = await processImportFile(
      bankFileLiberacao('Liberação de dinheiro', 'REF_LIB_7917', '79,17'),
      'extrato.xlsx', 'xlsx', 'Mercado Pago', 'bank'
    );
    const ev = batch.events.find((e) => e.reference === 'REF_LIB_7917')!;
    expect(ev).toBeDefined();
    // Evento: nenhuma taxa fantasma; o líquido virou bruto do evento
    expect(ev.feeAmount).toBe(0);
    expect(ev.grossAmount).toBeCloseTo(79.17, 2);

    // 2. Persistir
    ev.status = 'aprovado';
    await persistApprovedEvents([ev], 'Mercado Pago');
    const snap = await supabaseFinanceService.getSnapshot();
    const doc = snap.documents.find((d) => d.referenceId === 'REF_LIB_7917')!;
    expect(doc).toBeDefined();
    expect(doc.grossAmount).toBeCloseTo(79.17, 2);
    expect(doc.marketplaceFee).toBe(0);

    // 3. Extrato: um único sale_gross, SEM marketplace_fee e SEM adjustment twin
    const events = buildFinancialComposition(snap.movements, snap.titles, snap.documents, snap.categories, snap.contacts, 'all');
    const fe = events.find((e) => e.documentId === doc.id)!;
    const types = fe.semanticBreakdown.map((i) => i.semanticType);
    expect(types).toContain('sale_gross');
    expect(types).not.toContain('marketplace_fee');
    expect(types).not.toContain('adjustment');
    const grossItem = fe.semanticBreakdown.find((i) => i.semanticType === 'sale_gross')!;
    expect(grossItem.amount).toBeCloseTo(79.17, 2);

    // 4. Resultado: receita bruta 79,17, taxas 0, nada em revisão
    const result = calculateSemanticResult(events, snap, '2026-06');
    expect(result.receitaBruta).toBeCloseTo(79.17, 2);
    expect(result.taxasDeducoesVenda).toBe(0);
    expect(result.foraDoResultado.some((f) => f.semanticType === 'adjustment')).toBe(false);
    expect(result.foraDoResultado.some((f) => f.reason === 'low_confidence')).toBe(false);
  });

  it('venda legítima com bruto e taxa reais do relatório é preservada (não zera)', async () => {
    // Evento de venda real: bruto 100, taxa 15 (feeAmount negativo como o motor emite), líquido 85
    const ev: ImportEvent = {
      id: 'venda_real_1',
      source: 'Mercado Livre',
      mode: 'sales',
      title: 'Venda Produto X',
      date: '2026-06-12T12:00:00.000Z',
      eventDate: '2026-06-12T12:00:00.000Z',
      competenceDate: '2026-06-12T12:00:00.000Z',
      grossAmount: 100,
      feeAmount: -15,
      freightAmount: 0,
      netAmount: 85,
      confidence: 'alta',
      status: 'aprovado',
      rawLines: [],
      primaryType: 'venda',
      classificationStatus: 'classified',
      suggestedCategoryName: 'Venda de Produtos',
      historical: true,
      settlementStatus: 'settled',
      reference: 'REF_VENDA_1',
    } as ImportEvent;

    await persistApprovedEvents([ev], 'Mercado Livre');
    const snap = await supabaseFinanceService.getSnapshot();
    const doc = snap.documents.find((d) => d.referenceId === 'REF_VENDA_1')!;
    // Bruto e taxa reais preservados
    expect(doc.grossAmount).toBe(100);
    expect(doc.marketplaceFee).toBe(15);

    const events = buildFinancialComposition(snap.movements, snap.titles, snap.documents, snap.categories, snap.contacts, 'all');
    const fe = events.find((e) => e.documentId === doc.id)!;
    const types = fe.semanticBreakdown.map((i) => i.semanticType);
    expect(types).toContain('sale_gross');
    expect(types).toContain('marketplace_fee'); // taxa legítima permanece
    expect(types).not.toContain('adjustment');  // sem twin: gross - fee == líquido

    const result = calculateSemanticResult(events, snap, '2026-06');
    expect(result.receitaBruta).toBeCloseTo(100, 2);
    expect(result.taxasDeducoesVenda).toBeCloseTo(-15, 2);
  });
});
