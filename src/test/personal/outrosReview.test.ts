import { describe, it, expect } from 'vitest';
import {
  selectBiggestOutros, adjustSummaryForReview, outrosStatus,
  decisionToItemPatch, outrosDecisionWrites, OutrosDecisions,
} from '@/domain/personal/import/outrosReview';
import { buildApplyPlan, ImportItemRow, ImportBatchRow } from '@/domain/personal/import/applyPlan';
import { buildDecisions } from '@/domain/personal/import/reviewDecisions';
import { ImportSummary } from '@/domain/personal/import/personalImportInference';
import { PersistedPersonalData } from '@/domain/personal/personalInputsAdapter';

// ---- fixture parecida com o batch real: 1 mês completo, "Outros" alto ----
const vi_ = (id: string, amount: number, category: string | null, description: string): ImportItemRow => ({
  id, group_key: null, inferred_kind: 'variavel', inferred_category: category, raw_date: '2026-08-10',
  raw_amount: amount, raw_description: description, direction: 'saida', user_decision: null, applied_to_id: null, applied_to_table: null,
});

// A(5000) B(2000) C(1000) E(300) em Outros; D(500) já em Mercado.
const ITEMS: ImportItemRow[] = [
  vi_('A', 5000, 'Outros', 'PAGAMENTO A FORNECEDORES'),
  vi_('B', 2000, 'Outros', 'PIX ENVIADO CONSTRUTORA'),
  vi_('C', 1000, 'Outros', 'POSTO IPIRANGA'),
  vi_('D', 500, 'Mercado', 'SUPERMERCADO'),
  vi_('E', 300, 'Outros', 'PIX ENVIADO FULANO'),
];

function baseSummary(): ImportSummary {
  const total = 8800; // 5000+2000+1000+500+300
  return {
    period: { from: '2026-08-01', to: '2026-08-31', months: ['2026-08'], mesesParciais: [] },
    counts: { linhas: 5, rendas: 0, fixas: 0, transferenciasProprias: 0, pagamentosFatura: 0, variaveis: 5, ignorados: 0, duvidosos: 0 },
    saldo: { valor: null, fonte: null }, alertaContaMista: null,
    rendasProvaveis: [], fixasProvaveis: [], transferenciasProprias: [], pagamentosFatura: [],
    gastosVariaveis: { total, byCategory: [{ category: 'Outros', total: 8300, count: 4 }, { category: 'Mercado', total: 500, count: 1 }] },
    categoriasTop: [], ignorados: [], duvidosos: [],
    diaADia: { porMes: [{ monthISO: '2026-08', total, parcial: false }], min: total, normal: total, heavy: total, confidence: 'baixa', issues: [] },
    itens: [],
  } as ImportSummary;
}

const batch = (summary_json: ImportSummary): ImportBatchRow => ({ id: 'b1', workspace_id: 'ws1', status: 'review', account_scope: 'pessoal', detected_balance: null, balance_source: null, period_start: '2026-08-01', period_end: '2026-08-31', applied_account_id: null, summary_json });
const db = (): PersistedPersonalData => ({ accounts: [], incomeSources: [], cards: [], cardBills: [], fixedCommitments: [], installments: [], reimbursements: [], extraordinaryEvents: [], dailySpending: [], settings: undefined });

describe('selectBiggestOutros', () => {
  it('lista só itens de Outros, desc, cobrindo ~80% (para antes do top 10)', () => {
    const big = selectBiggestOutros(ITEMS);
    expect(big.map((o) => o.id)).toEqual(['A', 'B']); // 5000+2000=7000 ≥ 80% de 8300 → para em B
    expect(big.every((o) => o.id !== 'D')).toBe(true); // D não é Outros
  });
});

