import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do cliente Supabase (nativo do vitest — sem lib nova, sem tocar supabaseClient.ts).
vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn(), getUser: vi.fn() } },
}));

import { supabase } from '@/lib/supabaseClient';
import { SupabaseFinanceService } from '@/services/finance/supabaseFinanceService';
import {
  mapAccountRow, mapIncomeRow, mapCardRow, mapCardBillRow, mapFixedCommitmentRow,
  mapInstallmentRow, mapReimbursementRow, mapExtraordinaryEventRow, mapDailySpendingRow,
} from '@/services/personal/personalService';

// ============================================================================
// PARTE 1 — Mapeamentos row → Persisted* (PUROS, sem Supabase).
// Provam: datas preservadas, NUMERIC string→number, nullables mantidos, sem cálculo.
// ============================================================================
describe('mapeamento row → Persisted* (puro)', () => {
  it('conta: NUMERIC string vira number; nullables preservados', () => {
    const r = mapAccountRow({ id: 'a1', label: 'Conta', current_balance: '313.00', balance_date: '2026-07-26', is_reserve: null, confidence: 'alta' });
    expect(r).toEqual({ id: 'a1', label: 'Conta', current_balance: 313, balance_date: '2026-07-26', is_reserve: null, confidence: 'alta' });
    expect(typeof r.current_balance).toBe('number');
  });

  it('conta com saldo negativo em string', () => {
    expect(mapAccountRow({ id: 'a2', label: 'C2', current_balance: '-4606.00', confidence: 'alta' }).current_balance).toBe(-4606);
  });

  it('renda: day_of_month e specific_date nullables', () => {
    const r = mapIncomeRow({ id: 'i1', label: 'Salário', amount: '9000', day_of_month: 5, frequency: 'mensal', nature: 'rotina', variable: null, specific_date: null, confidence: 'alta' });
    expect(r).toEqual({ id: 'i1', label: 'Salário', amount: 9000, day_of_month: 5, frequency: 'mensal', nature: 'rotina', variable: null, specific_date: null, confidence: 'alta' });
  });

  it('cartão: credit_limit nulo preservado; string vira number quando presente', () => {
    expect(mapCardRow({ id: 'c1', label: 'CA', closing_day: 14, due_day: 20, credit_limit: null }).credit_limit).toBeNull();
    expect(mapCardRow({ id: 'c2', label: 'CB', closing_day: 29, due_day: 5, credit_limit: '5000.00' }).credit_limit).toBe(5000);
  });

  it('fatura: amount string→number; datas de ciclo preservadas', () => {
    const r = mapCardBillRow({ id: 'b1', card_id: 'CB', cycle_start: '2026-06-30', cycle_end: '2026-07-29', due_date: '2026-08-05', amount: '2689.40', status: 'fechada', confidence: 'alta' });
    expect(r.amount).toBe(2689.4);
    expect(r.due_date).toBe('2026-08-05');
    expect(r.card_id).toBe('CB');
  });

  it('fixa: card_id e active_until nullables; pay_method preservado', () => {
    const r = mapFixedCommitmentRow({ id: 'f1', label: 'Aluguel', amount: '1330', day_of_month: 1, pay_method: 'boleto', card_id: null, essential: true, active_until: null, confidence: 'alta' });
    expect(r).toMatchObject({ amount: 1330, pay_method: 'boleto', card_id: null, essential: true, active_until: null });
  });

  it('parcela: monthly_amount string→number; meses TEXT preservados', () => {
    const r = mapInstallmentRow({ id: 'p1', group_label: 'Tablet', monthly_amount: '583.33', start_month: '2026-01', end_month: '2026-12', card_id: 'CA', pay_method: 'cartao', reimbursable: false, confidence: 'alta' });
    expect(r.monthly_amount).toBe(583.33);
    expect(r.start_month).toBe('2026-01');
    expect(r.reimbursable).toBe(false);
  });

  it('reembolso: expected_date e linked_to', () => {
    const r = mapReimbursementRow({ id: 'r1', who: 'Terceiro', amount: '1774.67', expected_date: '2026-08-06', linked_to: 'P-comp', status: 'previsto', confidence: 'media' });
    expect(r).toMatchObject({ amount: 1774.67, expected_date: '2026-08-06', linked_to: 'P-comp', status: 'previsto' });
  });

  it('extraordinário: event_date preservado como coluna (o adapter converte para date)', () => {
    const r = mapExtraordinaryEventRow({ id: 'x1', label: 'Restituição', amount: '1800', event_date: '2026-07-31', klass: 'extraordinario', destination: 'livre', confidence: 'media' });
    expect(r).toMatchObject({ amount: 1800, event_date: '2026-07-31', klass: 'extraordinario', destination: 'livre' });
  });

  it('dia a dia: min/normal/heavy string→number; profile preservado', () => {
    const r = mapDailySpendingRow({ id: 'd1', month_iso: '2026-07', min_amount: '3750', normal_amount: '4750', heavy_amount: '6500', profile: 'maioria_cartao', confidence: 'media' });
    expect(r).toMatchObject({ month_iso: '2026-07', min_amount: 3750, normal_amount: 4750, heavy_amount: 6500, profile: 'maioria_cartao' });
  });
});

