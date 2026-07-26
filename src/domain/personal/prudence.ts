// ============================================================================
// Aurys Personal — reserva recomendada (nº 6) e disponível prudente (nº 7).
// R2: reserva = colchão de liquidez (3× essencial), NÃO meta de investimento.
// R8: projeção não é dinheiro livre — o disponível é o único apresentável como "livre",
//     e ainda assim líquido de colchão, aporte, comprometidos e reembolsos a receber.
// ============================================================================

import { PersonalInputs, Confidence } from './types';
import { worst } from './confidence';
import { monthOf } from './cardCycles';

function fixedActiveInMonth(f: PersonalInputs['fixedCommitments'][number], monthISO: string): boolean {
  return !f.activeUntil || monthISO <= monthOf(f.activeUntil);
}
function installmentActiveInMonth(p: PersonalInputs['installments'][number], monthISO: string): boolean {
  return monthISO >= p.startMonth && monthISO <= p.endMonth;
}

export interface ReservaResult {
  custoEssencialMensal: number;
  piso: number;
  conforto: number;
  atual: number;
  aporteSugeridoMes: number;
}

/**
 * Reserva recomendada = 3× custo ESSENCIAL (piso); 6× = conforto.
 * "Inadiáveis" = parcelas não-reembolsáveis (dívidas próprias). dia a dia MÍNIMO (leve).
 *
 * A1 — aporte sugerido = CAPACIDADE RECORRENTE de poupança, nunca efeito de windfall.
 * A base do 30% é a SOBRA ESTRUTURAL conservadora (rotina), não a sobra de caixa (que
 * inclui entradas patrimoniais/extraordinárias). A sobra de caixa entra apenas como TETO
 * (não se sugere poupar mais do que o caixa do mês permite). Evento com destination='reserva'
 * já é contado em reservaAtual; entrar no aporte seria dupla contagem.
 */
export function recommendedReserve(
  inputs: PersonalInputs,
  monthISO: string,
  sobraEstruturalConservador: number,
  sobraCaixaConservador: number,
): ReservaResult {
  const essenciais = inputs.fixedCommitments
    .filter((f) => f.essential && fixedActiveInMonth(f, monthISO))
    .reduce((s, f) => s + Math.abs(f.amount), 0);
  const inadiaveis = inputs.installments
    .filter((p) => !p.reimbursable && installmentActiveInMonth(p, monthISO))
    .reduce((s, p) => s + Math.abs(p.monthlyAmount), 0);
  const ds = inputs.dailySpending.find((d) => d.monthISO === monthISO);
  const diaMin = ds ? ds.min : 0;

  const custoEssencialMensal = essenciais + inadiaveis + diaMin;
  const piso = 3 * custoEssencialMensal;
  const conforto = 6 * custoEssencialMensal;

  const atual = inputs.accounts.filter((a) => a.isReserve).reduce((s, a) => s + a.currentBalance, 0)
    + inputs.extraordinaryEvents.filter((e) => e.destination === 'reserva').reduce((s, e) => s + e.amount, 0);

  const aporteSugeridoMes = Math.max(0, Math.min(
    sobraEstruturalConservador * 0.3, // capacidade recorrente (rotina), nunca windfall
    (piso - atual) / 12,              // ritmo para fechar o piso em 12 meses
    sobraCaixaConservador,            // teto: não poupar além do caixa do mês
  ));

  return { custoEssencialMensal, piso, conforto, atual, aporteSugeridoMes };
}

export interface PrudentResult {
  value: number;
  confidence: Confidence;
  deducoes: { label: string; amount: number }[];
}

/**
 * Disponível prudente. Parte do saldo projetado CONSERVADOR e desconta, com rastreabilidade:
 *  - colchão do mês (o que falta para não furar)
 *  - aporte sugerido do mês (NUNCA a meta inteira — decisão fechada §355)
 *  - extraordinários/patrimoniais com destinação ≠ 'livre' (R6)
 *  - reembolsos ainda não recebidos (R5 — risco de timing)
 */
export function prudentAvailable(
  inputs: PersonalInputs,
  saldoProjetadoConservador: number,
  saldoProjetadoConfidence: Confidence,
  menorSaldoValue: number,
  aporteSugeridoMes: number,
): PrudentResult {
  const colchao = Math.max(0, -menorSaldoValue);
  const lockedExtras = inputs.extraordinaryEvents.filter((e) => e.destination !== 'livre');
  const somaLocked = lockedExtras.reduce((s, e) => s + e.amount, 0);
  const reembNaoRecebidos = inputs.reimbursements.filter((r) => r.status !== 'recebido');
  const somaReemb = reembNaoRecebidos.reduce((s, r) => s + Math.abs(r.amount), 0);

  const value = Math.max(
    0,
    saldoProjetadoConservador - colchao - aporteSugeridoMes - somaLocked - somaReemb,
  );

  const deducoes: { label: string; amount: number }[] = [];
  if (colchao > 0) deducoes.push({ label: 'Colchão do mês (menor saldo)', amount: colchao });
  if (aporteSugeridoMes > 0) deducoes.push({ label: 'Aporte à reserva (mês)', amount: aporteSugeridoMes });
  if (somaLocked > 0) deducoes.push({ label: 'Comprometido (destinação travada)', amount: somaLocked });
  if (somaReemb > 0) deducoes.push({ label: 'Reembolsos a receber', amount: somaReemb });

  const confidence = worst(
    saldoProjetadoConfidence,
    ...lockedExtras.map((e) => e.confidence),
    ...reembNaoRecebidos.map((r) => r.confidence),
  );
  return { value, confidence, deducoes };
}
