// ============================================================================
// Aurys Personal — ocorrências datadas + trajetória diária de caixa.
// R10: compromisso pago NO CARTÃO não é saída direta — compõe a card_bill.
// R9: a trajetória começa em asOfDate; o passado já está no saldoAtual.
// ============================================================================

import {
  PersonalInputs, Scenario, SpendProfile, DayPoint, DayEvent, Confidence,
  DailySpendingEstimate,
} from './types';
import {
  ymd, monthOf, dayOf, daysInMonth, addMonthsISO, addDaysISO, inWindow,
  endOfMonthISO, startOfMonthISO,
} from './cardCycles';

// Divisão cartão/fora-do-cartão do dia a dia por perfil declarado (decisão fechada §357).
export function paymentSplit(profile: SpendProfile): { pctCartao: number; pctFora: number } {
  switch (profile) {
    case 'maioria_cartao': return { pctCartao: 0.8, pctFora: 0.2 };
    case 'meio_a_meio':    return { pctCartao: 0.5, pctFora: 0.5 };
    case 'maioria_pix':    return { pctCartao: 0.2, pctFora: 0.8 };
    case 'desconhecido':   return { pctCartao: 0.5, pctFora: 0.5 }; // 50/50 com confiança baixa (na fixture)
  }
}

export function dailyForCenario(min: number, normal: number, heavy: number, cenario: Scenario): number {
  return cenario === 'otimista' ? min : cenario === 'conservador' ? heavy : normal;
}

function downgrade(c: Confidence): Confidence {
  return c === 'alta' ? 'media' : 'baixa';
}

/**
 * A2 — dia a dia do mês, resolvido: nunca vira ZERO silencioso num mês futuro.
 * Se o mês não tem estimativa própria, herda a última estimativa CONHECIDA (o mês
 * anterior mais recente; na falta, a mais antiga) e REBAIXA a confiança um nível —
 * a projeção de 3 meses não pode ficar otimista por ausência de dado futuro.
 * Só devolve null quando não há NENHUMA estimativa (aí não há o que herdar).
 */
export function resolveDaily(inputs: PersonalInputs, monthISO: string): DailySpendingEstimate | null {
  const list = inputs.dailySpending;
  if (list.length === 0) return null;
  const exact = list.find((d) => d.monthISO === monthISO);
  if (exact) return exact;
  const prior = list.filter((d) => d.monthISO < monthISO).sort((a, b) => (a.monthISO < b.monthISO ? 1 : -1))[0];
  const src = prior ?? list.slice().sort((a, b) => (a.monthISO < b.monthISO ? -1 : 1))[0];
  return { ...src, monthISO, confidence: downgrade(src.confidence) }; // herdado → confiança rebaixada
}

// --------------------------------------------------------------------------
// Ocorrências datadas (eventos de CAIXA). Dia a dia é diluído à parte (trajetória).
// --------------------------------------------------------------------------

export interface Occurrence {
  date: string;
  label: string;
  amount: number; // assinado
  kind: DayEvent['kind'];
  confidence: Confidence;
}

const CASH_METHODS = new Set(['debito', 'boleto', 'pix']);

/** Um compromisso fixo sai DIRETO do caixa? (R10: cartão não sai — vai pra fatura) */
export function fixedHitsCash(payMethod: string, cardId?: string): boolean {
  return !cardId && CASH_METHODS.has(payMethod);
}
/** Uma parcela sai DIRETO do caixa? (R10: com cartão, não — compõe a fatura) */
export function installmentHitsCash(cardId?: string, payMethod?: string): boolean {
  return !cardId && !!payMethod && CASH_METHODS.has(payMethod);
}

/**
 * Todas as ocorrências de caixa entre fromMonthISO e toMonthISO (inclusive).
 * NÃO inclui o dia a dia (diluído na trajetória) nem itens pagos no cartão
 * (eles já estão embutidos nas card_bills — anti-dupla-contagem R10).
 */
