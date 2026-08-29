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
import { Confidence, Nature, PayMethod, SpendProfile } from '@/domain/personal/types';

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

// Settings em camelCase para o consumidor (onboarding/wizard). Inclui os flags 0016,
// com default false — não ficam write-only. NÃO calcula nada financeiro.
export interface PersonalSettings {
  workspaceId?: string;
  onboardingCompletedAt: string | null;
  anchorMonth: string | null;
  declaredNoCards: boolean;
  declaredNoFixedCommitments: boolean;
}
export function mapSettingsRow(r: Row): PersonalSettings {
  return {
    workspaceId: r.workspace_id,
    onboardingCompletedAt: r.onboarding_completed_at ?? null,
    anchorMonth: r.anchor_month ?? null,
    declaredNoCards: r.declared_no_cards ?? false,
    declaredNoFixedCommitments: r.declared_no_fixed_commitments ?? false,
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
          // Flags 0016 lidos de volta (default false se ausente/null) — não ficam write-only.
          declared_no_cards: settingsRow.declared_no_cards ?? false,
          declared_no_fixed_commitments: settingsRow.declared_no_fixed_commitments ?? false,
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

// ==========================================================================
// CRUD aditivo do onboarding (AP4B.3a). SÓ grava — nenhum cálculo financeiro.
// Não altera loadPersonalData/map*Row/adapter/motor/Business. Usa o workspace_id
// recebido; jamais cria workspace pelo client (isso é da RPC 0015).
// ==========================================================================

// Helpers genéricos (o mapeamento camelCase→snake_case vive em cada função).
async function insertRow(table: string, row: Row): Promise<{ id: string }> {
  const { data, error } = await supabase.from(table).insert(row).select('id').single();
  if (error) throw error;
  return { id: data!.id as string };
}
async function updateRow(table: string, id: string, row: Row): Promise<void> {
  const { error } = await supabase.from(table).update(row).eq('id', id);
  if (error) throw error;
}
async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

// ---- personal_accounts (create já existe acima; aqui update/delete) ----
export function updatePersonalAccount(id: string, patch: Partial<NewPersonalAccountInput>): Promise<void> {
  const row: Row = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.currentBalance !== undefined) row.current_balance = patch.currentBalance;
  if (patch.balanceDate !== undefined) row.balance_date = patch.balanceDate ?? null;
  if (patch.isReserve !== undefined) row.is_reserve = patch.isReserve;
  if (patch.confidence !== undefined) row.confidence = patch.confidence;
  return updateRow('personal_accounts', id, row);
}
export function deletePersonalAccount(id: string): Promise<void> {
  return deleteRow('personal_accounts', id);
}

// ---- personal_income_sources ----
export interface NewIncomeInput {
  label: string; amount: number; dayOfMonth: number;
  frequency: 'mensal' | 'avulsa'; nature: Nature; variable?: boolean;
  specificDate?: string | null; confidence: Confidence;
}
export function createPersonalIncome(workspaceId: string, d: NewIncomeInput): Promise<{ id: string }> {
  return insertRow('personal_income_sources', {
    workspace_id: workspaceId, label: d.label, amount: d.amount, day_of_month: d.dayOfMonth,
    frequency: d.frequency, nature: d.nature, variable: d.variable ?? false,
    specific_date: d.specificDate ?? null, confidence: d.confidence,
  });
}
export function updatePersonalIncome(id: string, patch: Partial<NewIncomeInput>): Promise<void> {
  const row: Row = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.dayOfMonth !== undefined) row.day_of_month = patch.dayOfMonth;
  if (patch.frequency !== undefined) row.frequency = patch.frequency;
  if (patch.nature !== undefined) row.nature = patch.nature;
  if (patch.variable !== undefined) row.variable = patch.variable;
  if (patch.specificDate !== undefined) row.specific_date = patch.specificDate ?? null;
  if (patch.confidence !== undefined) row.confidence = patch.confidence;
  return updateRow('personal_income_sources', id, row);
}
export function deletePersonalIncome(id: string): Promise<void> {
  return deleteRow('personal_income_sources', id);
}

// ---- personal_cards ----
export interface NewCardInput {
  label: string; closingDay: number; dueDay: number; creditLimit?: number | null;
}
export function createPersonalCard(workspaceId: string, d: NewCardInput): Promise<{ id: string }> {
  return insertRow('personal_cards', {
    workspace_id: workspaceId, label: d.label, closing_day: d.closingDay, due_day: d.dueDay,
    credit_limit: d.creditLimit ?? null,
  });
}
export function updatePersonalCard(id: string, patch: Partial<NewCardInput>): Promise<void> {
  const row: Row = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.closingDay !== undefined) row.closing_day = patch.closingDay;
  if (patch.dueDay !== undefined) row.due_day = patch.dueDay;
  if (patch.creditLimit !== undefined) row.credit_limit = patch.creditLimit ?? null;
  return updateRow('personal_cards', id, row);
}
export function deletePersonalCard(id: string): Promise<void> {
  return deleteRow('personal_cards', id);
}

