import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));
import { supabase } from '@/lib/supabaseClient';
import {
  createImportBatch, insertImportItems, updateImportItemDecision,
  markImportBatchApplied, discardImportBatch, upsertCategoryRule,
} from '@/services/personal/personalImportService';
import { inferFromLines } from '@/domain/personal/import/personalImportInference';
import { NormalizedLine } from '@/domain/personal/import/personalStatementParser';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Call = { table: string; op: string; row?: any; opts?: any; eqCol?: string; eqVal?: any };
let calls: Call[];
let selectResult: unknown; // resultado do .single()/.maybeSingle()

function chainFor(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    insert(row: any) { calls.push({ table, op: 'insert', row }); return chain; },
    update(row: any) { calls.push({ table, op: 'update', row }); return chain; },
    upsert(row: any, opts: any) { calls.push({ table, op: 'upsert', row, opts }); return Promise.resolve({ error: null }); },
    select() { return chain; },
    eq(col: string, val: any) { const last = calls[calls.length - 1]; if (last) { last.eqCol = col; last.eqVal = val; } return chain; },
    single() { return Promise.resolve({ data: selectResult ?? { id: 'new-id' }, error: null }); },
    maybeSingle() { return Promise.resolve({ data: selectResult ?? null, error: null }); },
    then(res: any, rej: any) { return Promise.resolve({ data: selectResult ?? [], error: null }).then(res, rej); },
  };
  return chain;
}

beforeEach(() => {
  calls = [];
  selectResult = undefined;
  vi.mocked(supabase.from).mockImplementation((t: string) => chainFor(t));
});
const last = () => calls[calls.length - 1];

let seq = 0;
const line = (date: string, description: string, amount: number, direction: 'entrada' | 'saida'): NormalizedLine =>
  ({ date, description, amount, direction, sourceRow: seq++, confidence: 'alta', issues: [] });
const summary = () => inferFromLines([
  line('2026-06-05', 'Salário ACME', 9000, 'entrada'),
  line('2026-07-05', 'Salário ACME', 9000, 'entrada'),
  line('2026-07-09', 'IFOOD', 45, 'saida'),
], { titular: 'joao teste', accountBalance: 100 });

describe('createImportBatch', () => {
  it('grava source_kind=extrato, file_hash e summary_json', async () => {
    selectResult = { id: 'batch-1' };
    const res = await createImportBatch('ws1', { fileName: 'extrato.xls', fileHash: 'abc123', titularRaw: 'Joao Teste', summary: summary() });
    expect(res.id).toBe('batch-1');
    const c = calls.find((x) => x.op === 'insert' && x.table === 'personal_import_batches')!;
    expect(c.row).toMatchObject({ workspace_id: 'ws1', source_kind: 'extrato', file_hash: 'abc123', status: 'parsed' });
    expect(c.row.summary_json).toBeTruthy();
    expect(c.row.detected_balance).toBe(100);
  });
});

describe('insertImportItems', () => {
  it('insere 1 item por movimento com batch_id/workspace_id', async () => {
    const n = await insertImportItems('ws1', 'batch-1', summary());
    expect(n).toBe(3);
    const c = last();
    expect(c).toMatchObject({ table: 'personal_import_items', op: 'insert' });
    expect(Array.isArray(c.row)).toBe(true);
    expect(c.row[0]).toMatchObject({ batch_id: 'batch-1', workspace_id: 'ws1' });
    expect(c.row[0]).toHaveProperty('inferred_kind');
  });
});

describe('updateImportItemDecision — só campos user_*', () => {
  it('grava user_decision/user_kind/user_category, nunca inferred_*', async () => {
    await updateImportItemDecision('item-9', { userDecision: 'corrigido', userKind: 'fixa', userCategory: 'Moradia' });
    const c = last();
    expect(c).toMatchObject({ table: 'personal_import_items', op: 'update', eqCol: 'id', eqVal: 'item-9' });
    expect(c.row).toEqual({ user_decision: 'corrigido', user_kind: 'fixa', user_category: 'Moradia' });
    expect(c.row).not.toHaveProperty('inferred_kind');
    expect(c.row).not.toHaveProperty('inferred_category');
  });
});

describe('markImportBatchApplied — guarda de reaplicação', () => {
  it('aplica quando status ainda não é applied', async () => {
    selectResult = { status: 'review' };
    await markImportBatchApplied('batch-1');
    const upd = calls.find((x) => x.op === 'update')!;
    expect(upd.row).toMatchObject({ status: 'applied' });
    expect(upd.row.applied_at).toBeTruthy();
    expect(upd.row.retention_until).toBeTruthy();
  });

  it('LANÇA se o batch já está applied (não reaplica)', async () => {
    selectResult = { status: 'applied' };
    await expect(markImportBatchApplied('batch-1')).rejects.toThrow(/já aplicado/i);
    expect(calls.some((x) => x.op === 'update')).toBe(false);
  });
});

describe('discardImportBatch', () => {
  it('marca discarded com retention', async () => {
    await discardImportBatch('batch-1');
    expect(last().row).toMatchObject({ status: 'discarded' });
    expect(last().row.retention_until).toBeTruthy();
  });
});

describe('upsertCategoryRule', () => {
  it('upsert com onConflict workspace/match_type/pattern', async () => {
    await upsertCategoryRule('ws1', { matchType: 'contains', pattern: 'ifood', category: 'Restaurantes/Delivery' });
    const c = last();
    expect(c).toMatchObject({ table: 'personal_category_rules', op: 'upsert' });
    expect(c.row).toMatchObject({ workspace_id: 'ws1', match_type: 'contains', pattern: 'ifood', category: 'Restaurantes/Delivery', source: 'user' });
    expect(c.opts).toMatchObject({ onConflict: 'workspace_id,match_type,pattern' });
  });
});
