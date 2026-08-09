// ============================================================================
// Aurys Personal — hook de dados reais (AP4B.2a).
// Fronteira INEGOCIÁVEL:
//   Supabase → loadPersonalData → PersistedPersonalData
//            → buildPersonalInputs (AP4B.1) → PersonalInputs → motor AP2
// O hook NÃO monta PersonalInputs à mão nem faz cálculo. O adapter é obrigatório.
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreatePersonalWorkspace, loadPersonalData } from '@/services/personal/personalService';
import { buildPersonalInputs } from '@/domain/personal/personalInputsAdapter';
import { PersonalInputs, Assumption } from '@/domain/personal/types';

export interface UsePersonalDataResult {
  inputs: PersonalInputs | null;
  criticalAssumptions: Assumption[];
  workspaceId: string | null;
  isLoading: boolean;
  isEmpty: boolean;
  error: Error | null;
}

/** True quando nenhuma das tabelas de entrada tem dados (workspace recém-criado). */
function computeIsEmpty(inputs: PersonalInputs | null): boolean {
  if (!inputs) return true;
  return (
    inputs.accounts.length === 0 &&
    inputs.incomeSources.length === 0 &&
    inputs.cards.length === 0 &&
    inputs.fixedCommitments.length === 0 &&
    inputs.installments.length === 0 &&
    inputs.reimbursements.length === 0 &&
    inputs.extraordinaryEvents.length === 0 &&
    inputs.dailySpending.length === 0
  );
}

export function usePersonalData(monthISO: string, today: string): UsePersonalDataResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // 1. Garante (idempotentemente) o workspace personal antes de qualquer leitura.
  const wsQuery = useQuery({
    queryKey: ['personal', 'workspace', userId],
    queryFn: () => getOrCreatePersonalWorkspace(userId as string),
    enabled: !!userId,
    staleTime: Infinity, // o workspace do usuário não muda durante a sessão
  });
  const workspaceId = wsQuery.data?.workspaceId ?? null;

  // 2. Lê os dados e converte para PersonalInputs via adapter (no select — nunca no componente).
  const dataQuery = useQuery({
    queryKey: ['personal', 'data', workspaceId, monthISO, today],
    queryFn: () => loadPersonalData(workspaceId as string),
    enabled: !!workspaceId,
    select: (persisted) => buildPersonalInputs(persisted, monthISO, today),
  });

  const adapter = dataQuery.data ?? null;
  const inputs = adapter?.inputs ?? null;

  return {
    inputs,
    criticalAssumptions: adapter?.criticalAssumptions ?? [],
    workspaceId,
    isLoading: (!!userId && wsQuery.isLoading) || (!!workspaceId && dataQuery.isLoading),
    isEmpty: !dataQuery.isLoading && computeIsEmpty(inputs),
    error: (wsQuery.error as Error) ?? (dataQuery.error as Error) ?? null,
  };
}