describe('vertical AP4C.1d — revisão dirigida derruba Outros e reabilita daily', () => {
  it('Outros alto → daily bloqueado; decisões derrubam Outros; daily volta a ser elegível', () => {
    // 1) Estado inicial: Outros 8300/8800 = 94% → bloqueado.
    const s0 = baseSummary();
    const st0 = outrosStatus(s0);
    expect(st0.outrosPct).toBeCloseTo(8300 / 8800, 4);
    expect(st0.blockedByOutros).toBe(true);
    const plan0 = buildApplyPlan({ batch: batch(s0), items: ITEMS, decisions: buildDecisions({ scope: 'pessoal', useBalance: false, accountChoice: null, income: {}, fixed: {}, dailyConfirmed: true, profile: 'maioria_pix', today: '2026-09-01' }), existingPersonalData: db() });
    expect(plan0.dailyActions.filter((a) => a.op === 'create')).toEqual([]); // Outros>20% → skip

    // 2) A = Da empresa → sai da leitura; Outros cai.
    let dec: OutrosDecisions = { A: { kind: 'negocio' } };
    let s = adjustSummaryForReview(s0, ITEMS, dec);
    expect(outrosStatus(s).variableTotal).toBe(3800);            // 8800-5000
    expect(outrosStatus(s).outrosTotal).toBe(3300);              // 8300-5000
    expect(outrosStatus(s).blockedByOutros).toBe(true);          // 3300/3800 ainda alto

    // 3) B = Pontual → sai do dia a dia estrutural.
    dec = { ...dec, B: { kind: 'pontual' } };
    s = adjustSummaryForReview(s0, ITEMS, dec);
    expect(outrosStatus(s).variableTotal).toBe(1800);            // -2000
    expect(outrosStatus(s).outrosTotal).toBe(1300);

    // 4) C = reclassificar Transporte → sai de Outros, mas continua no dia a dia.
    dec = { ...dec, C: { kind: 'pessoal', category: 'Transporte' } };
    s = adjustSummaryForReview(s0, ITEMS, dec);
    const st = outrosStatus(s);
    expect(st.variableTotal).toBe(1800);                         // C permanece no total
    expect(st.outrosTotal).toBe(300);                            // só E resta em Outros
    expect(s.gastosVariaveis.byCategory.find((c) => c.category === 'Transporte')?.total).toBe(1000);
    expect(st.outrosPct).toBeCloseTo(300 / 1800, 4);            // 16.7%
    expect(st.blockedByOutros).toBe(false);                      // ≤ 20% → desbloqueia

    // 5) Daily volta a ser elegível: sem profile ainda não cria; com profile cria (confiança baixa, 1 mês).
    const semProfile = buildApplyPlan({ batch: batch(s), items: ITEMS, decisions: buildDecisions({ scope: 'pessoal', useBalance: false, accountChoice: null, income: {}, fixed: {}, dailyConfirmed: true, today: '2026-09-01' }), existingPersonalData: db() });
    expect(semProfile.dailyActions.some((a) => a.reason === 'Informe como você paga a maior parte do dia a dia.')).toBe(true);
    expect(semProfile.dailyActions.filter((a) => a.op === 'create')).toEqual([]);

    const comProfile = buildApplyPlan({ batch: batch(s), items: ITEMS, decisions: buildDecisions({ scope: 'pessoal', useBalance: false, accountChoice: null, income: {}, fixed: {}, dailyConfirmed: true, profile: 'maioria_pix', today: '2026-09-01' }), existingPersonalData: db() });
    const creates = comProfile.dailyActions.filter((a) => a.op === 'create');
    expect(creates.length).toBe(1);
    expect(creates[0].confidence).toBe('baixa');                 // 1 mês completo
    expect(creates[0].payload!.profile).toBe('maioria_pix');
  });
});

describe('persistência: mapeia para campos existentes (sem migration)', () => {
  it('pessoal→corrigido+categoria; pontual/negocio→ignorado; duvida→null', () => {
    expect(decisionToItemPatch('x', { kind: 'pessoal', category: 'Transporte' })).toEqual({ itemId: 'x', userDecision: 'corrigido', userKind: 'variavel', userCategory: 'Transporte' });
    expect(decisionToItemPatch('x', { kind: 'pontual' })).toMatchObject({ userDecision: 'ignorado', userKind: 'pontual' });
    expect(decisionToItemPatch('x', { kind: 'negocio' })).toMatchObject({ userDecision: 'ignorado', userKind: 'negocio' });
    expect(decisionToItemPatch('x', { kind: 'duvida' })).toBeNull();
  });
  it('outrosDecisionWrites ignora as decisões "duvida"', () => {
    const writes = outrosDecisionWrites({ A: { kind: 'negocio' }, B: { kind: 'duvida' }, C: { kind: 'pessoal', category: 'Mercado' } });
    expect(writes.map((w) => w.itemId).sort()).toEqual(['A', 'C']);
  });
});
