// ============================================================================
// Aurys Personal — orquestrador buildPersonalMonth (motor puro e determinístico).
// Compõe os 7 números a partir das funções isoladas. NADA consome isto ainda.
// asOfDate = min(hoje, fim do mês); horizonte = 3 meses.
// ============================================================================

import {
  PersonalInputs, PersonalMonthResult, Scenario, ScenarioTriple, DayPoint,
} from './types';
import { worst } from './confidence';
import {
  minISO, monthOf, maxISO, endOfMonthISO, addMonthsISO,
} from './cardCycles';
import {
  buildOccurrences, buildTrajectory, computeMenorSaldo,
} from './calendar';
import { structuralSurplus, cashSurplus } from './surplus';
import { recommendedReserve, prudentAvailable } from './prudence';

const CENARIOS: Scenario[] = ['conservador', 'provavel', 'otimista'];

export function buildPersonalMonth(
  inputs: PersonalInputs,
  monthISO: string,
  today: string,
): PersonalMonthResult {
  const eomTarget = endOfMonthISO(monthISO);
  const asOfDate = minISO(today, eomTarget);
  const isCurrentMonth = monthOf(today) === monthISO;

  // Nº 1 — Saldo atual
  const saldoAtualValue = inputs.accounts.reduce((s, a) => s + a.currentBalance, 0);
  const saldoAtualConf = worst(...inputs.accounts.map((a) => a.confidence));

  // Horizonte de 3 meses cobrindo o mês-alvo e o mês corrente
  const anchorMonth = maxISO(monthISO, monthOf(today));
  const horizonEnd = endOfMonthISO(addMonthsISO(anchorMonth, 2));
  const fromMonth = monthOf(asOfDate);
  const toMonth = monthOf(horizonEnd);
  const occurrences = buildOccurrences(inputs, fromMonth, toMonth);

  // Trajetórias por cenário (para saldo projetado em faixa)
  const trajByCenario = new Map<Scenario, DayPoint[]>();
  for (const c of CENARIOS) {
    trajByCenario.set(c, buildTrajectory(inputs, occurrences, asOfDate, horizonEnd, saldoAtualValue, c).points);
  }

  // Nº 4 — Saldo projetado no fim do mês-alvo (faixa)
  const projAt = (points: DayPoint[]): number => {
    const p = points.find((x) => x.date === eomTarget);
    return p ? p.balance : saldoAtualValue; // mês passado: sem ponto → saldo atual
  };
  const saldoProjValues: ScenarioTriple = {
    conservador: projAt(trajByCenario.get('conservador')!),
    provavel: projAt(trajByCenario.get('provavel')!),
    otimista: projAt(trajByCenario.get('otimista')!),
  };

  // Nº 2 e 3
  const sobraEstrutural = structuralSurplus(inputs, monthISO);
  const sobraCaixa = cashSurplus(inputs, monthISO, asOfDate, isCurrentMonth);

  // Confiança do saldo projetado: saldo atual + tudo que entra na trajetória do mês-alvo
  const saldoProjConf = worst(
    saldoAtualConf,
    sobraCaixa.confidence,
    ...inputs.extraordinaryEvents.filter((e) => monthOf(e.date) <= toMonth).map((e) => e.confidence),
  );

  // Nº 5 — Menor saldo (trajetória conservadora)
  const consPts = trajByCenario.get('conservador')!;
  const menor = computeMenorSaldo(consPts, inputs, asOfDate, horizonEnd);
  const menorConf = worst(saldoAtualConf, sobraCaixa.confidence);

  // Nº 6 — Reserva (A1: base do aporte = sobra estrutural; sobra de caixa é só teto)
  const reserva = recommendedReserve(
    inputs, monthISO, sobraEstrutural.values.conservador, sobraCaixa.values.conservador,
  );

  // Nº 7 — Disponível prudente
  const disponivel = prudentAvailable(
    inputs, saldoProjValues.conservador, saldoProjConf, menor.value, reserva.aporteSugeridoMes,
  );

  // Trajetória exposta: cenário conservador, do asOfDate ao fim do mês-alvo
  const trajetoria = consPts.filter((p) => p.date <= eomTarget && monthOf(p.date) === monthISO);

  // R9 — o que já aconteceu no mês (contexto, nunca somado à projeção)
  const jaOcorreuNoMes = isCurrentMonth
    ? buildOccurrences(inputs, monthISO, monthISO)
        .filter((o) => o.date < asOfDate)
        .map((o) => ({ label: o.label, amount: o.amount, date: o.date }))
    : [];

  // Fora da rotina (segregado)
  const foraDaRotina = {
    extraordinarios: inputs.extraordinaryEvents.filter((e) => e.klass === 'extraordinario'),
    patrimoniais: inputs.extraordinaryEvents.filter((e) => e.klass === 'patrimonial'),
    reembolsaveis: inputs.reimbursements,
  };

  return {
    saldoAtual: { value: saldoAtualValue, confidence: saldoAtualConf },
    sobraEstrutural: { values: sobraEstrutural.values, confidence: sobraEstrutural.confidence },
    sobraCaixa: { values: sobraCaixa.values, confidence: sobraCaixa.confidence },
    saldoProjetado: {
      values: saldoProjValues,
      range: [saldoProjValues.conservador, saldoProjValues.otimista],
      confidence: saldoProjConf,
    },
    menorSaldo: {
      value: menor.value, date: menor.date, valeStart: menor.valeStart, valeEnd: menor.valeEnd,
      confidence: menorConf,
    },
    reserva,
    disponivelPrudente: disponivel,
    trajetoria,
    foraDaRotina,
    jaOcorreuNoMes,
    meta: { monthISO, asOfDate, isCurrentMonth, horizonMonths: 3 },
  };
}
