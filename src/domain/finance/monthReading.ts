import { SemanticResult } from './semanticResult';

// Leitura do Mês — resumo analítico determinístico (sem IA) em tom de consultor.
// Regras: número + interpretação + implicação; nunca culpa o usuário; nunca recomenda
// ação específica (isso é do futuro Plano de Ação).

export type MonthReadingTone = 'positive' | 'attention' | 'neutral';

export interface MonthReadingSentence {
  id: string;
  tone: MonthReadingTone;
  text: string;
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const pctInt = (part: number, base: number) => Math.round((part / base) * 100);

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function monthName(periodo: string, capitalize = false): string {
  const parts = (periodo || '').split('-');
  const idx = Number(parts[1]) - 1;
  const name = MESES[idx] ?? periodo;
  return capitalize ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

const REVIEW_REASONS = ['pending', 'unclassified', 'categoria_nao_resolvida', 'low_confidence'];

export function buildMonthReading(
  current: SemanticResult,
  previous: SemanticResult | null,
  isCurrentMonth = false
): MonthReadingSentence[] {
  // Mês sem movimento → nenhuma frase (o card não é renderizado)
  const hasActivity = current.linhas.some((l) => l.value !== 0) || current.foraDoResultado.length > 0;
  if (!hasActivity) return [];

  const rb = current.receitaBruta;
  const mes = monthName(current.meta.periodo, true);

  const sentences: MonthReadingSentence[] = [];

  // Maior linha negativa (para veredito vermelho e consumidor de margem)
  const negativas = current.linhas.filter((l) => l.value < 0);
  const maiorNeg = negativas.length
    ? negativas.reduce((a, b) => (b.value < a.value ? b : a))
    : null;

  // --- (a) VEREDITO — sempre a 1ª frase ---
  // Mês em andamento não "fecha": está no azul/vermelho até agora.
  const azul = isCurrentMonth ? 'está no azul até agora' : 'fechou no azul';
  const vermelho = isCurrentMonth ? 'está no vermelho até agora' : 'fechou no vermelho';
  if (current.resultadoPeriodo > 0) {
    if (rb > 0) {
      const margem = pctInt(current.resultadoOperacional, rb);
      sentences.push({
        id: 'veredito',
        tone: 'positive',
        text: `${mes} ${azul}: sobrou ${brl(current.resultadoPeriodo)} de cada ${brl(rb)} vendidos — margem operacional de ${margem}%.`,
      });
    } else {
      sentences.push({
        id: 'veredito',
        tone: 'positive',
        text: `${mes} ${azul}, com sobra de ${brl(current.resultadoPeriodo)} no período.`,
      });
    }
  } else if (current.resultadoPeriodo < 0) {
    const culpado = maiorNeg ? maiorNeg.label : 'as saídas do período';
    sentences.push({
      id: 'veredito',
      tone: 'attention',
      text: `${mes} ${vermelho} em ${brl(Math.abs(current.resultadoPeriodo))}. O principal responsável foi ${culpado} — vale atenção antes que se repita.`,
    });
  } else {
    sentences.push({
      id: 'veredito',
      tone: 'neutral',
      text: rb > 0
        ? `${mes} movimentou ${brl(rb)} em vendas e fechou no zero a zero — sem sobra nem perda no período.`
        : `${mes} teve movimento, mas fechou no zero a zero — sem sobra nem perda no período.`,
    });
  }

  // --- (e) INCERTEZA ---
  const revisao = current.foraDoResultado.filter((f) => REVIEW_REASONS.includes(f.reason));
  let incerteza: MonthReadingSentence | null = null;
  if (revisao.length > 0) {
    const n = revisao.length;
    const soma = revisao.reduce((s, i) => s + Math.abs(i.amount), 0);
    incerteza = {
      id: 'incerteza',
      tone: 'attention',
      text: n === 1
        ? `Há 1 movimentação sem classificação somando ${brl(soma)}. Até você revisá-la, este resultado pode mudar — classifique para ter o número real.`
        : `Há ${n} movimentações sem classificação somando ${brl(soma)}. Até você revisá-las, este resultado pode mudar — classifique para ter o número real.`,
    };
  }

  // --- (b) MAIOR CONSUMIDOR DE MARGEM ---
  let consumidor: MonthReadingSentence | null = null;
  if (maiorNeg && rb > 0 && Math.abs(maiorNeg.value) > 0.15 * rb) {
    const pct = pctInt(Math.abs(maiorNeg.value), rb);
    const topItem = [...maiorNeg.items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];
    const itemStr = topItem
      ? ` O maior item foi ${topItem.label}, de ${brl(Math.abs(topItem.amount))}.`
      : '';
    consumidor = {
      id: 'consumidor',
      tone: 'attention',
      text: `${maiorNeg.label} consumiu ${pct}% da sua receita — ${brl(Math.abs(maiorNeg.value))} que saíram antes de você ver o dinheiro.${itemStr}`,
    };
  }

  // --- (c) CAIXA ≠ RESULTADO ---
  // Compara o caixa com o RESULTADO do período (não com totalAffectsResult): itens como
  // cartão entram nos dois totais de "affectsResult" e mascarariam a divergência.
  let caixa: MonthReadingSentence | null = null;
  const cash = current.meta.totalAffectsCash;
  const resultado = current.resultadoPeriodo;
  const gap = Math.abs(cash - resultado);
  if (gap > 0.1 * Math.abs(rb) && gap > 1) {
    caixa = {
      id: 'caixa',
      tone: 'attention',
      text: cash < resultado
        ? `O resultado foi ${brl(resultado)}, mas o caixa do período ficou em ${brl(cash)} — parte do ganho já saiu como cartão, transferências ou reservas.`
        : `Cuidado com a sensação de caixa: entraram ${brl(cash)} na conta, mas só ${brl(resultado)} são resultado seu — o resto é reserva, transferência ou dinheiro já comprometido.`,
    };
  }

  // --- (d) COMPARAÇÃO ---
  let comparacao: MonthReadingSentence | null = null;
  if (previous && previous.receitaBruta > 0) {
    const prevName = monthName(previous.meta.periodo);
    if (isCurrentMonth) {
      // Mês em andamento: acompanhamento neutro, sem concluir tendência.
      comparacao = {
        id: 'comparacao',
        tone: 'neutral',
        text: `Com ${mes} ainda em andamento, a receita está em ${brl(current.receitaBruta)} — ${prevName} fechou em ${brl(previous.receitaBruta)}.`,
      };
    } else {
    const rPct = pctInt(current.receitaBruta - previous.receitaBruta, previous.receitaBruta);
    const resComputable = previous.resultadoPeriodo !== 0;
    const resPct = resComputable
      ? pctInt(current.resultadoPeriodo - previous.resultadoPeriodo, Math.abs(previous.resultadoPeriodo))
      : null;
    const receitaUp = current.receitaBruta >= previous.receitaBruta;
    const resultadoUp = current.resultadoPeriodo >= previous.resultadoPeriodo;

    const relevante = Math.abs(rPct) > 10 || (resPct !== null && Math.abs(resPct) > 10);
    if (relevante) {
      const resStr = resPct !== null ? `${Math.abs(resPct)}%` : null;
      let text: string;
      if (receitaUp && resultadoUp) {
        text = `Sua receita subiu ${rPct}% sobre ${prevName}` +
          (resStr ? ` e o resultado veio junto, ${resStr} maior.` : ` e o resultado também melhorou.`);
      } else if (receitaUp && !resultadoUp) {
        text = `A receita cresceu ${rPct}% sobre ${prevName}, mas o resultado ${resStr ? `caiu ${resStr}` : 'recuou'} — as vendas subiram sem levar o lucro junto.`;
      } else if (!receitaUp && resultadoUp) {
        text = `Mesmo com a receita ${Math.abs(rPct)}% menor que ${prevName}, o resultado ${resStr ? `melhorou ${resStr}` : 'melhorou'} — mês mais enxuto.`;
      } else {
        text = `Receita ${Math.abs(rPct)}% abaixo de ${prevName} e resultado ${resStr ? `${resStr} menor` : 'menor'} — o mês perdeu força nas duas pontas.`;
      }
      comparacao = { id: 'comparacao', tone: resultadoUp ? 'positive' : 'attention', text };
    }
    }
  }

  // --- (f) POSITIVO GENUÍNO (só se b, c, e não dispararam e resultado > 0) ---
  let positivo: MonthReadingSentence | null = null;
  if (!consumidor && !caixa && !incerteza && current.resultadoPeriodo > 0) {
    const margem = rb > 0 ? pctInt(current.resultadoOperacional, rb) : null;
    positivo = {
      id: 'positivo',
      tone: 'positive',
      text: margem !== null
        ? `Mês limpo: tudo classificado, margem de ${margem}% e nenhuma surpresa entre caixa e resultado.`
        : `Mês limpo: tudo classificado e nenhuma surpresa entre caixa e resultado.`,
    };
  }

  // Prioridade: veredito > incerteza > consumidor > caixa > comparação > positivo
  if (incerteza) sentences.push(incerteza);
  if (consumidor) sentences.push(consumidor);
  if (caixa) sentences.push(caixa);
  if (comparacao) sentences.push(comparacao);
  if (positivo) sentences.push(positivo);

  return sentences.slice(0, 4);
}
