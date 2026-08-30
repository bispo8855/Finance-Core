// ============================================================================
// Aurys Personal — service do STAGING de importação (AP4C.1a).
// SÓ grava/lê o staging. NÃO aplica em personal_*, NÃO recalcula inferência,
// NÃO monta PersonalInputs. Usa o workspace_id recebido (nunca cria workspace).
// ============================================================================

import { supabase } from '@/lib/supabaseClient';
import { ImportSummary } from '@/domain/personal/import/personalImportInference';
import { mapImportSummaryToBatch, mapImportSummaryToStagingItems } from '@/domain/personal/import/importStaging';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function isoDatePlus(opts: { days?: number; months?: number }): string {
  const d = new Date();
  if (opts.days) d.setDate(d.getDate() + opts.days);
  if (opts.months) d.setMonth(d.getMonth() + opts.months);
  return d.toISOString().slice(0, 10);
}

export interface CreateBatchArgs {
  fileName?: string | null;
  fileHash?: string | null;
  titularRaw?: string | null;
  summary: ImportSummary;
}

/** Cria o batch a partir do summary. status inicial 'parsed'. source_kind sempre 'extrato'. */
export async function createImportBatch(workspaceId: string, args: CreateBatchArgs): Promise<{ id: string }> {
  const b = mapImportSummaryToBatch(args.summary);
  const { data, error } = await supabase.from('personal_import_batches').insert({
    workspace_id: workspaceId,
    source_kind: 'extrato',
    file_name: args.fileName ?? null,
    file_hash: args.fileHash ?? null,
    titular_raw: args.titularRaw ?? null,
    period_start: b.period_start,
    period_end: b.period_end,
    months_complete: b.months_complete,
    months_partial: b.months_partial,
    detected_balance: b.detected_balance,
    balance_source: b.balance_source,
    account_scope: null, // preenchido depois no review ("Da empresa" etc.)
    status: 'parsed',
    summary_json: b.summary_json,
  }).select('id').single();
  if (error) throw error;
  return { id: data!.id as string };
}

/** Insere os import_items (1 por movimento classificado). Retorna a contagem. */
export async function insertImportItems(workspaceId: string, batchId: string, summary: ImportSummary): Promise<number> {
  const rows = mapImportSummaryToStagingItems(summary).map((r) => ({ ...r, batch_id: batchId, workspace_id: workspaceId }));
  if (rows.length === 0) return 0;
  const { error } = await supabase.from('personal_import_items').insert(rows);
  if (error) throw error;
  return rows.length;
}

export async function loadImportBatch(batchId: string): Promise<{ batch: Row | null; items: Row[] }> {
  const { data: batch, error: e1 } = await supabase.from('personal_import_batches').select('*').eq('id', batchId).maybeSingle();
  if (e1) throw e1;
  const { data: items, error: e2 } = await supabase.from('personal_import_items').select('*').eq('batch_id', batchId);
  if (e2) throw e2;
  return { batch: batch ?? null, items: items ?? [] };
}

/** Decisão do usuário — grava SOMENTE campos user_* (nunca sobrescreve inferred_*). */
export async function updateImportItemDecision(itemId: string, patch: { userDecision?: 'confirmado' | 'corrigido' | 'ignorado'; userKind?: string | null; userCategory?: string | null }): Promise<void> {
  const row: Row = {};
  if (patch.userDecision !== undefined) row.user_decision = patch.userDecision;
  if (patch.userKind !== undefined) row.user_kind = patch.userKind ?? null;
  if (patch.userCategory !== undefined) row.user_category = patch.userCategory ?? null;
  const { error } = await supabase.from('personal_import_items').update(row).eq('id', itemId);
  if (error) throw error;
}

/** Marca o batch como aplicado. Guarda: batch já 'applied' NÃO reaplica. retention ~12 meses. */
export async function markImportBatchApplied(batchId: string): Promise<void> {
  const { data: cur, error: e0 } = await supabase.from('personal_import_batches').select('status').eq('id', batchId).single();
  if (e0) throw e0;
  if (cur?.status === 'applied') throw new Error('Batch já aplicado — não reaplicar.');
  const { error } = await supabase.from('personal_import_batches').update({
    status: 'applied', applied_at: new Date().toISOString(), retention_until: isoDatePlus({ months: 12 }),
  }).eq('id', batchId);
  if (error) throw error;
}

/** Descarta o batch. retention ~30 dias. */
export async function discardImportBatch(batchId: string): Promise<void> {
  const { error } = await supabase.from('personal_import_batches').update({
    status: 'discarded', retention_until: isoDatePlus({ days: 30 }),
  }).eq('id', batchId);
  if (error) throw error;
}

/** Upsert de regra de categoria (UNIQUE workspace_id,match_type,pattern). */
export async function upsertCategoryRule(workspaceId: string, r: { matchType?: 'contains' | 'exact'; pattern: string; category: string; source?: 'user' | 'seed' }): Promise<void> {
  const { error } = await supabase.from('personal_category_rules').upsert({
    workspace_id: workspaceId, match_type: r.matchType ?? 'contains', pattern: r.pattern, category: r.category, source: r.source ?? 'user',
  }, { onConflict: 'workspace_id,match_type,pattern' });
  if (error) throw error;
}
