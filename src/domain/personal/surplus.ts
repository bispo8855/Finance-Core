// ============================================================================
// Aurys Personal — sobra estrutural (competência) e sobra de caixa (futuro).
// R1: NUNCA somar consumo do mês (estrutural) com fatura do mês (caixa).
// R9: no mês corrente, a sobra de caixa olha só datas >= hoje; a estrutural, o mês inteiro.
// ============================================================================

import { PersonalInputs, Scenario, ScenarioTriple, Confidence } from './types';
import { worst } from './confidence';
import {
  ymd, monthOf, dayOf, daysInMonth, endOfMonthISO, startOfMonthISO, inWindow,
  billsDueInWindow,
} from './cardCycles';
import { paymentSplit, dailyForCenario, fixedHitsCash, resolveDaily } from './calendar';

const CENARIOS: Scenario[] = ['conservador', 'provavel', 'otimista'];

function incomeOccursInMonth(inc: PersonalInputs['incomeSources'][number], monthISO: string): boolean {
  if (inc.specificDate) return monthOf(inc.specificDate) === monthISO;
  return inc.frequency === 'mensal'; // mensal sempre ocorre no mês
}
function fixedActiveInMonth(f: PersonalInputs['fixedCommitments'][number], monthISO: string): boolean {
  return !f.activeUntil || monthISO <= monthOf(f.activeUntil);
}
function installmentActiveInMonth(p: PersonalInputs['installments'][number], monthISO: string): boolean {
  return monthISO >= p.startMonth && monthISO <= p.endMonth;
}

function dailyOf(inputs: PersonalInputs, monthISO: string, cenario: Scenario): number {
  const ds = resolveDaily(inputs, monthISO); // A2: herda se faltar; nunca zero silencioso
  if (!ds) return 0;
  return dailyForCenario(ds.min, ds.normal, ds.heavy, cenario);
}

// --------------------------------------------------------------------------
// Sobra estrutural (nº 2) — mês INTEIRO, sempre (é competência).
// --------------------------------------------------------------------------
export function structuralSurplus(inputs: PersonalInputs, monthISO: string): {
  values: ScenarioTriple; confidence: Confidence;
} {
  const incomes = inputs.incomeSources.filter((i) => i.nature === 'rotina' && incomeOccursInMonth(i, monthISO));
  const fixed = inputs.fixedCommitments.filter((f) => fixedActiveInMonth(f, monthISO));
  const installs = inputs.installments.filter((p) => installmentActiveInMonth(p, monthISO) && !p.reimbursable);
  const ds = resolveDaily(inputs, monthISO); // A2

  const sumIncome = incomes.reduce((s, i) => s + Math.abs(i.amount), 0);
  const sumFixed = fixed.reduce((s, f) => s + Math.abs(f.amount), 0);       // competência: TODAS as fixas
  const sumInstall = installs.reduce((s, p) => s + Math.abs(p.monthlyAmount), 0);

  const compute = (cenario: Scenario) => sumIncome - sumFixed - sumInstall - dailyOf(inputs, monthISO, cenario);

  const values: ScenarioTriple = {
    conservador: compute('conservador'),
    provavel: compute('provavel'),
    otimista: compute('otimista'),
  };
  const confidence = worst(
    ...incomes.map((i) => i.confidence),
    ...fixed.map((f) => f.confidence),
    ...installs.map((p) => p.confidence),
    ds?.confidence,
  );
  return { values, confidence };
}

// --------------------------------------------------------------------------
// Sobra de caixa (nº 3) — janela = mês corrente ? [hoje..fim] : [1º..fim].
// --------------------------------------------------------------------------
export function cashSurplus(
  inputs: PersonalInputs,
  monthISO: string,
  asOfDate: string,
  isCurrentMonth: boolean,
): { values: ScenarioTriple; confidence: Confidence } {
  const winStart = isCurrentMonth ? asOfDate : startOfMonthISO(monthISO);
  const winEnd = endOfMonthISO(monthISO);
  const diasDoMes = daysInMonth(monthISO);
  const diasRestantes = isCurrentMonth ? diasDoMes - dayOf(asOfDate) + 1 : diasDoMes;

  // Entradas na janela: rotina + extraordinários + reembolsos previstos (R5: reembolso entra na data)
  const incomesWin = inputs.incomeSources.filter((i) => {
    const date = i.specificDate ?? ymd(monthISO, i.dayOfMonth);
    return monthOf(date) === monthISO && inWindow(date, winStart, winEnd);
  });
  const extrasWin = inputs.extraordinaryEvents.filter((e) => inWindow(e.date, winStart, winEnd));
  const reembWin = inputs.reimbursements.filter((r) => r.status !== 'recebido' && inWindow(r.expectedDate, winStart, winEnd));

  const entradas = incomesWin.reduce((s, i) => s + Math.abs(i.amount), 0)
    + extrasWin.reduce((s, e) => s + e.amount, 0)
    + reembWin.reduce((s, r) => s + Math.abs(r.amount), 0);

  // Fixas de caixa na janela (débito/boleto/pix) — cartão NÃO (R10)
  const fixedCashWin = inputs.fixedCommitments.filter((f) =>
    fixedActiveInMonth(f, monthISO) && fixedHitsCash(f.payMethod, f.cardId)
    && inWindow(ymd(monthISO, f.dayOfMonth), winStart, winEnd));
  const sumFixedCash = fixedCashWin.reduce((s, f) => s + Math.abs(f.amount), 0);

  // Faturas com vencimento na janela (R1/R2)
  const billsWin = billsDueInWindow(inputs.cardBills, winStart, winEnd);
  const sumBills = billsWin.reduce((s, b) => s + Math.abs(b.amount), 0);

  const ds = resolveDaily(inputs, monthISO); // A2
  const pctFora = ds ? paymentSplit(ds.profile).pctFora : 0;

  const compute = (cenario: Scenario) => {
    const dailyFora = dailyOf(inputs, monthISO, cenario) * pctFora * (diasRestantes / diasDoMes);
    return entradas - sumFixedCash - sumBills - dailyFora;
  };

  const values: ScenarioTriple = {
    conservador: compute('conservador'),
    provavel: compute('provavel'),
    otimista: compute('otimista'),
  };
  const confidence = worst(
    ...incomesWin.map((i) => i.confidence),
    ...extrasWin.map((e) => e.confidence),
    ...reembWin.map((r) => r.confidence),
    ...fixedCashWin.map((f) => f.confidence),
    ...billsWin.map((b) => b.confidence),
    ds?.confidence,
  );
  return { values, confidence };
}

export { CENARIOS };