// ---- personal_card_bills ----
export interface NewBillInput {
  cardId: string; cycleStart?: string | null; cycleEnd?: string | null;
  dueDate: string; amount: number; status: 'fechada' | 'aberta' | 'estimada'; confidence: Confidence;
}
export function createPersonalCardBill(workspaceId: string, d: NewBillInput): Promise<{ id: string }> {
  return insertRow('personal_card_bills', {
    workspace_id: workspaceId, card_id: d.cardId, cycle_start: d.cycleStart ?? null,
    cycle_end: d.cycleEnd ?? null, due_date: d.dueDate, amount: d.amount,
    status: d.status, confidence: d.confidence,
  });
}
export function updatePersonalCardBill(id: string, patch: Partial<NewBillInput>): Promise<void> {
  const row: Row = {};
  if (patch.cardId !== undefined) row.card_id = patch.cardId;
  if (patch.cycleStart !== undefined) row.cycle_start = patch.cycleStart ?? null;
  if (patch.cycleEnd !== undefined) row.cycle_end = patch.cycleEnd ?? null;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.confidence !== undefined) row.confidence = patch.confidence;
  return updateRow('personal_card_bills', id, row);
}
export function deletePersonalCardBill(id: string): Promise<void> {
  return deleteRow('personal_card_bills', id);
}

// ---- personal_fixed_commitments ----
export interface NewFixedCommitmentInput {
  label: string; amount: number; dayOfMonth: number; payMethod: PayMethod;
  cardId?: string | null; essential?: boolean; activeUntil?: string | null; confidence: Confidence;
}
export function createPersonalFixedCommitment(workspaceId: string, d: NewFixedCommitmentInput): Promise<{ id: string }> {
  // Fixa no cartão aponta para card_id existente (R10: compõe a fatura, não sai direto do caixa).
  return insertRow('personal_fixed_commitments', {
    workspace_id: workspaceId, label: d.label, amount: d.amount, day_of_month: d.dayOfMonth,
    pay_method: d.payMethod, card_id: d.cardId ?? null, essential: d.essential ?? false,
    active_until: d.activeUntil ?? null, confidence: d.confidence,
  });
}
export function updatePersonalFixedCommitment(id: string, patch: Partial<NewFixedCommitmentInput>): Promise<void> {
  const row: Row = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.dayOfMonth !== undefined) row.day_of_month = patch.dayOfMonth;
  if (patch.payMethod !== undefined) row.pay_method = patch.payMethod;
  if (patch.cardId !== undefined) row.card_id = patch.cardId ?? null;
  if (patch.essential !== undefined) row.essential = patch.essential;
  if (patch.activeUntil !== undefined) row.active_until = patch.activeUntil ?? null;
  if (patch.confidence !== undefined) row.confidence = patch.confidence;
  return updateRow('personal_fixed_commitments', id, row);
}
export function deletePersonalFixedCommitment(id: string): Promise<void> {
  return deleteRow('personal_fixed_commitments', id);
}

// ---- personal_daily_spending (UNIQUE(workspace_id, month_iso) → upsert por mês) ----
export interface NewDailySpendingInput {
  monthISO: string; minAmount: number; normalAmount: number; heavyAmount: number;
  profile: SpendProfile; confidence: Confidence;
}
export async function upsertPersonalDailySpending(workspaceId: string, d: NewDailySpendingInput): Promise<void> {
  const { error } = await supabase
    .from('personal_daily_spending')
    .upsert({
      workspace_id: workspaceId, month_iso: d.monthISO, min_amount: d.minAmount,
      normal_amount: d.normalAmount, heavy_amount: d.heavyAmount, profile: d.profile, confidence: d.confidence,
    }, { onConflict: 'workspace_id,month_iso' });
  if (error) throw error;
}
export function deletePersonalDailySpending(id: string): Promise<void> {
  return deleteRow('personal_daily_spending', id);
}

// ---- personal_settings (workspace_id UNIQUE → upsert; flags do onboarding + conclusão) ----
export interface PersonalSettingsPatch {
  declaredNoCards?: boolean;
  declaredNoFixedCommitments?: boolean;
  onboardingCompletedAt?: string | null;
  anchorMonth?: string | null;
}
export async function upsertPersonalSettings(workspaceId: string, patch: PersonalSettingsPatch): Promise<void> {
  const row: Row = { workspace_id: workspaceId };
  if (patch.declaredNoCards !== undefined) row.declared_no_cards = patch.declaredNoCards;
  if (patch.declaredNoFixedCommitments !== undefined) row.declared_no_fixed_commitments = patch.declaredNoFixedCommitments;
  if (patch.onboardingCompletedAt !== undefined) row.onboarding_completed_at = patch.onboardingCompletedAt ?? null;
  if (patch.anchorMonth !== undefined) row.anchor_month = patch.anchorMonth ?? null;
  const { error } = await supabase
    .from('personal_settings')
    .upsert(row, { onConflict: 'workspace_id' });
  if (error) throw error;
}
