import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do supabase capturando cada operação e o payload (para provar o mapeamento snake_case).
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));
import { supabase } from '@/lib/supabaseClient';
import {
  createPersonalAccount, updatePersonalAccount, deletePersonalAccount,
  createPersonalIncome, createPersonalCard, createPersonalCardBill,
  createPersonalFixedCommitment, upsertPersonalDailySpending, upsertPersonalSettings,
} from '@/services/personal/personalService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Call = { table: string; op: string; row?: any; opts?: any; eqCol?: string; eqVal?: any };
let calls: Call[];

function chainFor(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert(row: any) { calls.push({ table, op: 'insert', row }); return chain; },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update(row: any) { calls.push({ table, op: 'update', row }); return chain; },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upsert(row: any, opts: any) { calls.push({ table, op: 'upsert', row, opts }); return Promise.resolve({ error: null }); },
    delete() { calls.push({ table, op: 'delete' }); return chain; },
    select() { return chain; },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eq(col: string, val: any) { const last = calls[calls.length - 1]; if (last) { last.eqCol = col; last.eqVal = val; } return chain; },
    single() { return Promise.resolve({ data: { id: 'new-id' }, error: null }); },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then(res: any, rej: any) { return Promise.resolve({ error: null }).then(res, rej); },
  };
  return chain;
}

beforeEach(() => {
  calls = [];
  vi.mocked(supabase.from).mockImplementation((table: string) => chainFor(table));
});

const last = () => calls[calls.length - 1];

describe('CRUD — mapeamento camelCase → snake_case e workspace_id', () => {
  it('createPersonalAccount usa workspace_id e grava balance_date quando informado', async () => {
    const res = await createPersonalAccount('ws1', { label: 'Conta', currentBalance: 313.5, balanceDate: '2026-08-16', confidence: 'alta' });
    expect(res.id).toBe('new-id');
    const c = last();
    expect(c).toMatchObject({ table: 'personal_accounts', op: 'insert' });
    expect(c.row).toMatchObject({ workspace_id: 'ws1', label: 'Conta', current_balance: 313.5, balance_date: '2026-08-16', is_reserve: false, confidence: 'alta' });
  });

  it('updatePersonalAccount: balanceDate vira balance_date e filtra por id', async () => {
    await updatePersonalAccount('acc1', { balanceDate: '2026-09-01', currentBalance: -100 });
    const c = last();
    expect(c).toMatchObject({ table: 'personal_accounts', op: 'update', eqCol: 'id', eqVal: 'acc1' });
    expect(c.row).toEqual({ balance_date: '2026-09-01', current_balance: -100 });
  });

  it('deletePersonalAccount deleta na tabela certa filtrando por id', async () => {
    await deletePersonalAccount('acc9');
    expect(last()).toMatchObject({ table: 'personal_accounts', op: 'delete', eqCol: 'id', eqVal: 'acc9' });
  });

  it('createPersonalIncome mapeia day_of_month/specific_date e usa workspace_id', async () => {
    await createPersonalIncome('ws1', { label: 'Salário', amount: 9000, dayOfMonth: 5, frequency: 'mensal', nature: 'rotina', confidence: 'alta' });
    expect(last().row).toMatchObject({ workspace_id: 'ws1', day_of_month: 5, frequency: 'mensal', nature: 'rotina', specific_date: null, variable: false });
  });

  it('createPersonalCard mapeia closing_day/due_day', async () => {
    await createPersonalCard('ws1', { label: 'CA', closingDay: 14, dueDay: 20 });
    expect(last().row).toMatchObject({ workspace_id: 'ws1', closing_day: 14, due_day: 20, credit_limit: null });
  });

  it('createPersonalCardBill mapeia card_id/due_date', async () => {
    await createPersonalCardBill('ws1', { cardId: 'ca1', amount: 2000, dueDate: '2026-09-05', status: 'fechada', confidence: 'alta' });
    expect(last().row).toMatchObject({ workspace_id: 'ws1', card_id: 'ca1', due_date: '2026-09-05', amount: 2000, status: 'fechada' });
  });

  it('fixa no CARTÃO grava pay_method=cartao e card_id — e NÃO cria saída direta (só 1 insert)', async () => {
    await createPersonalFixedCommitment('ws1', { label: 'Streaming', amount: 39.9, dayOfMonth: 15, payMethod: 'cartao', cardId: 'ca1', confidence: 'alta' });
    expect(calls).toHaveLength(1); // nenhuma inserção extra (a fatura é composta pelo adapter, não aqui)
    expect(last()).toMatchObject({ table: 'personal_fixed_commitments', op: 'insert' });
    expect(last().row).toMatchObject({ workspace_id: 'ws1', pay_method: 'cartao', card_id: 'ca1', day_of_month: 15 });
  });

  it('fixa por boleto grava card_id null', async () => {
    await createPersonalFixedCommitment('ws1', { label: 'Aluguel', amount: 1330, dayOfMonth: 1, payMethod: 'boleto', confidence: 'alta' });
    expect(last().row).toMatchObject({ pay_method: 'boleto', card_id: null });
  });

  it('upsertPersonalDailySpending: onConflict por workspace/mês e min/normal/heavy → *_amount', async () => {
    await upsertPersonalDailySpending('ws1', { monthISO: '2026-08', minAmount: 3750, normalAmount: 4750, heavyAmount: 6500, profile: 'maioria_cartao', confidence: 'media' });
    const c = last();
    expect(c).toMatchObject({ table: 'personal_daily_spending', op: 'upsert' });
    expect(c.row).toMatchObject({ workspace_id: 'ws1', month_iso: '2026-08', min_amount: 3750, normal_amount: 4750, heavy_amount: 6500 });
    expect(c.opts).toMatchObject({ onConflict: 'workspace_id,month_iso' });
  });

  it('upsertPersonalSettings: flags viram declared_no_cards/declared_no_fixed_commitments', async () => {
    await upsertPersonalSettings('ws1', { declaredNoCards: true, declaredNoFixedCommitments: false, onboardingCompletedAt: '2026-08-16T12:00:00Z' });
    const c = last();
    expect(c).toMatchObject({ table: 'personal_settings', op: 'upsert' });
    expect(c.row).toMatchObject({ workspace_id: 'ws1', declared_no_cards: true, declared_no_fixed_commitments: false, onboarding_completed_at: '2026-08-16T12:00:00Z' });
    expect(c.opts).toMatchObject({ onConflict: 'workspace_id' });
  });
});
