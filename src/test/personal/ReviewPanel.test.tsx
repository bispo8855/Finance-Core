import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ReviewPanel, { ReviewPanelProps } from '@/components/personal/import/ReviewPanel';
import { ReviewState, DailyCandidate } from '@/domain/personal/import/reviewDecisions';
import { ImportSummary, InferredIncome } from '@/domain/personal/import/personalImportInference';

const inc = (o: Partial<InferredIncome>): InferredIncome => ({ key: 'k', description: 'X', amount: 100, occurrences: 1, months: ['2026-06'], confidence: 'media', reason: '', ...o });
function sum(o: Partial<ImportSummary>): ImportSummary {
  return {
    period: { from: '', to: '', months: [], mesesParciais: [] },
    counts: { linhas: 0, rendas: 0, fixas: 0, transferenciasProprias: 0, pagamentosFatura: 0, variaveis: 0, ignorados: 0, duvidosos: 0 },
    saldo: { valor: null, fonte: null }, alertaContaMista: null,
    rendasProvaveis: [], fixasProvaveis: [], transferenciasProprias: [], pagamentosFatura: [],
    gastosVariaveis: { total: 0, byCategory: [] }, categoriasTop: [], ignorados: [], duvidosos: [],
    diaADia: { porMes: [], min: 0, normal: 0, heavy: 0, confidence: 'media', issues: [] }, itens: [],
    ...o,
  } as ImportSummary;
}
const noDaily: DailyCandidate = { hasCandidate: false, min: 0, normal: 0, heavy: 0, completeMonths: 0, outrosHigh: false, canConfirm: false, reason: null };
const st = (o: Partial<ReviewState> = {}): ReviewState => ({ scope: 'pessoal', useBalance: false, accountChoice: null, income: {}, fixed: {}, dailyConfirmed: false, today: '2026-08-01', ...o });

function Harness(props: Omit<ReviewPanelProps, 'state' | 'onChange'> & { initial: ReviewState }) {
  const [state, setState] = useState<ReviewState>(props.initial);
  return <ReviewPanel {...props} state={state} onChange={setState} />;
}
const baseProps = (o: Partial<ReviewPanelProps> = {}): Omit<ReviewPanelProps, 'state' | 'onChange'> & { initial: ReviewState } => ({
  summary: sum({}), initial: st(), accounts: [], needsScope: false, daily: noDaily, preview: null,
  gate: { ok: true, reasons: [] }, applying: false, applyError: null, reimportRequired: false,
  onReimport: vi.fn(), onApply: vi.fn(), ...o,
});

describe('ReviewPanel', () => {
  it('batch antigo → bloqueia e pede reimportação', () => {
    const onReimport = vi.fn();
    render(<Harness {...baseProps({ reimportRequired: true, onReimport })} />);
    expect(screen.getByText(/importado antes da atualização/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Importar novamente'));
    expect(onReimport).toHaveBeenCalledTimes(1);
  });

  it('escopo negocio → mostra orientação Business e não mostra blocos aplicáveis', () => {
    render(<Harness {...baseProps({ needsScope: true, initial: st({ scope: 'negocio' }), summary: sum({ alertaContaMista: 'x', saldo: { valor: 100, fonte: 'movimento' } }) })} />);
    expect(screen.getByText(/Aurys Business/)).toBeInTheDocument();
    expect(screen.queryByText(/Usar este saldo/)).not.toBeInTheDocument();
  });

  it('saldo marcado sem AccountTarget (gate falho) → botão aplicar desabilitado + motivo', () => {
    render(<Harness {...baseProps({ summary: sum({ saldo: { valor: 500, fonte: 'movimento' } }), initial: st({ useBalance: true }), gate: { ok: false, reasons: ['Escolha a conta para aplicar o saldo (existente ou nova).'] } })} />);
    const btn = screen.getByRole('button', { name: /Aplicar dados confirmados/ });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Escolha a conta para aplicar o saldo/)).toBeInTheDocument();
  });

  it('renda de ocorrência única marcada → pergunta "Isso entra todo mês?"', () => {
    const s = sum({ rendasProvaveis: [inc({ key: 'venda', description: 'Venda avulsa', months: ['2026-06'] })] });
    const initial = st({ income: { 'renda:venda': { checked: true } } });
    render(<Harness {...baseProps({ summary: s, initial })} />);
    expect(screen.getByText(/Isso entra todo mês/)).toBeInTheDocument();
  });

  it('daily sem gate → toggle ausente e motivo visível; com gate → toggle presente', () => {
    const s = sum({ diaADia: { porMes: [{ monthISO: '2026-06', total: 300, parcial: false }], min: 250, normal: 300, heavy: 350, confidence: 'media', issues: [] } });
    const bloqueado: DailyCandidate = { hasCandidate: true, min: 250, normal: 300, heavy: 350, completeMonths: 0, outrosHigh: false, canConfirm: false, reason: 'Faltam meses completos para estimar o dia a dia com segurança.' };
    render(<Harness {...baseProps({ summary: s, daily: bloqueado })} />);
    expect(screen.queryByText(/representa bem meu gasto mensal/)).not.toBeInTheDocument();
    expect(screen.getByText(/Faltam meses completos/)).toBeInTheDocument();

    const liberado: DailyCandidate = { ...bloqueado, completeMonths: 2, canConfirm: true, reason: null };
    render(<Harness {...baseProps({ summary: s, daily: liberado })} />);
    expect(screen.getByText(/representa bem meu gasto mensal/)).toBeInTheDocument();
  });

  it('preview mostra contagens, aviso de dedupe e onboarding incompleto', () => {
    render(<Harness {...baseProps({ preview: { saldo: true, rendas: 2, fixas: 4, daily: false, dedupe: 1, onboardingConfiavel: false, onboardingMissing: ['cartão/fatura'] } })} />);
    expect(screen.getByText('O Aurys vai aplicar:')).toBeInTheDocument();
    expect(screen.getByText(/2 renda/)).toBeInTheDocument();
    expect(screen.getByText(/4 conta\(s\) fixa/)).toBeInTheDocument();
    expect(screen.getByText(/já existem e não serão duplicados/)).toBeInTheDocument();
    expect(screen.getByText(/leitura completa ainda não será liberada/)).toBeInTheDocument();
  });

  it('aplicar chama onApply uma única vez quando habilitado', () => {
    const onApply = vi.fn();
    render(<Harness {...baseProps({ onApply })} />);
    fireEvent.click(screen.getByRole('button', { name: /Aplicar dados confirmados/ }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('duplo clique bloqueado: durante applying o botão fica desabilitado', () => {
    const onApply = vi.fn();
    render(<Harness {...baseProps({ applying: true, onApply })} />);
    const btn = screen.getByRole('button', { name: /Aplicando/ });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('erro de aplicação é exibido e botão volta a permitir retry (applying=false)', () => {
    render(<Harness {...baseProps({ applyError: 'Falha ao aplicar', applying: false })} />);
    expect(screen.getByText('Falha ao aplicar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aplicar dados confirmados/ })).not.toBeDisabled();
  });
});
