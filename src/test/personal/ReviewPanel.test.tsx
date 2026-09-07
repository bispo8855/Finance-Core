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

  it('daily bloqueado (≥1 mês, Outros>20%) → toggle ausente e motivo visível; com gate → toggle presente', () => {
    const s = sum({ diaADia: { porMes: [{ monthISO: '2026-06', total: 300, parcial: false }], min: 250, normal: 300, heavy: 350, confidence: 'media', issues: [] }, gastosVariaveis: { total: 300, byCategory: [] } });
    const bloqueado: DailyCandidate = { hasCandidate: true, min: 250, normal: 300, heavy: 350, completeMonths: 1, outrosHigh: true, canConfirm: false, reason: '"Outros" passa de 20% dos gastos variáveis — o dia a dia ainda não é confiável.' };
    render(<Harness {...baseProps({ summary: s, daily: bloqueado })} />);
    expect(screen.queryByText(/representa bem meu gasto mensal/)).not.toBeInTheDocument();
    expect(screen.getByText(/"Outros" passa de 20%/)).toBeInTheDocument();

    const liberado: DailyCandidate = { ...bloqueado, completeMonths: 2, outrosHigh: false, canConfirm: true, reason: null };
    render(<Harness {...baseProps({ summary: s, daily: liberado })} />);
    expect(screen.getByText(/representa bem meu gasto mensal/)).toBeInTheDocument();
  });

  it('daily 0 meses completos → "observado" + período, sem leve/normal/pesado', () => {
    const s = sum({ period: { from: '2026-08-24', to: '2026-08-26', months: ['2026-08'], mesesParciais: ['2026-08'] }, gastosVariaveis: { total: 186.38, byCategory: [{ category: 'Mercado', total: 186.38, count: 3 }] }, diaADia: { porMes: [{ monthISO: '2026-08', total: 186.38, parcial: true }], min: 186.38, normal: 186.38, heavy: 186.38, confidence: 'baixa', issues: [] } });
    const d: DailyCandidate = { hasCandidate: true, min: 186.38, normal: 186.38, heavy: 186.38, completeMonths: 0, outrosHigh: false, canConfirm: false, reason: 'Faltam meses completos.' };
    render(<Harness {...baseProps({ summary: s, daily: d })} />);
    expect(screen.getByText(/Dia a dia observado/)).toBeInTheDocument();
    expect(screen.getByText(/Período observado: 24\/08\/2026 a 26\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Período insuficiente para estimar um mês típico/)).toBeInTheDocument();
    expect(screen.queryByText('Mês leve')).not.toBeInTheDocument();
    expect(screen.queryByText(/representa bem meu gasto mensal/)).not.toBeInTheDocument();
  });

  it('daily 1 mês completo → estimativa única + confiança baixa, sem três faixas', () => {
    const s = sum({ diaADia: { porMes: [{ monthISO: '2026-06', total: 300, parcial: false }], min: 250, normal: 300, heavy: 350, confidence: 'media', issues: [] }, gastosVariaveis: { total: 300, byCategory: [] } });
    const d: DailyCandidate = { hasCandidate: true, min: 250, normal: 300, heavy: 350, completeMonths: 1, outrosHigh: false, canConfirm: true, reason: null };
    render(<Harness {...baseProps({ summary: s, daily: d })} />);
    expect(screen.getByText(/Estimativa de dia a dia/)).toBeInTheDocument();
    expect(screen.getByText(/apenas 1 mês completo/)).toBeInTheDocument();
    expect(screen.queryByText('Mês leve')).not.toBeInTheDocument();
    expect(screen.getByText(/representa bem meu gasto mensal/)).toBeInTheDocument();
  });

  it('daily 2+ meses completos → três faixas leve/normal/pesado', () => {
    const s = sum({ diaADia: { porMes: [{ monthISO: '2026-06', total: 300, parcial: false }, { monthISO: '2026-07', total: 320, parcial: false }], min: 300, normal: 310, heavy: 320, confidence: 'media', issues: [] }, gastosVariaveis: { total: 620, byCategory: [] } });
    const d: DailyCandidate = { hasCandidate: true, min: 300, normal: 310, heavy: 320, completeMonths: 2, outrosHigh: false, canConfirm: true, reason: null };
    render(<Harness {...baseProps({ summary: s, daily: d })} />);
    expect(screen.getByText('Mês leve')).toBeInTheDocument();
    expect(screen.getByText('Mês normal')).toBeInTheDocument();
    expect(screen.getByText('Mês pesado')).toBeInTheDocument();
  });

  it('duvidosos: singular/plural correto', () => {
    const umaSaida = sum({ gastosVariaveis: { total: 1000, byCategory: [] }, duvidosos: [{ line: { sourceRow: 1, date: '2026-06-10', description: 'x', amount: 50, direction: 'saida' }, reason: 'r' }] });
    render(<Harness {...baseProps({ summary: umaSaida })} />);
    expect(screen.getByText(/^1 item ·/)).toBeInTheDocument();
    expect(screen.getByText(/0 entradas · 1 saída\./)).toBeInTheDocument();
  });

  it('preview mostra contagens, aviso de dedupe e onboarding incompleto', () => {
    render(<Harness {...baseProps({ preview: { saldo: true, rendas: 2, fixas: 4, daily: false, dedupe: 1, onboardingConfiavel: false, onboardingMissing: ['cartão/fatura'] } })} />);
    expect(screen.getByText('O Aurys vai aplicar:')).toBeInTheDocument();
    expect(screen.getByText(/2 renda/)).toBeInTheDocument();
    expect(screen.getByText(/4 conta\(s\) fixa/)).toBeInTheDocument();
    expect(screen.getByText(/já existem e não serão duplicados/)).toBeInTheDocument();
    expect(screen.getByText(/leitura completa ainda não será liberada/)).toBeInTheDocument();
  });

  it('onboarding incompleto com missing VAZIO → NÃO renderiza "Ainda faltará"', () => {
    render(<Harness {...baseProps({ preview: { saldo: false, rendas: 1, fixas: 0, daily: false, dedupe: 0, onboardingConfiavel: false, onboardingMissing: [] } })} />);
    expect(screen.queryByText(/Ainda faltará/)).not.toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it('onboarding incompleto com missing preenchido → renderiza itens reais', () => {
    render(<Harness {...baseProps({ preview: { saldo: false, rendas: 1, fixas: 0, daily: false, dedupe: 0, onboardingConfiavel: false, onboardingMissing: ['dia a dia', 'cartão/fatura'] } })} />);
    expect(screen.getByText(/Ainda faltará: dia a dia, cartão\/fatura\./)).toBeInTheDocument();
  });

  it('useBalance=false → sem bloqueio de AccountTarget; preview "nenhum saldo"', () => {
    render(<Harness {...baseProps({ summary: sum({ saldo: { valor: 500, fonte: 'movimento' } }), initial: st({ useBalance: false }), gate: { ok: true, reasons: [] }, preview: { saldo: false, rendas: 0, fixas: 0, daily: false, dedupe: 0, onboardingConfiavel: false, onboardingMissing: ['dia a dia'] } })} />);
    expect(screen.queryByText(/Escolha a conta para aplicar o saldo/)).not.toBeInTheDocument();
    expect(screen.getByText('nenhum saldo')).toBeInTheDocument();
  });

  it('useBalance=true + target válido → bloqueio de AccountTarget desaparece', () => {
    render(<Harness {...baseProps({ summary: sum({ saldo: { valor: 500, fonte: 'movimento' } }), initial: st({ useBalance: true, accountChoice: { mode: 'new', label: 'Nubank' } }), gate: { ok: true, reasons: [] } })} />);
    expect(screen.queryByText(/Escolha a conta para aplicar o saldo/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aplicar dados confirmados/ })).not.toBeDisabled();
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
