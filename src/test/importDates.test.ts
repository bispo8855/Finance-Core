import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as XLSX from 'xlsx';
import { processImportFile } from '@/services/importEngine';
import { persistApprovedEvents } from '@/services/importPersister';
import { supabaseFinanceService } from '@/services/finance/supabaseFinanceService';
import { ImportEvent } from '@/types/import';

const db: Record<string, any[]> = {
  accounts: [],
  categories: [],
  contacts: [],
  documents: [],
  titles: [],
  movements: []
};

vi.mock('@/lib/supabaseClient', () => {
  const mockFrom = (table: string) => ({
    select: () => ({
      eq: (col: string, val: any) => {
        const filtered = (db[table] || []).filter(r => r[col] === val);
        return {
          single: async () => filtered.length
            ? { data: filtered[0], error: null }
            : { data: null, error: { message: 'No rows found' } },
          maybeSingle: async () => ({ data: filtered[0] || null, error: null }),
          then: (resolve: any) => resolve({ data: filtered, error: null })
        };
      },
      then: (resolve: any) => resolve({ data: db[table] || [], error: null })
    }),
    insert: (data: any) => {
      const items = Array.isArray(data) ? data : [data];
      const inserted = items.map(item => {
        const newItem = { id: item.id || `id_${Math.random().toString(36).slice(2)}`, ...item };
        db[table].push(newItem);
        return newItem;
      });
      return {
        select: () => ({
          single: async () => ({ data: inserted[0], error: null }),
          then: (resolve: any) => resolve({ data: inserted, error: null })
        })
      };
    },
    update: (data: any) => ({
      eq: (col: string, val: any) => {
        const updated: any[] = [];
        for (const row of db[table] || []) {
          if (row[col] === val) {
            Object.assign(row, data);
            updated.push(row);
          }
        }
        return {
          select: () => ({
            single: async () => ({ data: updated[0], error: null }),
            then: (resolve: any) => resolve({ data: updated, error: null })
          }),
          then: (resolve: any) => resolve({ data: updated, error: null })
        };
      }
    })
  });

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: async () => ({ data: { user: { id: 'mock-user-id' } }, error: null }),
        onAuthStateChange: vi.fn()
      }
    }
  };
});

function resetDb() {
  db.accounts = [{
    id: 'acc_principal',
    user_id: 'mock-user-id',
    name: 'Banco Principal',
    initial_balance: 0,
    opening_balance: 0,
    opening_balance_date: '2026-01-01',
    is_active: true
  }];
  db.categories = [{
    id: 'cat_venda',
    user_id: 'mock-user-id',
    name: 'Venda de Produtos',
    kind: 'receita',
    dre_classification: 'receita_bruta',
    is_active: true
  }];
  db.contacts = [{
    id: 'contact_ml',
    user_id: 'mock-user-id',
    name: 'Mercado Livre',
    kind: 'ambos',
    is_active: true
  }, {
    id: 'contact_mp',
    user_id: 'mock-user-id',
    name: 'Mercado Pago',
    kind: 'ambos',
    is_active: true
  }];
  db.documents = [];
  db.titles = [];
  db.movements = [];
}

