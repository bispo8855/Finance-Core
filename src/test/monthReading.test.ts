import { describe, it, expect } from 'vitest';
import { buildMonthReading } from '@/domain/finance/monthReading';
import { SemanticResult, ResultLine } from '@/domain/finance/semanticResult';
import { ResultLineKey } from '@/domain/finance/resultMapping';

function line(key: ResultLineKey, label: string, value: number, items: { label: string; amount: number }[] = []): ResultLine {
  return {
    key,
    label,
    value,
    items: items.map((it, i) => ({
      eventId: `e${i}`, date: '2026-06-10', label: it.label, amount: it.amount,
      semanticType: 'manual_expense', motivo: 'm',
    })),
  };
}

function makeResult(over: Partial<SemanticResult> = {}): SemanticResult {
  const base: SemanticResult = {
    receitaBruta: 0, estornosChargebacks: 0, taxasDeducoesVenda: 0, receitaLiquida: 0,
    custosVariaveis: 0, margemContribuicao: 0, despesasOperacionais: 0, resultadoOperacional: 0,
    resultadoFinanceiro: 0, outros: 0, resultadoFinanceiroOutros: 0, resultadoPeriodo: 0,
    linhas: [],
    foraDoResultado: [],
    meta: {
      basis: 'realized', periodo: '2026-06', confidenceThreshold: 0.5,
      totalAffectsCash: 0, totalAffectsResult: 0, label: '', microcopy: '',
    },
    ...over,
  };
  return base;
}

function fora(reason: string, amount: number) {
  return { reason, eventId: 'x' + Math.random(), date: '2026-06-01', label: reason, amount, semanticType: 'manual_expense', motivo: 'm' } as any;
}