export function buildOccurrences(
  inputs: PersonalInputs,
  fromMonthISO: string,
  toMonthISO: string,
): Occurrence[] {
  const occ: Occurrence[] = [];
  const months: string[] = [];
  for (let m = fromMonthISO; m <= toMonthISO; m = addMonthsISO(m, 1)) months.push(m);

  for (const monthISO of months) {
    // Rendas
    for (const inc of inputs.incomeSources) {
      const date = inc.specificDate ?? ymd(monthISO, inc.dayOfMonth);
      if (inc.frequency === 'avulsa' && monthOf(date) !== monthISO) continue;
      if (monthOf(date) !== monthISO) continue;
      const kind = inc.nature === 'rotina' ? 'renda'
        : inc.nature === 'patrimonial' ? 'patrimonial' : 'extraordinario';
      occ.push({ date, label: inc.label, amount: Math.abs(inc.amount), kind, confidence: inc.confidence });
    }

    // Fixas — só as pagas por débito/boleto/pix saem direto (R10)
    for (const f of inputs.fixedCommitments) {
      if (f.activeUntil && monthISO > monthOf(f.activeUntil)) continue;
      if (!fixedHitsCash(f.payMethod, f.cardId)) continue;
      occ.push({
        date: ymd(monthISO, f.dayOfMonth), label: f.label, amount: -Math.abs(f.amount),
        kind: 'fixa', confidence: f.confidence,
      });
    }

    // Parcelas — só as fora do cartão saem direto (R10). Sem dia próprio → dia 1 (conservador).
    for (const p of inputs.installments) {
      if (monthISO < p.startMonth || monthISO > p.endMonth) continue;
      if (!installmentHitsCash(p.cardId, p.payMethod)) continue;
      occ.push({
        date: startOfMonthISO(monthISO), label: p.groupLabel, amount: -Math.abs(p.monthlyAmount),
        kind: 'parcela', confidence: p.confidence,
      });
    }
  }

  // Faturas de cartão — evento de caixa único no vencimento (R1/R2). Explícitas nos inputs.
  for (const b of inputs.cardBills) {
    if (monthOf(b.dueDate) < fromMonthISO || monthOf(b.dueDate) > toMonthISO) continue;
    occ.push({ date: b.dueDate, label: `Fatura ${b.cardId}`, amount: -Math.abs(b.amount), kind: 'fatura', confidence: b.confidence });
  }

  // Reembolsos previstos (entram no caixa na data prevista; recebido já está no saldo)
  for (const r of inputs.reimbursements) {
    if (r.status === 'recebido') continue;
    if (monthOf(r.expectedDate) < fromMonthISO || monthOf(r.expectedDate) > toMonthISO) continue;
    occ.push({ date: r.expectedDate, label: `Reembolso ${r.who}`, amount: Math.abs(r.amount), kind: 'reembolso', confidence: r.confidence });
  }

  // Extraordinários/patrimoniais datados (o dinheiro existe → entram na trajetória, marcados)
  for (const e of inputs.extraordinaryEvents) {
    if (monthOf(e.date) < fromMonthISO || monthOf(e.date) > toMonthISO) continue;
    occ.push({ date: e.date, label: e.label, amount: e.amount, kind: e.klass, confidence: e.confidence });
  }

  return occ.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// --------------------------------------------------------------------------
// Trajetória diária de caixa (por cenário)
// --------------------------------------------------------------------------

export interface TrajectoryResult {
  points: DayPoint[];
}

/**
 * Simula o saldo dia a dia de asOfDate até horizonEndISO.
 * Começa em saldoAtual (que já incorpora o passado — R9) e aplica só ocorrências
 * com data >= asOfDate + o dia a dia FORA do cartão diluído por dia.
 */
export function buildTrajectory(
  inputs: PersonalInputs,
  occurrences: Occurrence[],
  asOfDate: string,
  horizonEndISO: string,
  saldoAtual: number,
  cenario: Scenario,
): TrajectoryResult {
  // Índice de ocorrências futuras por dia
  const byDay = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    if (o.date < asOfDate) continue;
    const arr = byDay.get(o.date) || [];
    arr.push(o);
    byDay.set(o.date, arr);
  }

  // Dia a dia FORA do cartão por dia, por mês. A2: cada mês do horizonte é RESOLVIDO
  // (herda a última estimativa se faltar) — nunca zero silencioso num mês futuro.
  const dailyForaByMonth = new Map<string, number>();
  const foraPerDay = (monthISO: string): number => {
    const cached = dailyForaByMonth.get(monthISO);
    if (cached !== undefined) return cached;
    const ds = resolveDaily(inputs, monthISO);
    const perDay = ds
      ? (dailyForCenario(ds.min, ds.normal, ds.heavy, cenario) * paymentSplit(ds.profile).pctFora) / daysInMonth(monthISO)
      : 0;
    dailyForaByMonth.set(monthISO, perDay);
    return perDay;
  };

  const points: DayPoint[] = [];
  let balance = saldoAtual;
  for (let d = asOfDate; d <= horizonEndISO; d = addDaysISO(d, 1)) {
    const events: DayEvent[] = [];
    for (const o of byDay.get(d) || []) {
      balance += o.amount;
      events.push({ label: o.label, amount: o.amount, kind: o.kind });
    }
    const perDay = foraPerDay(monthOf(d));
    if (perDay > 0) {
      balance -= perDay;
      events.push({ label: 'Dia a dia (fora do cartão)', amount: -perDay, kind: 'diario' });
    }
    points.push({ date: d, balance, events });
  }
  return { points };
}

