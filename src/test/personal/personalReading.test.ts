import { describe, it, expect } from 'vitest';
import { buildPersonalReading } from '@/domain/personal/personalReading';
import { buildPersonalMonth } from '@/domain/personal/personalMonth';
import { PersonalMonthResult } from '@/domain/personal/types';
import { F1 } from './fixtures';

// Result sintético mínimo — permite isolar cada regra sem depender do motor.
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

describe('buildPersonalReading — veredito de calendário', () => {
  it('com vale negativo, a PRIMEIRA frase é o veredito de calendário', () => {
    const r = makeResult({
      menorSaldo: { value: -500, date: '2026-07-18', valeStart: '2026-07-16', valeEnd: '2026-07-20', confidence: 'alta' },
    });
    const frases = buildPersonalReading(r);
    expect(frases[0]).toContain('presa no calendário');
    expect(frases[0]).toContain('os dias 16 e 20');
  });

  it('sem vale (menorSaldo >= 0) NÃO gera a frase de calendário', () => {
    const frases = buildPersonalReading(makeResult());
    expect(frases.some((f) => f.includes('presa no calendário'))).toBe(false);
  });

  it('vale que cruza a virada do mês usa dd/mm (não "26 e 1")', () => {
    const r = makeResult({
      menorSaldo: { value: -100, date: '2026-07-30', valeStart: '2026-07-26', valeEnd: '2026-08-01', confidence: 'alta' },
    });
    expect(buildPersonalReading(r)[0]).toContain('26/07 e 01/08');
  });

  it('vale de um único dia usa a forma "no dia X"', () => {
    const r = makeResult({
      menorSaldo: { value: -100, date: '2026-07-18', valeStart: '2026-07-18', valeEnd: '2026-07-18', confidence: 'alta' },
    });
    expect(buildPersonalReading(r)[0]).toContain('no dia 18');
  });
});

describe('buildPersonalReading — saldo × comprometido (guarda de honestidade)', () => {
  it('saldo POSITIVO usa o texto de "parte já comprometida"', () => {
    const frases = buildPersonalReading(makeResult({ saldoAtual: { value: 1000, confidence: 'alta' } }));
    expect(frases.some((f) => f.includes('já está comprometida'))).toBe(true);
  });

  it('saldo NEGATIVO com rotina positiva fala em buraco acumulado, nunca "parte comprometida"', () => {
    const frases = buildPersonalReading(makeResult({ saldoAtual: { value: -4284, confidence: 'alta' } }));
    expect(frases.some((f) => f.includes('buraco acumulado'))).toBe(true);
    expect(frases.some((f) => f.includes('já está comprometida'))).toBe(false);
    // usa a magnitude: nunca "negativo em -R$"
    expect(frases.some((f) => f.includes('-R$'))).toBe(false);
  });

  it('saldo negativo COM rotina negativa não afirma que a rotina fecha positiva', () => {
    const frases = buildPersonalReading(makeResult({
      saldoAtual: { value: -500, confidence: 'alta' },
      sobraEstrutural: { values: { conservador: -900, provavel: -700, otimista: -500 }, confidence: 'alta' },
    }));
    expect(frases.some((f) => f.includes('fecha positiva'))).toBe(false);
  });
});

describe('buildPersonalReading — estrutural × caixa', () => {
  it('divergência material com rotina positiva gera a frase', () => {
    const frases = buildPersonalReading(makeResult({
      sobraEstrutural: { values: { conservador: 5000, provavel: 6000, otimista: 7000 }, confidence: 'alta' },
      sobraCaixa: { values: { conservador: 900, provavel: 1000, otimista: 1200 }, confidence: 'alta' },
    }));
    expect(frases.some((f) => f.includes('cabe na renda'))).toBe(true);
  });

  it('divergência IMATERIAL (< 10%) não gera a frase', () => {
    const frases = buildPersonalReading(makeResult({
      sobraEstrutural: { values: { conservador: 1000, provavel: 1000, otimista: 1000 }, confidence: 'alta' },
      sobraCaixa: { values: { conservador: 980, provavel: 980, otimista: 980 }, confidence: 'alta' },
    }));
    expect(frases.some((f) => f.includes('cabe na renda'))).toBe(false);
  });

  it('rotina NEGATIVA nunca afirma que "cabe na renda"', () => {
    const frases = buildPersonalReading(makeResult({
      sobraEstrutural: { values: { conservador: -3000, provavel: -2000, otimista: -1000 }, confidence: 'alta' },
      sobraCaixa: { values: { conservador: -9000, provavel: -8000, otimista: -7000 }, confidence: 'alta' },
    }));
    expect(frases.some((f) => f.includes('cabe na renda'))).toBe(false);
  });
});

describe('buildPersonalReading — contrato geral', () => {
  it('no máximo 4 frases, mesmo com todas as regras aplicáveis', () => {
    const r = buildPersonalMonth(F1, '2026-07', '2026-07-26');
    const frases = buildPersonalReading(r);
    expect(frases.length).toBeGreaterThan(0);
    expect(frases.length).toBeLessThanOrEqual(4);
  });

  it('é determinístico', () => {
    const r = buildPersonalMonth(F1, '2026-07', '2026-07-26');
    expect(buildPersonalReading(r)).toEqual(buildPersonalReading(r));
  });

  it('NENHUMA frase contém "sobra real" (nome comercial, nunca rótulo de número)', () => {
    const casos = [
      buildPersonalReading(buildPersonalMonth(F1, '2026-07', '2026-07-26')),
      buildPersonalReading(makeResult()),
      buildPersonalReading(makeResult({ saldoAtual: { value: -100, confidence: 'baixa' } })),
    ];
    for (const frases of casos) {
      for (const f of frases) expect(f.toLowerCase()).not.toContain('sobra real');
    }
  });

  it('fora da rotina só aparece quando há evento pontual', () => {
    const semFora = buildPersonalReading(makeResult());
    expect(semFora.some((f) => f.includes('eventos pontuais'))).toBe(false);

    const comFora = buildPersonalReading(makeResult({
      foraDaRotina: {
        extraordinarios: [{ id: 'x', label: 'Restituição', amount: 1800, date: '2026-07-31', klass: 'extraordinario', destination: 'livre', confidence: 'media' }],
        patrimoniais: [], reembolsaveis: [],
      },
    }));
    expect(comFora.some((f) => f.includes('No horizonte analisado'))).toBe(true);
  });
});
