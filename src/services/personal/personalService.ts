// ============================================================================
// Aurys Personal — service (AP4B.2a). SÓ lê, grava e converte formato.
// ZERO cálculo financeiro: nada de saldo, sobra, projeção ou composição de fatura.
// A regra financeira vive no motor AP2; a fronteira persistência→motor é o adapter
// AP4B.1 (buildPersonalInputs), chamado no hook — nunca aqui.
// ============================================================================

import { supabase } from '@/lib/supabaseClient';
import {
  PersistedPersonalData, PersistedAccount, PersistedIncomeSource, PersistedCard,
  PersistedCardBill, PersistedFixedCommitment, PersistedInstallment,
  PersistedReimbursement, PersistedExtraordinaryEvent, PersistedDailySpending,
} from '@/domain/personal/personalInputsAdapter';

// NUMERIC do Postgres pode chegar como string via PostgREST → number honesto.
const num = (v: unknown): number => (v == null ? 0 : Number(v));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// --------------------------------------------------------------------------
// Mapeamentos row → Persisted* (PUROS e exportados — testáveis sem Supabase).
// snake_case → o formato que o adapter AP4B.1 já consome. Nenhum cálculo.
// --------------------------------------------------------------------------
export function mapAccountRow(r: Row): PersistedAccount {
  return {
    id: r.id, label: r.label, current_balance: num(r.current_balance),
    balance_date: r.balance_date ?? null, is_reserve: r.is_reserve ?? null, confidence: r.confidence,
  };
}
export function mapIncomeRow(r: Row): PersistedIncomeSource {
  return {
    id: r.id, label: r.label, amount: num(r.amount), day_of_month: r.day_of_month ?? null,
    frequency: r.frequency, nature: r.nature, variable: r.variable ?? null,
    specific_date: r.specific_date ?? null, confidence: r.confidence,
  };
}
export function mapCardRow(r: Row): PersistedCard {
  return {
    id: r.id, label: r.label, closing_day: r.closing_day, due_day: r.due_day,
    credit_limit: r.credit_limit != null ? num(r.credit_limit) : null,
  };
}
export function mapCardBillRow(r: Row): PersistedCardBill {
  return {
    id: r.id, card_id: r.card_id, cycle_start: r.cycle_start ?? null, cycle_end: r.cycle_end ?? null,
    due_date: r.due_date, amount: num(r.amount), status: r.status, confidence: r.confidence,
  };
}
export function mapFixedCommitmentRow(r: Row): PersistedFixedCommitment {
  return {
    id: r.id, label: r.label, amount: num(r.amount), day_of_month: r.day_of_month ?? null,
    pay_method: r.pay_method, card_id: r.card_id ?? null, essential: r.essential ?? null,
    active_until: r.active_until ?? null, confidence: r.confidence,
  };
}
export function mapInstallmentRow(r: Row): PersistedInstallment {
  return {
    id: r.id, group_label: r.group_label, monthly_amount: num(r.monthly_amount),
    start_month: r.start_month, end_month: r.end_month, card_id: r.card_id ?? null,
    pay_method: r.pay_method, reimbursable: r.reimbursable ?? null, confidence: r.confidence,
  };
}
export function mapReimbursementRow(r: Row): PersistedReimbursement {
  return {
    id: r.id, who: r.who, amount: num(r.amount), expected_date: r.expected_date,
    linked_to: r.linked_to ?? null, status: r.status, confidence: r.confidence,
  };
}
export function mapExtraordinaryEventRow(r: Row): PersistedExtraordinaryEvent {
  return {
    id: r.id, label: r.label, amount: num(r.amount), event_date: r.event_date,
    klass: r.klass, destination: r.destination, confidence: r.confidence,
  };
}
export function mapDailySpendingRow(r: Row): PersistedDailySpending {
  return {
    id: r.id, month_iso: r.month_iso, min_amount: num(r.min_amount),
    normal_amount: num(r.normal_amount), heavy_amount: num(r.heavy_amount),
    profile: r.profile, confidence: r.confidence,
  };
}

