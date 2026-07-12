import { describe, it, expect, vi, beforeEach } from 'vitest';
import { persistApprovedEvents } from '@/services/importPersister';
import { supabaseFinanceService } from '@/services/finance/supabaseFinanceService';
import { ImportEvent } from '@/types/import';

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

function ev(id: string, reference: string, categoryName: string, net: number): ImportEvent {
  return {
    id, source: 'Mercado Livre', mode: 'bank', title: `T_${id}`,
    date: '2026-07-10T12:00:00.000Z', eventDate: '2026-07-10T12:00:00.000Z', competenceDate: '2026-07-10T12:00:00.000Z',
    grossAmount: net > 0 ? net : 0, feeAmount: 0, freightAmount: 0, netAmount: net,
    confidence: 'alta', status: 'aprovado', rawLines: [],
    primaryType: 'outros', classificationStatus: 'classified',
    suggestedCategoryName: categoryName, historical: true, settlementStatus: 'settled',
    reference,
  } as ImportEvent;
}

const countDocs = async () => (await supabaseFinanceService.getSnapshot()).documents.length;

describe('Dedup de importação por reference_id + fonte + natureza', () => {
  beforeEach(() => {
    db.categories = [];
    db.contacts = [];
    db.documents = [];
    db.titles = [];
    db.movements = [];
    db.accounts = [{
      id: 'acc_1', user_id: 'mock-user-id', name: 'Conta',
      initial_balance: 1000, opening_balance: 1000, opening_balance_date: '2026-07-01', is_active: true,
    }];
    supabaseFinanceService.setUserId('mock-user-id');
  });

  it('reimport do mesmo arquivo → zero documentos novos', async () => {
    await persistApprovedEvents([ev('a', 'ORD1', 'Venda de Produtos', 100)], 'Mercado Livre');
    const before = await countDocs();
    expect(before).toBe(1);

    // Segundo import (mesmo pedido, mesma natureza) → deduplicado
    await persistApprovedEvents([ev('a2', 'ORD1', 'Venda de Produtos', 100)], 'Mercado Livre');
    expect(await countDocs()).toBe(before); // nenhum documento novo
  });

  it('estorno com o reference_id da venda NÃO é bloqueado (natureza diferente)', async () => {
    await persistApprovedEvents([ev('v', 'ORD9', 'Venda de Produtos', 100)], 'Mercado Livre');
    const afterSale = await countDocs();
    expect(afterSale).toBe(1);

    await persistApprovedEvents([ev('e', 'ORD9', 'Devoluções e Estornos', -30)], 'Mercado Livre');
    expect(await countDocs()).toBe(afterSale + 1); // estorno criado (natureza distinta)
  });

  it('reference_ids distintos seguem criando documentos', async () => {
    await persistApprovedEvents(
      [ev('a', 'ORD_A', 'Venda de Produtos', 100), ev('b', 'ORD_B', 'Venda de Produtos', 50)],
      'Mercado Livre'
    );
    expect(await countDocs()).toBe(2);
  });

  it('duplicata dentro do MESMO lote também é bloqueada', async () => {
    await persistApprovedEvents(
      [ev('a', 'ORD_X', 'Venda de Produtos', 100), ev('a_dup', 'ORD_X', 'Venda de Produtos', 100)],
      'Mercado Livre'
    );
    expect(await countDocs()).toBe(1);
  });
});
