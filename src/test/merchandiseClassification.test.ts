import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { processImportFile } from '@/services/importEngine';
import { persistApprovedEvents } from '@/services/importPersister';
import { supabaseFinanceService } from '@/services/finance/supabaseFinanceService';
import { ImportEvent } from '@/types/import';

// Banco em-memória para simular o Supabase
const db: Record<string, any[]> = {
  accounts: [], categories: [], contacts: [], documents: [], titles: [], movements: []
};

vi.mock('@/lib/supabaseClient', () => {
  const mockFrom = (table: string) => ({
    select: () => {
      const rows = db[table] || [];
      return {
        eq: (col: string, val: any) => {
          const filtered = rows.filter(r => r[col] === val);
          return {
            single: async () => filtered.length === 0
              ? { data: null, error: { code: 'PGRST116', message: 'No rows found' } }
              : { data: filtered[0], error: null },
            maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
            then: (resolve: any) => resolve({ data: filtered, error: null })
          };
        },
        then: (resolve: any) => resolve({ data: rows, error: null })
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
          then: (resolve: any) => resolve({ data: inserted, error: null })
        }),
        then: (resolve: any) => resolve({ data: inserted, error: null })
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
          then: (resolve: any) => resolve({ data: updated, error: null })
        };
      }
    })
  });

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: async () => ({ data: { user: { id: 'mock-user-id', email: 'teste@aurys.com' } }, error: null }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
      }
    }
  };
});

// Cria um extrato bancário de uma única linha para testar a sugestão do motor
function buildBankFile(description: string, amount: string): ArrayBuffer {
  const headers = ['release_date', 'transaction_type', 'reference_id', 'transaction_net_amount', 'partial_balance'];
  const rows = [['2026-05-15', description, 'REF1', amount, '1000']];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

async function suggestFor(description: string, amount: string): Promise<ImportEvent> {
  const batch = await processImportFile(buildBankFile(description, amount), 'x.xlsx', 'xlsx', 'Mercado Pago', 'bank');
  return batch.events[0];
}

function makeApprovedEvent(over: Partial<ImportEvent> = {}): ImportEvent {
  return {
    id: 'ev_' + Math.random().toString(36).slice(2, 8),
    source: 'Mercado Pago',
    mode: 'bank',
    title: 'Compra de mercadorias para revenda',
    date: '2026-05-15T12:00:00.000Z',
    eventDate: '2026-05-15T12:00:00.000Z',
    competenceDate: '2026-05-15T12:00:00.000Z',
    grossAmount: 0,
    feeAmount: -140,
    freightAmount: 0,
    netAmount: -140,
    confidence: 'alta',
    status: 'aprovado',
    rawLines: [],
    primaryType: 'outros',
    classificationStatus: 'classified',
    suggestedCategoryName: 'Compra de Mercadorias',
    ...over
  };
}

describe('Classificação: Compra de Mercadorias vs Despesa Operacional', () => {
  beforeEach(() => {
    db.categories = [];
    db.contacts = [];
    db.documents = [];
    db.titles = [];
    db.movements = [];
    db.accounts = [{
      id: 'acc_1', user_id: 'mock-user-id', name: 'Conta Principal',
      initial_balance: 1000, opening_balance: 1000, opening_balance_date: '2026-05-01',
      is_active: true
    }];
    supabaseFinanceService.setUserId('mock-user-id');
  });

  // 1
  it('sugere Compra de Mercadorias para "Compra de mercadorias para revenda"', async () => {
    const ev = await suggestFor('Compra de mercadorias para revenda', '-140,00');
    expect(ev.suggestedCategoryName).toBe('Compra de Mercadorias');
  });

  // 2
  it('sugere Compra de Mercadorias para "Compra de estoque"', async () => {
    const ev = await suggestFor('Compra de estoque', '-250,00');
    expect(ev.suggestedCategoryName).toBe('Compra de Mercadorias');
  });

  // 3
  it('classifica "Pagamento internet empresa" como Despesa Operacional, não Compra de Mercadorias', async () => {
    const ev = await suggestFor('Pagamento internet empresa', '-99,90');
    expect(ev.suggestedCategoryName).toBe('Despesa Operacional');
    expect(ev.suggestedCategoryName).not.toBe('Compra de Mercadorias');
  });

  // 4
  it('NÃO classifica "Compra notebook escritório" como Compra de Mercadorias', async () => {
    const ev = await suggestFor('Compra notebook escritório', '-3500,00');
    expect(ev.suggestedCategoryName).not.toBe('Compra de Mercadorias');
  });

  // 5
  it('Pix para PJ sem evidência de mercadoria fica em revisão, não vira Compra de Mercadorias', async () => {
    const ev = await suggestFor('Pix enviado Outra Empresa Ltda', '-300,00');
    expect(ev.suggestedCategoryName).not.toBe('Compra de Mercadorias');
    expect(ev.suggestedCategoryName).toBe('Pagamento de Fornecedor');
    expect(ev.classificationStatus).toBe('pending_review');
  });

  // 6
  it('seleção manual "Compra de Mercadorias" persiste categoria custo / custo_variavel', async () => {
    const count = await persistApprovedEvents([makeApprovedEvent()], 'Mercado Pago');
    expect(count).toBe(1);

    const snapshot = await supabaseFinanceService.getSnapshot();
    const cat = snapshot.categories.find(c => c.name === 'Compra de Mercadorias')!;
    expect(cat).toBeDefined();
    expect(cat.type).toBe('custo');
    expect(cat.dreClassification).toBe('custo_variavel');

    // O documento criado deve apontar para essa categoria
    const doc = snapshot.documents.find(d => d.categoryId === cat.id);
    expect(doc).toBeDefined();
  });

  // 7
  it('não cria categorias "Compra de Mercadorias" duplicadas', async () => {
    await persistApprovedEvents(
      [makeApprovedEvent({ id: 'a', reference: 'A' }), makeApprovedEvent({ id: 'b', reference: 'B' })],
      'Mercado Pago'
    );
    const snapshot = await supabaseFinanceService.getSnapshot();
    const matches = snapshot.categories.filter(c => c.name.toLowerCase() === 'compra de mercadorias');
    expect(matches).toHaveLength(1);
  });
});