/**
 * Menor saldo de asOfDate até a próxima entrada de RENDA relevante (rotina).
 * Registra o intervalo (vale) contíguo abaixo de zero que contém o mínimo.
 */
export function computeMenorSaldo(
  points: DayPoint[],
  inputs: PersonalInputs,
  asOfDate: string,
  horizonEndISO: string,
): { value: number; date: string; valeStart?: string; valeEnd?: string } {
  // RR2 — "renda relevante" que corta o vale = qualquer income com nature='rotina',
  // seja mensal ou avulsa datada (specificDate). Extraordinário/patrimonial NÃO corta o vale
  // (não é renda de rotina com que se possa contar para atravessar o descasamento).
  let nextIncome = horizonEndISO;
  for (const inc of inputs.incomeSources) {
    if (inc.nature !== 'rotina') continue;
    // procura a primeira ocorrência mensal >= asOfDate dentro do horizonte
    for (let m = monthOf(asOfDate); m <= monthOf(horizonEndISO); m = addMonthsISO(m, 1)) {
      const date = inc.specificDate ?? ymd(m, inc.dayOfMonth);
      if (date >= asOfDate && date <= horizonEndISO) {
        if (date < nextIncome) nextIncome = date;
        break;
      }
    }
  }

  const windowPts = points.filter((p) => inWindow(p.date, asOfDate, nextIncome));
  const scope = windowPts.length > 0 ? windowPts : points;

  let min = scope[0]?.balance ?? 0;
  let minDate = scope[0]?.date ?? asOfDate;
  for (const p of scope) {
    if (p.balance < min) { min = p.balance; minDate = p.date; }
  }

  // Vale = intervalo contíguo com saldo < 0 que contém o mínimo
  let valeStart: string | undefined;
  let valeEnd: string | undefined;
  if (min < 0) {
    const idx = scope.findIndex((p) => p.date === minDate);
    let i = idx;
    while (i > 0 && scope[i - 1].balance < 0) i--;
    valeStart = scope[i].date;
    let j = idx;
    while (j < scope.length - 1 && scope[j + 1].balance < 0) j++;
    valeEnd = scope[j].date;
  }

  return { value: min, date: minDate, valeStart, valeEnd };
}

// Re-export utilitários usados pelos módulos de número
export { endOfMonthISO, startOfMonthISO, monthOf, dayOf, daysInMonth, addMonthsISO, inWindow, ymd };