// --------------------------------------------------------------------------
// getOrCreatePersonalWorkspace — delega à RPC SECURITY DEFINER (migration 0015).
//
// Por que RPC e não SELECT→INSERT pelo client: a criação inicial pelo cliente bate num
// chicken-and-egg de RLS — workspaces SELECT só enxerga workspace de quem já é membro, e
// workspace_members INSERT exige já ser owner/admin (resultado: 403 no POST /workspaces).
// O Business escapa porque nasce via trigger handle_new_user() (SECURITY DEFINER) no signup.
//
// get_or_create_personal_workspace() roda com privilégios do dono, usa auth.uid()
// internamente, trata a corrida (unique_violation / índice da 0014) e garante a membership
// — tudo no banco. O client NUNCA cria o workspace diretamente; só recebe o uuid.
// --------------------------------------------------------------------------
export interface EnsureWorkspaceResult {
  workspaceId: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getOrCreatePersonalWorkspace(_userId?: string): Promise<EnsureWorkspaceResult> {
  // A RPC usa auth.uid() internamente; _userId (do hook) é aceito por compatibilidade e ignorado.
  const { data, error } = await supabase.rpc('get_or_create_personal_workspace');
  if (error) throw error;
  if (!data) throw new Error('get_or_create_personal_workspace retornou vazio');
  return { workspaceId: data as string };
}

// --------------------------------------------------------------------------
// loadPersonalData — SELECT nas 10 tabelas por workspace_id. Vazio → arrays vazios.
// --------------------------------------------------------------------------
async function fetchByWorkspace(table: string, workspaceId: string): Promise<Row[]> {
  const { data, error } = await supabase.from(table).select('*').eq('workspace_id', workspaceId);
  if (error) throw error;
  return data ?? [];
}

export async function loadPersonalData(workspaceId: string): Promise<PersistedPersonalData> {
  const [
    accounts, incomeSources, cards, cardBills, fixedCommitments,
    installments, reimbursements, extraordinaryEvents, dailySpending, settingsRows,
  ] = await Promise.all([
    fetchByWorkspace('personal_accounts', workspaceId),
    fetchByWorkspace('personal_income_sources', workspaceId),
    fetchByWorkspace('personal_cards', workspaceId),
    fetchByWorkspace('personal_card_bills', workspaceId),
    fetchByWorkspace('personal_fixed_commitments', workspaceId),
    fetchByWorkspace('personal_installments', workspaceId),
    fetchByWorkspace('personal_reimbursements', workspaceId),
    fetchByWorkspace('personal_extraordinary_events', workspaceId),
    fetchByWorkspace('personal_daily_spending', workspaceId),
    fetchByWorkspace('personal_settings', workspaceId),
  ]);

  const settingsRow = settingsRows[0];
  return {
    accounts: accounts.map(mapAccountRow),
    incomeSources: incomeSources.map(mapIncomeRow),
    cards: cards.map(mapCardRow),
    cardBills: cardBills.map(mapCardBillRow),
    fixedCommitments: fixedCommitments.map(mapFixedCommitmentRow),
    installments: installments.map(mapInstallmentRow),
    reimbursements: reimbursements.map(mapReimbursementRow),
    extraordinaryEvents: extraordinaryEvents.map(mapExtraordinaryEventRow),
    dailySpending: dailySpending.map(mapDailySpendingRow),
    settings: settingsRow
      ? {
          workspace_id: settingsRow.workspace_id,
          onboarding_completed_at: settingsRow.onboarding_completed_at ?? null,
          anchor_month: settingsRow.anchor_month ?? null,
        }
      : undefined,
  };
}

// --------------------------------------------------------------------------
// createPersonalAccount — escrita mínima em personal_accounts (base para o AP4B.3a).
// Escrita real validada com sessão autenticada: INSERT passou sem 403, gravou no
// workspace_type='personal' e voltou via loadPersonalData.
// Só grava; usa o workspace_id recebido (do getOrCreatePersonalWorkspace/RPC).
// A RLS de personal_accounts (0013) exige workspace_type='personal', então não há
// como esta escrita cair num workspace business.
// --------------------------------------------------------------------------
export interface NewPersonalAccountInput {
  label: string;
  currentBalance: number;
  balanceDate?: string | null;
  isReserve?: boolean;
  confidence: 'alta' | 'media' | 'baixa';
}

export async function createPersonalAccount(
  workspaceId: string,
  data: NewPersonalAccountInput,
): Promise<{ id: string }> {
  const { data: row, error } = await supabase
    .from('personal_accounts')
    .insert({
      workspace_id: workspaceId,
      label: data.label,
      current_balance: data.currentBalance,
      balance_date: data.balanceDate ?? null,
      is_reserve: data.isReserve ?? false,
      confidence: data.confidence,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: row!.id as string };
}
