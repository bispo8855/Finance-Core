import { describe, it, expect } from 'vitest';
import { buildPersonalAlerts } from '@/domain/personal/personalAlerts';
import { buildPersonalMonth } from '@/domain/personal/personalMonth';
import { PersonalMonthResult, Reimbursement, ExtraordinaryEvent } from '@/domain/personal/types';
import { F1 } from './fixtures';

function makeResult(over: Partial<PersonalMonthResult> = {}): PersonalMonthResult {
  return {
    saldoAtual: { value: 1000, confidence: 'alta' },
    sobraEstrutural: { values: { conservador: 500, provavel: 800, otimista: 1000 }, confidence: 'alta' },
    sobraCaixa: { values: { conservador: 400, provavel: 700, otimista: 900 }, confidence: 'alta' },
    saldoProjetado: { values: { conservador: 900, provavel: 1200, otimista: 1500 }, range: [900, 1500], confidence: 'alta' },
    menorSaldo: { value: 200, date: '2026-07-30', confidence: 'alta' },
    reserva: { custoEssencialMensal: 0, piso: 0, conforto: 0, atual: 0, aporteSugeridoMes: 0 },
    disponivelPrudente: { value: 0, confidence: 'alta', deducoes: [] },
    trajetoria: [],
    foraDaRotina: { extraordinarios: [], patrimoniais: [], reembolsaveis: [] },
    jaOcorreuNoMes: [],
    meta: { monthISO: '2026-07', asOfDate: '2026-07-26', isCurrentMonth: true, horizonMonths: 3 },
    ...over,
  };
}

const reemb = (over: Partial<Reimbursement> = {}): Reimbursement => ({
  id: 'r1', who: 'Terceiro', amount: 1000, expectedDate: '2026-08-06', status: 'previsto', confidence: 'media', ...over,
});
const patr = (over: Partial<ExtraordinaryEvent> = {}): ExtraordinaryEvent => ({
  id: 'x1', label: 'Venda', amount: 50000, date: '2026-08-05', klass: 'patrimonial', destination: 'intocavel', confidence: 'media', ...over,
});

describe('buildPersonalAlerts — disparo de cada regra', () => {
  it('descasamento dispara com menorSaldo < 0, em tom âmbar', () => {
    const a = buildPersonalAlerts(makeResult({
      menorSaldo: { value: -500, date: '2026-07-18', valeStart: '2026-07-16', valeEnd: '2026-07-20', confidence: 'alta' },
    }));
    const d = a.find((x) => x.id === 'descasamento')!;
    expect(d).toBeDefined();
    expect(d.tone).toBe('amber');
    expect(d.message).toContain('os dias 16 e 20');
    expect(d.message).not.toContain('-R$'); // magnitude, não duplo negativo
  });

  it('descasamento NÃO dispara com menorSaldo >= 0', () => {
    expect(buildPersonalAlerts(makeResult()).some((x) => x.id === 'descasamento')).toBe(false);
  });

  it('reembolso não recebido dispara, em tom âmbar', () => {
    const a = buildPersonalAlerts(makeResult({
      foraDaRotina: { extraordinarios: [], patrimoniais: [], reembolsaveis: [reemb(), reemb({ id: 'r2', amount: 500 })] },
    }));
    const r = a.find((x) => x.id === 'reembolso_risco')!;
    expect(r.tone).toBe('amber');
    expect(r.message).toContain('2 reembolsos');
  });

  it('reembolso JÁ RECEBIDO não dispara', () => {
    const a = buildPersonalAlerts(makeResult({
      foraDaRotina: { extraordinarios: [], patrimoniais: [], reembolsaveis: [reemb({ status: 'recebido' })] },
    }));
    expect(a.some((x) => x.id === 'reembolso_risco')).toBe(false);
  });

  it('confiança baixa dispara (info) por saldoProjetado OU disponivelPrudente', () => {
    const porProjetado = buildPersonalAlerts(makeResult({
      saldoProjetado: { values: { conservador: 1, provavel: 1, otimista: 1 }, range: [1, 1], confidence: 'baixa' },
    }));
    expect(porProjetado.find((x) => x.id === 'confianca_baixa')?.tone).toBe('info');

    const porDisponivel = buildPersonalAlerts(makeResult({
      disponivelPrudente: { value: 0, confidence: 'baixa', deducoes: [] },
    }));
    expect(porDisponivel.some((x) => x.id === 'confianca_baixa')).toBe(true);
  });

  it('fora da rotina dispara (info) quando há patrimonial/extraordinário', () => {
    const a = buildPersonalAlerts(makeResult({
      foraDaRotina: { extraordinarios: [], patrimoniais: [patr()], reembolsaveis: [] },
    }));
    expect(a.find((x) => x.id === 'fora_da_rotina')?.tone).toBe('info');
  });
});

describe('buildPersonalAlerts — contrato', () => {
  it('no máximo 3 alertas, mesmo com as 4 regras aplicáveis', () => {
    const a = buildPersonalAlerts(makeResult({
      menorSaldo: { value: -500, date: '2026-07-18', valeStart: '2026-07-16', valeEnd: '2026-07-20', confidence: 'alta' },
      saldoProjetado: { values: { conservador: 1, provavel: 1, otimista: 1 }, range: [1, 1], confidence: 'baixa' },
      foraDaRotina: { extraordinarios: [], patrimoniais: [patr()], reembolsaveis: [reemb()] },
    }));
    expect(a).toHaveLength(3);
  });

  it('respeita a ordem de prioridade: descasamento > reembolso > confiança > fora da rotina', () => {
    const a = buildPersonalAlerts(makeResult({
      menorSaldo: { value: -500, date: '2026-07-18', valeStart: '2026-07-16', valeEnd: '2026-07-20', confidence: 'alta' },
      saldoProjetado: { values: { conservador: 1, provavel: 1, otimista: 1 }, range: [1, 1], confidence: 'baixa' },
      foraDaRotina: { extraordinarios: [], patrimoniais: [patr()], reembolsaveis: [reemb()] },
    }));
    expect(a.map((x) => x.id)).toEqual(['descasamento', 'reembolso_risco', 'confianca_baixa']);
    // o de menor prioridade é o que cai fora do teto de 3
    expect(a.some((x) => x.id === 'fora_da_rotina')).toBe(false);
  });

  it('NENHUM alerta de "fatura pesada" existe na V1 (cortado por falta de rendaDoMes)', () => {
    const casos = [
      buildPersonalAlerts(buildPersonalMonth(F1, '2026-07', '2026-07-26')),
      buildPersonalAlerts(makeResult()),
    ];
    for (const a of casos) {
      expect(a.some((x) => x.id === 'fatura_pesada')).toBe(false);
      for (const x of a) expect(x.message.toLowerCase()).not.toContain('fatura pesada');
    }
  });

  it('é determinístico', () => {
    const r = buildPersonalMonth(F1, '2026-07', '2026-07-26');
    expect(buildPersonalAlerts(r)).toEqual(buildPersonalAlerts(r));
  });

  it('sem nada de anormal, nenhum alerta é emitido', () => {
    expect(buildPersonalAlerts(makeResult())).toHaveLength(0);
  });
});
