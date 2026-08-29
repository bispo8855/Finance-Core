// ============================================================================
// Aurys Personal — mutations do onboarding (AP4B.3a).
// SÓ gravam via personalService e invalidam a leitura Personal. NÃO montam
// PersonalInputs à mão nem calculam diagnóstico — o motor AP2 segue sendo a
// única fonte de verdade financeira; aqui é só escrita + invalidação.
// ============================================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createPersonalAccount, updatePersonalAccount, deletePersonalAccount, NewPersonalAccountInput,
  createPersonalIncome, updatePersonalIncome, deletePersonalIncome, NewIncomeInput,
  createPersonalCard, updatePersonalCard, deletePersonalCard, NewCardInput,
  createPersonalCardBill, updatePersonalCardBill, deletePersonalCardBill, NewBillInput,
  createPersonalFixedCommitment, updatePersonalFixedCommitment, deletePersonalFixedCommitment, NewFixedCommitmentInput,
  upsertPersonalDailySpending, deletePersonalDailySpending, NewDailySpendingInput,
  upsertPersonalSettings, PersonalSettingsPatch,
} from '@/services/personal/personalService';

// Chave da leitura Personal (usePersonalData: ['personal','data',workspaceId,monthISO,today]).
// Invalidar o prefixo cobre qualquer mês/hoje em cache.
const READ_KEY = ['personal', 'data'];

/** useMutation que invalida a leitura Personal ao concluir. */
function useInvalidatingMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: READ_KEY }),
  });
}

interface UpdateArgs<P> { id: string; patch: P; }

/**
 * Mutations do onboarding. Passe o workspaceId já resolvido (via usePersonalData).
 * Creates/upserts exigem workspaceId; se ausente, a mutation falha explicitamente
 * (nunca cria workspace pelo client — isso é da RPC 0015).
 */
export function usePersonalMutations(workspaceId: string | null) {
  const ws = (): string => {
    if (!workspaceId) throw new Error('Workspace Personal ainda não disponível.');
    return workspaceId;
  };

  return {
    // Contas
    createAccount: useInvalidatingMutation((i: NewPersonalAccountInput) => createPersonalAccount(ws(), i)),
    updateAccount: useInvalidatingMutation((a: UpdateArgs<Partial<NewPersonalAccountInput>>) => updatePersonalAccount(a.id, a.patch)),
    deleteAccount: useInvalidatingMutation((id: string) => deletePersonalAccount(id)),

    // Rendas
    createIncome: useInvalidatingMutation((i: NewIncomeInput) => createPersonalIncome(ws(), i)),
    updateIncome: useInvalidatingMutation((a: UpdateArgs<Partial<NewIncomeInput>>) => updatePersonalIncome(a.id, a.patch)),
    deleteIncome: useInvalidatingMutation((id: string) => deletePersonalIncome(id)),

    // Cartões
    createCard: useInvalidatingMutation((i: NewCardInput) => createPersonalCard(ws(), i)),
    updateCard: useInvalidatingMutation((a: UpdateArgs<Partial<NewCardInput>>) => updatePersonalCard(a.id, a.patch)),
    deleteCard: useInvalidatingMutation((id: string) => deletePersonalCard(id)),

    // Faturas
    createBill: useInvalidatingMutation((i: NewBillInput) => createPersonalCardBill(ws(), i)),
    updateBill: useInvalidatingMutation((a: UpdateArgs<Partial<NewBillInput>>) => updatePersonalCardBill(a.id, a.patch)),
    deleteBill: useInvalidatingMutation((id: string) => deletePersonalCardBill(id)),

    // Contas fixas
    createFixed: useInvalidatingMutation((i: NewFixedCommitmentInput) => createPersonalFixedCommitment(ws(), i)),
    updateFixed: useInvalidatingMutation((a: UpdateArgs<Partial<NewFixedCommitmentInput>>) => updatePersonalFixedCommitment(a.id, a.patch)),
    deleteFixed: useInvalidatingMutation((id: string) => deletePersonalFixedCommitment(id)),

    // Dia a dia (upsert por mês) + settings (flags/conclusão)
    upsertDailySpending: useInvalidatingMutation((i: NewDailySpendingInput) => upsertPersonalDailySpending(ws(), i)),
    deleteDailySpending: useInvalidatingMutation((id: string) => deletePersonalDailySpending(id)),
    upsertSettings: useInvalidatingMutation((patch: PersonalSettingsPatch) => upsertPersonalSettings(ws(), patch)),
  };
}