function buildWorkbook(headers: string[], rows: unknown[][]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Import');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('Import date semantics', () => {
  beforeEach(resetDb);
  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves Mercado Livre sale competence date and release payment date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-20T12:00:00Z'));

    const buffer = buildWorkbook(
      ['Numero de venda', 'Data da venda', 'Produto', 'Total (BRL)', 'Status', 'Data de liberacao'],
      [['1000001', '01/06/2026', 'Produto A', '100,00', 'Liberado', '15/06/2026']]
    );

    const batch = await processImportFile(buffer, 'ml.xlsx', 'xlsx', 'Mercado Livre', 'sales');
    const event = batch.events[0];

    expect(event.competenceDate?.startsWith('2026-06-01')).toBe(true);
    expect(event.settlementDate?.startsWith('2026-06-15')).toBe(true);
    expect(event.paymentDate?.startsWith('2026-06-15')).toBe(true);

    event.status = 'aprovado';
    await persistApprovedEvents([event], 'Mercado Livre', batch.id);
    const snapshot = await supabaseFinanceService.getSnapshot();
    const doc = snapshot.documents.find(d => d.referenceId === '1000001')!;
    const title = snapshot.titles.find(t => t.documentId === doc.id)!;
    const movement = snapshot.movements.find(m => m.titleId === title.id)!;

    expect(doc.competenceDate).toBe('2026-06-01');
    expect(movement.paymentDate).toBe('2026-06-15');
    expect(title.settledAt).toBe('2026-06-15');
  });

  it('classifies a Mercado Livre predicted sale as receivable without cash movement', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));

    const buffer = buildWorkbook(
      ['Numero de venda', 'Data da venda', 'Produto', 'Total (BRL)', 'Status', 'Data de liberacao'],
      [['2000012785036885', '02/05/2026', 'Sandália Feminina', '99,32', 'Pendente', '17/05/2026']]
    );

    const batch = await processImportFile(buffer, 'ml.xlsx', 'xlsx', 'Mercado Livre', 'sales');
    const event = batch.events[0];

    expect(event.primaryType).toBe('venda');
    expect(event.suggestedCategoryName).toBe('Venda de Produtos');
    expect(event.classificationStatus).toBe('classified');
    expect(event.settlementStatus).toBe('predicted');
    expect(event.dueDate?.startsWith('2026-05-17')).toBe(true);
    expect(event.paymentDate).toBeUndefined();

    event.status = 'aprovado';
    await persistApprovedEvents([event], 'Mercado Livre', batch.id);
    const snapshot = await supabaseFinanceService.getSnapshot();
    const doc = snapshot.documents.find(d => d.referenceId === '2000012785036885')!;
    const title = snapshot.titles.find(t => t.documentId === doc.id)!;

    expect(doc.type).toBe('venda');
    expect(doc.competenceDate).toBe('2026-05-02');
    expect(title.dueDate).toBe('2026-05-17');
    expect(snapshot.movements.find(m => m.titleId === title.id)).toBeUndefined();
  });

  it('keeps predicted Mercado Livre sales unpaid and uses known release date as due date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T12:00:00Z'));

    const buffer = buildWorkbook(
      ['Numero de venda', 'Data da venda', 'Produto', 'Total (BRL)', 'Status', 'Data de liberacao'],
      [['1000002', '01/06/2026', 'Produto B', '150,00', 'Pendente', '15/06/2026']]
    );

    const batch = await processImportFile(buffer, 'ml.xlsx', 'xlsx', 'Mercado Livre', 'sales');
    const event = batch.events[0];

    expect(event.competenceDate?.startsWith('2026-06-01')).toBe(true);
    expect(event.dueDate?.startsWith('2026-06-15')).toBe(true);
    expect(event.paymentDate).toBeUndefined();

    event.status = 'aprovado';
    await persistApprovedEvents([event], 'Mercado Livre', batch.id);
    const snapshot = await supabaseFinanceService.getSnapshot();
    const doc = snapshot.documents.find(d => d.referenceId === '1000002')!;
    const title = snapshot.titles.find(t => t.documentId === doc.id)!;

    expect(doc.competenceDate).toBe('2026-06-01');
    expect(title.dueDate).toBe('2026-06-15');
    expect(snapshot.movements.find(m => m.titleId === title.id)).toBeUndefined();
  });

  it('uses Mercado Pago bank transaction date as paymentDate', async () => {
    const buffer = buildWorkbook(
      ['Data', 'Descrição', 'Valor liquido', 'ID'],
      [['15/06/2026', 'Pagamento', '80,00', 'mp-1']]
    );

    const batch = await processImportFile(buffer, 'mp.xlsx', 'xlsx', 'Mercado Pago', 'bank');
    const event = batch.events[0];

    expect(event.paymentDate?.startsWith('2026-06-15')).toBe(true);
  });

  it('settles a reconciled title with paymentDate different from competenceDate', async () => {
    db.documents.push({
      id: 'doc_previsto',
      user_id: 'mock-user-id',
      type: 'venda',
      contact_id: 'contact_ml',
      category_id: 'cat_venda',
      competence_date: '2026-06-01',
      total_amount: 100,
      description: 'Venda Mercado Livre #1000003',
      reference_id: '1000003',
      source_type: 'Mercado Livre',
      created_at: '2026-06-01'
    });
    db.titles.push({
      id: 'title_previsto',
      user_id: 'mock-user-id',
      document_id: 'doc_previsto',
      side: 'receber',
      installment_num: 1,
      installment_total: 1,
      due_date: '2026-06-15',
      amount: 100,
      status: 'previsto'
    });

    const event = {
      id: 'event-1',
      source: 'Mercado Livre',
      mode: 'sales',
      title: 'Produto C',
      date: '2026-06-01T12:00:00.000Z',
      eventDate: '2026-06-01T12:00:00.000Z',
      competenceDate: '2026-06-01T12:00:00.000Z',
      settlementDate: '2026-06-15T12:00:00.000Z',
      paymentDate: '2026-06-15T12:00:00.000Z',
      grossAmount: 100,
      feeAmount: 0,
      freightAmount: 0,
      netAmount: 100,
      confidence: 'alta',
      status: 'aprovado',
      rawLines: [],
      primaryType: 'venda',
      reference: '1000003',
      reconciliationId: 'title_previsto',
      reconciliationType: 'match',
      settlementStatus: 'settled'
    } satisfies ImportEvent;

    await persistApprovedEvents([event], 'Mercado Livre');
    const snapshot = await supabaseFinanceService.getSnapshot();
    const doc = snapshot.documents.find(d => d.id === 'doc_previsto')!;
    const title = snapshot.titles.find(t => t.id === 'title_previsto')!;
    const movement = snapshot.movements.find(m => m.titleId === title.id)!;

    expect(doc.competenceDate).toBe('2026-06-01');
    expect(title.settledAt).toBe('2026-06-15');
    expect(movement.paymentDate).toBe('2026-06-15');
  });

  it('creates a new paid document with competenceDate different from paymentDate', async () => {
    const event = {
      id: 'event-2',
      source: 'Mercado Livre',
      mode: 'sales',
      title: 'Produto D',
      date: '2026-06-01T12:00:00.000Z',
      eventDate: '2026-06-01T12:00:00.000Z',
      competenceDate: '2026-06-01T12:00:00.000Z',
      settlementDate: '2026-06-15T12:00:00.000Z',
      paymentDate: '2026-06-15T12:00:00.000Z',
      grossAmount: 120,
      feeAmount: 0,
      freightAmount: 0,
      netAmount: 120,
      confidence: 'alta',
      status: 'aprovado',
      rawLines: [],
      primaryType: 'venda',
      reference: '1000004',
      settlementStatus: 'settled'
    } satisfies ImportEvent;

    await persistApprovedEvents([event], 'Mercado Livre');
    const snapshot = await supabaseFinanceService.getSnapshot();
    const doc = snapshot.documents.find(d => d.referenceId === '1000004')!;
    const title = snapshot.titles.find(t => t.documentId === doc.id)!;
    const movement = snapshot.movements.find(m => m.titleId === title.id)!;

    expect(doc.competenceDate).toBe('2026-06-01');
    expect(movement.paymentDate).toBe('2026-06-15');
    expect(title.settledAt).toBe('2026-06-15');
  });
});
