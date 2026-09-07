// ============================================================================
// Aurys Personal — gate de LEITURA CONFIÁVEL para a overview (AP4C.1c-2.1).
// REUTILIZA podeGerarLeituraConfiavel (onboarding) — NÃO inventa um segundo
// conjunto de mínimos. Só mapeia PersonalInputs (domínio) + flags de settings
// para o OnboardingSnapshot que o gate já entende. Puro; sem React/Supabase.
// ============================================================================

import { PersonalInputs } from './types';
import { podeGerarLeituraConfiavel, GateResult, OnboardingSnapshot } from './onboardingValidation';

export interface ReadingSettingsFlags {
  declaredNoCards: boolean;
  declaredNoFixedCommitments: boolean;
}

/** Mapeia os inputs do motor para o snapshot do gate (mesma semântica de completude). */
export function buildOnboardingSnapshot(inputs: PersonalInputs, flags: ReadingSettingsFlags): OnboardingSnapshot {
  const daily = inputs.dailySpending[0]; // basta UMA estimativa conhecida (o gate só confere completude)
  return {
    accounts: inputs.accounts.map((a) => ({ label: a.label, currentBalance: a.currentBalance, balanceDate: a.balanceDate, isReserve: a.isReserve, confidence: a.confidence })),
    incomeSources: inputs.incomeSources.map((i) => ({ label: i.label, amount: i.amount, dayOfMonth: i.dayOfMonth, frequency: i.frequency, nature: i.nature, variable: i.variable, specificDate: i.specificDate, confidence: i.confidence })),
    cards: inputs.cards.map((c) => ({ label: c.label, closingDay: c.closingDay, dueDay: c.dueDay })),
    cardBills: inputs.cardBills.map((b) => ({ cardId: b.cardId, amount: b.amount, dueDate: b.dueDate, status: b.status, cycleStart: b.cycleStart, cycleEnd: b.cycleEnd, confidence: b.confidence })),
    fixedCommitments: inputs.fixedCommitments.map((f) => ({ label: f.label, amount: f.amount, dayOfMonth: f.dayOfMonth, payMethod: f.payMethod, cardId: f.cardId, essential: f.essential, confidence: f.confidence })),
    dailySpending: daily ? { minAmount: daily.min, normalAmount: daily.normal, heavyAmount: daily.heavy, profile: daily.profile, confidence: daily.confidence } : null,
    declaredNoCards: flags.declaredNoCards,
    declaredNoFixedCommitments: flags.declaredNoFixedCommitments,
  };
}

/** Gate de leitura confiável para a overview real (reusa o gate do onboarding). */
export function readingIsReliable(inputs: PersonalInputs, flags: ReadingSettingsFlags): GateResult {
  return podeGerarLeituraConfiavel(buildOnboardingSnapshot(inputs, flags));
}

/** Há compromissos que sustentam a frase "comprometido com faturas e contas"? */
export function hasKnownCommitments(inputs: PersonalInputs): boolean {
  return inputs.fixedCommitments.length > 0 || inputs.cardBills.length > 0 || inputs.installments.length > 0;
}