describe('buildMonthReading', () => {
  it('mês vazio → nenhuma frase', () => {
    expect(buildMonthReading(makeResult(), null)).toHaveLength(0);
  });

  it('veredito azul com margem e proteção de valores', () => {
    const r = makeResult({
      receitaBruta: 1000, resultadoOperacional: 250, resultadoPeriodo: 200,
      linhas: [line('receitaBruta', 'Receita Bruta', 1000)],
    });
    const s = buildMonthReading(r, null);
    expect(s[0].id).toBe('veredito');
    expect(s[0].tone).toBe('positive');
    expect(s[0].text).toContain('azul');
    expect(s[0].text).toContain('25%');
  });

  it('veredito azul com receitaBruta=0 não divide por zero (variante sem %)', () => {
    const r = makeResult({
      receitaBruta: 0, resultadoPeriodo: 50, resultadoOperacional: 50,
      linhas: [line('outros', 'Outros', 50)],
    });
    const s = buildMonthReading(r, null);
    expect(s[0].id).toBe('veredito');
    expect(s[0].text).not.toContain('%');
    expect(s[0].text).toContain('azul');
  });

  it('veredito vermelho aponta a maior linha negativa', () => {
    const r = makeResult({
      receitaBruta: 1000, resultadoPeriodo: -300, resultadoOperacional: -300,
      linhas: [
        line('receitaBruta', 'Receita Bruta', 1000),
        line('custosVariaveis', 'Custos Variáveis', -400),
        line('despesasOperacionais', 'Despesas Operacionais', -900, [{ label: 'Aluguel', amount: -600 }]),
      ],
    });
    const s = buildMonthReading(r, null);
    expect(s[0].tone).toBe('attention');
    expect(s[0].text).toContain('vermelho');
    expect(s[0].text).toContain('Despesas Operacionais'); // maior linha negativa
  });

  it('veredito zero com movimento → neutral', () => {
    const r = makeResult({
      receitaBruta: 500, resultadoPeriodo: 0,
      linhas: [line('receitaBruta', 'Receita Bruta', 500), line('custosVariaveis', 'Custos Variáveis', -500)],
    });
    const s = buildMonthReading(r, null);
    expect(s[0].tone).toBe('neutral');
    expect(s[0].text).toContain('zero a zero');
  });

  it('consumidor de margem dispara acima de 15% e cita o maior item', () => {
    const r = makeResult({
      receitaBruta: 1000, resultadoPeriodo: 100, resultadoOperacional: 100,
      linhas: [
        line('receitaBruta', 'Receita Bruta', 1000),
        line('custosVariaveis', 'Custos Variáveis', -300, [{ label: 'Compra de Mercadorias', amount: -250 }, { label: 'Frete', amount: -50 }]),
      ],
    });
    const s = buildMonthReading(r, null);
    const c = s.find((x) => x.id === 'consumidor');
    expect(c).toBeDefined();
    expect(c!.text).toContain('30%');
    expect(c!.text).toContain('Compra de Mercadorias'); // maior item
  });

  it('consumidor de margem NÃO dispara abaixo de 15%', () => {
    const r = makeResult({
      receitaBruta: 1000, resultadoPeriodo: 800, resultadoOperacional: 800,
      linhas: [line('receitaBruta', 'Receita Bruta', 1000), line('custosVariaveis', 'Custos Variáveis', -100)],
    });
    const s = buildMonthReading(r, null);
    expect(s.some((x) => x.id === 'consumidor')).toBe(false);
  });

  it('caixa≠resultado dispara acima do limiar (10% da receita e > R$1)', () => {
    const r = makeResult({
      receitaBruta: 1000, resultadoPeriodo: 200,
      linhas: [line('receitaBruta', 'Receita Bruta', 1000)],
      meta: { basis: 'realized', periodo: '2026-06', confidenceThreshold: 0.5, totalAffectsCash: 1500, totalAffectsResult: 200, label: '', microcopy: '' },
    });
    const s = buildMonthReading(r, null);
    expect(s.some((x) => x.id === 'caixa')).toBe(true);
  });

  it('caixa≠resultado NÃO dispara abaixo do limiar', () => {
    const r = makeResult({
      receitaBruta: 100000, resultadoPeriodo: 200,
      linhas: [line('receitaBruta', 'Receita Bruta', 100000)],
      meta: { basis: 'realized', periodo: '2026-06', confidenceThreshold: 0.5, totalAffectsCash: 100, totalAffectsResult: 100.5, label: '', microcopy: '' },
    });
    const s = buildMonthReading(r, null);
    expect(s.some((x) => x.id === 'caixa')).toBe(false);
  });

  it('incerteza singular e plural', () => {
    const um = makeResult({
      receitaBruta: 500, resultadoPeriodo: 100, resultadoOperacional: 100,
      linhas: [line('receitaBruta', 'Receita Bruta', 500)],
      foraDoResultado: [fora('pending', -50)],
    });
    expect(buildMonthReading(um, null).find((x) => x.id === 'incerteza')!.text).toContain('1 movimentação');

    const varios = makeResult({
      receitaBruta: 500, resultadoPeriodo: 100, resultadoOperacional: 100,
      linhas: [line('receitaBruta', 'Receita Bruta', 500)],
      foraDoResultado: [fora('pending', -50), fora('unclassified', -30), fora('low_confidence', -20)],
    });
    expect(buildMonthReading(varios, null).find((x) => x.id === 'incerteza')!.text).toContain('3 movimentações');
  });

  it('positivo genuíno só quando b, c e e não disparam', () => {
    const limpo = makeResult({
      receitaBruta: 1000, resultadoPeriodo: 300, resultadoOperacional: 300,
      linhas: [line('receitaBruta', 'Receita Bruta', 1000), line('custosVariaveis', 'Custos Variáveis', -50)],
      // caixa alinhado ao resultado → sem gap
      meta: { basis: 'realized', periodo: '2026-06', confidenceThreshold: 0.5, totalAffectsCash: 300, totalAffectsResult: 300, label: '', microcopy: '' },
    });
    const s = buildMonthReading(limpo, null);
    expect(s.some((x) => x.id === 'positivo')).toBe(true);

    // Com incerteza, o positivo genuíno não aparece
    const comIncerteza = makeResult({
      receitaBruta: 1000, resultadoPeriodo: 300, resultadoOperacional: 300,
      linhas: [line('receitaBruta', 'Receita Bruta', 1000)],
      foraDoResultado: [fora('pending', -10)],
    });
    expect(buildMonthReading(comIncerteza, null).some((x) => x.id === 'positivo')).toBe(false);
  });

  it('sem previous não gera comparação', () => {
    const r = makeResult({ receitaBruta: 1000, resultadoPeriodo: 200, resultadoOperacional: 200, linhas: [line('receitaBruta', 'Receita Bruta', 1000)] });
    expect(buildMonthReading(r, null).some((x) => x.id === 'comparacao')).toBe(false);
  });

  it('as 4 combinações de comparação', () => {
    const mk = (rb: number, rp: number) => makeResult({
      receitaBruta: rb, resultadoPeriodo: rp, resultadoOperacional: rp,
      linhas: [line('receitaBruta', 'Receita Bruta', rb)],
    });
    const prev = makeResult({
      receitaBruta: 1000, resultadoPeriodo: 100, resultadoOperacional: 100,
      linhas: [line('receitaBruta', 'Receita Bruta', 1000)],
      meta: { basis: 'realized', periodo: '2026-05', confidenceThreshold: 0.5, totalAffectsCash: 0, totalAffectsResult: 0, label: '', microcopy: '' },
    });

    // receita↑ resultado↑
    let c = buildMonthReading(mk(1500, 200), prev).find((x) => x.id === 'comparacao')!;
    expect(c.tone).toBe('positive');
    expect(c.text).toContain('subiu 50%');
    // receita↑ resultado↓
    c = buildMonthReading(mk(1500, 50), prev).find((x) => x.id === 'comparacao')!;
    expect(c.tone).toBe('attention');
    expect(c.text).toContain('sem levar o lucro junto');
    // receita↓ resultado↑
    c = buildMonthReading(mk(500, 200), prev).find((x) => x.id === 'comparacao')!;
    expect(c.tone).toBe('positive');
    expect(c.text).toContain('enxuto');
    // receita↓ resultado↓
    c = buildMonthReading(mk(500, 20), prev).find((x) => x.id === 'comparacao')!;
    expect(c.tone).toBe('attention');
    expect(c.text).toContain('perdeu força');
  });

  it('mês corrente: veredito usa "até agora" e comparação vira acompanhamento neutro', () => {
    const prev = makeResult({
      receitaBruta: 1000, resultadoPeriodo: 200, resultadoOperacional: 200,
      linhas: [line('receitaBruta', 'Receita Bruta', 1000)],
      meta: { basis: 'realized', periodo: '2026-06', confidenceThreshold: 0.5, totalAffectsCash: 200, totalAffectsResult: 200, label: '', microcopy: '' },
    });
    const cur = makeResult({
      receitaBruta: 400, resultadoPeriodo: 80, resultadoOperacional: 80,
      linhas: [line('receitaBruta', 'Receita Bruta', 400)],
      meta: { basis: 'realized', periodo: '2026-07', confidenceThreshold: 0.5, totalAffectsCash: 80, totalAffectsResult: 80, label: '', microcopy: '' },
    });
    const s = buildMonthReading(cur, prev, true);
    expect(s[0].id).toBe('veredito');
    expect(s[0].text).toContain('até agora');
    const comp = s.find((x) => x.id === 'comparacao')!;
    expect(comp).toBeDefined();
    expect(comp.tone).toBe('neutral');
    expect(comp.text).toContain('ainda em andamento');
    expect(comp.text).not.toMatch(/perdeu força|cresceu|enxuto/);
  });

  it('mês fechado (isCurrentMonth=false) mantém veredito com "fechou"', () => {
    const r = makeResult({
      receitaBruta: 1000, resultadoPeriodo: 200, resultadoOperacional: 200,
      linhas: [line('receitaBruta', 'Receita Bruta', 1000)],
      meta: { basis: 'realized', periodo: '2026-06', confidenceThreshold: 0.5, totalAffectsCash: 200, totalAffectsResult: 200, label: '', microcopy: '' },
    });
    expect(buildMonthReading(r, null).find((x) => x.id === 'veredito')!.text).toContain('fechou no azul');
  });

  it('gap via cartão (fora do resultado) dispara caixa e impede "mês limpo" — julho/2026', () => {
    const r = makeResult({
      receitaBruta: 791.53, resultadoOperacional: 791.53, resultadoPeriodo: 791.53,
      linhas: [line('receitaBruta', 'Receita Bruta', 791.53, [{ label: 'Venda', amount: 791.53 }])],
      foraDoResultado: [fora('financial_movement', -409.24)],
      meta: { basis: 'realized', periodo: '2026-07', confidenceThreshold: 0.5, totalAffectsCash: 382.29, totalAffectsResult: 382.29, label: '', microcopy: '' },
    });
    const s = buildMonthReading(r, null);
    const caixa = s.find((x) => x.id === 'caixa');
    expect(caixa).toBeDefined();
    expect(caixa!.text).toContain('parte do ganho já saiu como cartão');
    expect(s.some((x) => x.id === 'positivo')).toBe(false);
  });

  it('limita a 4 frases e respeita a priorização (positivo é cortado)', () => {
    const prev = makeResult({
      receitaBruta: 1000, resultadoPeriodo: 100, resultadoOperacional: 100,
      linhas: [line('receitaBruta', 'Receita Bruta', 1000)],
      meta: { basis: 'realized', periodo: '2026-05', confidenceThreshold: 0.5, totalAffectsCash: 0, totalAffectsResult: 0, label: '', microcopy: '' },
    });
    const r = makeResult({
      receitaBruta: 2000, resultadoPeriodo: 300, resultadoOperacional: 300,
      linhas: [
        line('receitaBruta', 'Receita Bruta', 2000),
        line('custosVariaveis', 'Custos Variáveis', -800, [{ label: 'Mercadorias', amount: -800 }]), // consumidor (40%)
      ],
      foraDoResultado: [fora('pending', -100)], // incerteza
      meta: { basis: 'realized', periodo: '2026-06', confidenceThreshold: 0.5, totalAffectsCash: 3000, totalAffectsResult: 300, label: '', microcopy: '' }, // caixa
    });
    const s = buildMonthReading(r, prev);
    expect(s).toHaveLength(4);
    const ids = s.map((x) => x.id);
    expect(ids).toEqual(['veredito', 'incerteza', 'consumidor', 'caixa']);
    // comparação e positivo ficaram de fora pelo corte de 4
    expect(ids).not.toContain('comparacao');
    expect(ids).not.toContain('positivo');
  });
});
