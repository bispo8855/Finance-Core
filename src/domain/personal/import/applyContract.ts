// ============================================================================
// Aurys Personal — CONTRATO de aplicação do staging (AP4C.1c-0.1).
// APENAS tipos e regras conceituais CONGELADAS. NÃO implementa applyBatch, NÃO
// aplica em personal_*, NÃO monta plano. É a fronteira que a fatia 1c-1/1c-2 vai
// respeitar. Puro e testável.
// ============================================================================

import { PersonalCategory, normalizeDescription } from './personalCategories';
import { ImportItemKind } from './personalImportInference';

// ----------------------------------------------------------------------------
// 4. Conta / saldo — a identidade da conta NUNCA é o titular.
//    O saldo só entra no plano de aplicação se houver um AccountTarget explícito.
//    Ao aplicar (fatia futura), personal_import_batches.applied_account_id guarda
//    o ID final da conta (existente escolhida, ou a recém-criada).
// ----------------------------------------------------------------------------
export type AccountTarget =
  | { kind: 'existing'; accountId: string }
  | { kind: 'new'; label: string };

/** O saldo só pode ser aplicado com um alvo de conta explícito e válido. */
export function hasExplicitAccountTarget(target: AccountTarget | null | undefined): target is AccountTarget {
  if (!target) return false;
  if (target.kind === 'existing') return !!target.accountId;
  if (target.kind === 'new') return !!target.label && target.label.trim().length > 0;
  return false;
}

// ----------------------------------------------------------------------------
// 3. Batches antigos — sem backfill heurístico de group_key.
//    Guarda: um batch com renda/fixa e group_key ausente NÃO pode ser aplicado
//    automaticamente; a UI futura deverá pedir nova importação.
// ----------------------------------------------------------------------------
export interface GroupableItem { inferred_kind: ImportItemKind; group_key: string | null }

/** True quando existe renda/fixa sem group_key congelado (exige reimportação). */
export function batchNeedsReimport(items: GroupableItem[]): boolean {
  return items.some((i) => (i.inferred_kind === 'renda' || i.inferred_kind === 'fixa') && !i.group_key);
}

// ----------------------------------------------------------------------------
// 5. Renda avulsa — ocorrência única NÃO vira rotina automaticamente.
//    IMPORTANTE: confirmar "isso é renda" (userConfirmedIncome) NÃO implica
//    recorrência. Uma renda só vira mensal/rotina se:
//      a) houver evidência em ≥2 meses distintos (occurrences >= 2); OU
//      b) o usuário confirmar EXPLICITAMENTE recorrência (userConfirmedRecurring).
//    Renda pontual → 'none' (não cria personal_income_sources nesta fatia).
//    Sem boolean genérico "confirmed": os dois sinais são distintos e explícitos.
// ----------------------------------------------------------------------------
export type IncomeRoutineDecision = 'monthly' | 'none';

export interface IncomeRoutineInput {
  /** Nº de meses distintos em que a renda foi observada no extrato. */
  occurrences: number;
  /** Usuário confirmou "isso é renda" — NÃO implica recorrência. */
  userConfirmedIncome?: boolean;
  /** Usuário confirmou EXPLICITAMENTE que se repete todo mês. */
  userConfirmedRecurring?: boolean;
}

export function decideIncomeRoutine(input: IncomeRoutineInput): IncomeRoutineDecision {
  if (input.occurrences >= 2) return 'monthly';        // evidência observada em vários meses
  if (input.userConfirmedRecurring) return 'monthly';  // confirmação explícita de recorrência
  return 'none';                                        // pontual (mesmo confirmada como renda)
}

// ----------------------------------------------------------------------------
// 6. Essential — categorias sempre essenciais + utilidades essenciais por
//    descrição (água, energia/luz, gás, internet). Contrato para o planner
//    futuro; aqui só a regra congelada.
// ----------------------------------------------------------------------------
export const ESSENTIAL_CATEGORIES: ReadonlySet<PersonalCategory> = new Set<PersonalCategory>([
  'Moradia',
  'Saúde',
  'Educação',
  'Dívidas/Financiamentos',
]);

// Termos de utilidade essencial (descrição normalizada, sem acento).
export const ESSENTIAL_UTILITY_TERMS: readonly string[] = ['agua', 'energia', 'luz', 'gas', 'internet'];

export function isEssential(category: PersonalCategory | null, description = ''): boolean {
  if (category && ESSENTIAL_CATEGORIES.has(category)) return true;
  const n = normalizeDescription(description);
  return ESSENTIAL_UTILITY_TERMS.some((t) => new RegExp(`\\b${t}\\b`).test(n));
}

// ----------------------------------------------------------------------------
// 7. BLOQUEADOR conhecido (NÃO corrigir aqui — antes da AP4C.1c-2):
//    prudence.ts usa busca EXATA de dailySpending por mês e pode produzir
//    diaMin=0 mesmo quando há estimativa herdável, inflando o disponível
//    prudente. Registrado como contrato para a fatia que corrigir o planner.
// ----------------------------------------------------------------------------
export const PRUDENCE_DAILY_MIN_BLOCKER =
  'prudence.ts: busca exata de dailySpending por mês pode retornar diaMin=0 mesmo com estimativa herdável, inflando o disponível prudente. Corrigir antes da AP4C.1c-2.';
