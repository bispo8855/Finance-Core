import { describe, it, expect, vi } from 'vitest';
import { useMemo, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ReviewPanel from '@/components/personal/import/ReviewPanel';
import { buildApplyPlan, ImportItemRow, ImportBatchRow } from '@/domain/personal/import/applyPlan';
import { PersistedPersonalData } from '@/domain/personal/personalInputsAdapter';
import { ImportSummary, InferredFixed } from '@/domain/personal/import/personalImportInference';
import {
  initialReviewState, buildDecisions, planPreview, canApply, dailyCandidate, needsScope, ReviewState,
} from '@/domain/personal/import/reviewDecisions';

// Replica EXATAMENTE a cadeia de PersonalImportReview (sem Supabase):
// clique → ReviewState → buildDecisions → buildApplyPlan → planPreview → ReviewPanel.
function Wired(props: { summary: ImportSummary; items: ImportItemRow[]; batch: ImportBatchRow; db: PersistedPersonalData }) {
  const { summary, items, batch, db } = props;
  const today = '2026-08-01';
  const [state, setState] = useState<ReviewState | null>(null);
  const effective = state ?? initialReviewState(summary, today);
  const plan = useMemo(
    () => buildApplyPlan({
      batch: { ...batch, account_scope: effective.scope ?? batch.account_scope, detected_balance: batch.detected_balance ?? summary.saldo.valor, balance_source: batch.balance_source ?? summary.saldo.fonte, summary_json: summary },
      items, decisions: buildDecisions(effective), existingPersonalData: db,
    }),
    [effective, batch, items, summary, db],
  );
  return (
    <ReviewPanel
      summary={summary}
      state={effective}
      onChange={setState}
      accounts={db.accounts.map((a) => ({ id: a.id, label: a.label }))}
      needsScope={needsScope(summary)}
      daily={dailyCandidate(summary)}
      preview={planPreview(plan)}
      gate={canApply(effective, summary)}
      applying={false}
      applyError={null}
      reimportRequired={false}
      onReimport={vi.fn()}
      onApply={vi.fn()}
    />
  );
}

const fixInf = (key: string, description: string, amount: number): InferredFixed =>
  ({ key, description, amount, occurrences: 2, months: ['2026-06', '2026-07'], dayOfMonth: 5, confidence: 'media', reason: '' });

function summary(): ImportSummary {
  return {
    period: { from: '2026-06-01', to: '2026-07-31', months: ['2026-06', '2026-07'], mesesParciais: [] },
    counts: { linhas: 0, rendas: 0, fixas: 2, transferenciasProprias: 0, pagamentosFatura: 0, variaveis: 0, ignorados: 0, duvidosos: 0 },
    saldo: { valor: 5000, fonte: 'movimento' }, alertaContaMista: null,
    rendasProvaveis: [], fixasProvaveis: [fixInf('aluguel', 'Aluguel', 1000), fixInf('internet', 'PIX ENVIADO INTERNET', 89.9)],
    transferenciasProprias: [], pagamentosFatura: [],
    gastosVariaveis: { total: 0, byCategory: [] }, categoriasTop: [], ignorados: [], duvidosos: [],
    diaADia: { porMes: [], min: 0, normal: 0, heavy: 0, confidence: 'media', issues: [] }, itens: [],
  } as ImportSummary;
}

const item = (o: Partial<ImportItemRow>): ImportItemRow => ({ id: 'i', group_key: null, inferred_kind: 'fixa', inferred_category: 'Outros', raw_date: '2026-06-05', raw_amount: 1000, raw_description: 'x', direction: 'saida', user_decision: null, applied_to_id: null, applied_to_table: null, ...o });

function items(): ImportItemRow[] {
  return [
    item({ id: 'a1', group_key: 'fixa:aluguel', raw_description: 'Aluguel', raw_amount: 1000, raw_date: '2026-06-05' }),
    item({ id: 'a2', group_key: 'fixa:aluguel', raw_description: 'Aluguel', raw_amount: 1000, raw_date: '2026-07-05' }),
    item({ id: 'n1', group_key: 'fixa:internet', raw_description: 'PIX ENVIADO INTERNET', raw_amount: 89.9, raw_date: '2026-06-10' }),
    item({ id: 'n2', group_key: 'fixa:internet', raw_description: 'PIX ENVIADO INTERNET', raw_amount: 89.9, raw_date: '2026-07-10' }),
  ];
}
const batch = (): ImportBatchRow => ({ id: 'b1', workspace_id: 'ws1', status: 'review', account_scope: 'pessoal', detected_balance: 5000, balance_source: 'movimento', period_start: '2026-06-01', period_end: '2026-07-31', applied_account_id: null, summary_json: null });
const db = (): PersistedPersonalData => ({ accounts: [{ id: 'acc-santander', label: 'Santander', current_balance: 0, balance_date: '2026-06-01', is_reserve: null, confidence: 'media' }], incomeSources: [], cards: [], cardBills: [], fixedCommitments: [], installments: [], reimbursements: [], extraordinaryEvents: [], dailySpending: [], settings: undefined });

describe('integração: escolhas da revisão refletem no preview', () => {
  it('saldo e fixas reagem aos cliques (nenhum saldo/0 → 1 saldo/2 fixas → …)', () => {
    render(<Wired summary={summary()} items={items()} batch={batch()} db={db()} />);

    // Inicial: fixas media → default DESMARCADAS; useBalance false.
    expect(screen.getByText('nenhum saldo')).toBeInTheDocument();
    expect(screen.getByText(/^0 conta\(s\) fixa\(s\)$/)).toBeInTheDocument();

    // Marca "Usar este saldo" → ainda sem alvo → segue nenhum saldo.
    fireEvent.click(screen.getByLabelText('Usar este saldo'));
    expect(screen.getByText('nenhum saldo')).toBeInTheDocument();

    // Escolhe "Conta existente" (auto-seleciona a primeira conta) → 1 saldo.
    fireEvent.click(screen.getByLabelText('Conta existente'));
    expect(screen.getByText('1 saldo')).toBeInTheDocument();

    // Marca fixa A (Aluguel) → 1 fixa.
    fireEvent.click(screen.getByLabelText('Aluguel'));
    expect(screen.getByText(/^1 conta\(s\) fixa\(s\)$/)).toBeInTheDocument();

    // Marca fixa B (Internet) → 2 fixas.
    fireEvent.click(screen.getByLabelText('PIX ENVIADO INTERNET'));
    expect(screen.getByText(/^2 conta\(s\) fixa\(s\)$/)).toBeInTheDocument();

    // Desmarca fixa A → 1 fixa.
    fireEvent.click(screen.getByLabelText('Aluguel'));
    expect(screen.getByText(/^1 conta\(s\) fixa\(s\)$/)).toBeInTheDocument();

    // Desmarca "Usar este saldo" → nenhum saldo (fixa segue 1).
    fireEvent.click(screen.getByLabelText('Usar este saldo'));
    expect(screen.getByText('nenhum saldo')).toBeInTheDocument();
    expect(screen.getByText(/^1 conta\(s\) fixa\(s\)$/)).toBeInTheDocument();
  });

  it('detected_balance NULO no batch → coalesce do summary faz o saldo aplicar', () => {
    const bAntigo: ImportBatchRow = { ...batch(), detected_balance: null, balance_source: null };
    render(<Wired summary={summary()} items={items()} batch={bAntigo} db={db()} />);
    fireEvent.click(screen.getByLabelText('Usar este saldo'));
    fireEvent.click(screen.getByLabelText('Conta existente'));
    expect(screen.getByText('1 saldo')).toBeInTheDocument();
  });
});