// ============================================================================
// PARTE 2 — getActiveWorkspace do Business NUNCA retorna o workspace personal.
// Stub mínimo local do chain do Supabase (thenable + spy nos .eq).
// ============================================================================

interface EqCall { col: string; val: unknown; }
// data é o payload do PostgREST; o await/maybeSingle resolve sempre { data, error }.
function makeChain(data: unknown, eqCalls: EqCall[]) {
  const result = { data, error: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: () => chain,
    eq: (col: string, val: unknown) => { eqCalls.push({ col, val }); return chain; },
    limit: () => chain,
    maybeSingle: () => Promise.resolve(result),
    // torna `await chain` (Try 1 termina em .limit(1)) resolver { data, error }
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej),
  };
  return chain;
}

const businessWs = { id: 'ws-biz', owner_id: 'u1', name: 'Minha Empresa', legal_name: null, document_number: null, workspace_type: 'business', avatar_initials: 'ME' };

describe('getActiveWorkspace — nunca retorna o workspace personal', () => {
  let eqCalls: EqCall[];
  beforeEach(() => {
    eqCalls = [];
    vi.mocked(supabase.from).mockReset();
  });

  function service() {
    const s = new SupabaseFinanceService();
    s.setUserId('u1'); // evita mockar auth
    return s;
  }

  it('cenário 1 — só business: retorna o business via membership', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'workspace_members') return makeChain([{ workspace_id: 'ws-biz', workspaces: businessWs }], eqCalls);
      return makeChain(null, eqCalls);
    });
    const ws = await service().getActiveWorkspace();
    expect(ws?.workspaceType).toBe('business');
    expect(ws?.id).toBe('ws-biz');
    // prova que o filtro business está na Try 1
    expect(eqCalls).toContainEqual({ col: 'workspaces.workspace_type', val: 'business' });
  });

  it('cenário 2 — business + personal: o banco filtra business; personal nunca retorna', async () => {
    // Com o filtro no banco, a Try 1 já devolve apenas o business.
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'workspace_members') return makeChain([{ workspace_id: 'ws-biz', workspaces: businessWs }], eqCalls);
      return makeChain(null, eqCalls);
    });
    const ws = await service().getActiveWorkspace();
    expect(ws?.workspaceType).toBe('business');
    expect(ws?.workspaceType).not.toBe('personal');
    expect(eqCalls).toContainEqual({ col: 'workspaces.workspace_type', val: 'business' });
  });

  it('cenário 3 — fallback por owner_id também filtra business', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'workspace_members') return makeChain([], eqCalls);       // sem membership → cai no fallback
      return makeChain(businessWs, eqCalls);                                   // fallback .maybeSingle() → business
    });
    const ws = await service().getActiveWorkspace();
    expect(ws?.workspaceType).toBe('business');
    // prova que o fallback também filtra business
    expect(eqCalls).toContainEqual({ col: 'workspace_type', val: 'business' });
  });
});
