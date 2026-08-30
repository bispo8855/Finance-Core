// ============================================================================
// Aurys Personal — mapeamento ImportSummary → linhas de staging (AP4C.1a).
// PURO. NÃO recalcula inferência (usa summary.itens já classificado) e NÃO
// aplica nada em personal_*. Só traduz o summary para o formato das tabelas.
// ============================================================================

import { ImportSummary, ImportItemKind } from './personalImportInference';

/** Linha pronta para inserir em personal_import_items (sem batch_id/workspace_id). */
export interface StagingItemRow {
  source_row: number;
  raw_date: string;
  raw_description: string;
  raw_amount: number;
  direction: 'entrada' | 'saida';
  inferred_kind: ImportItemKind;
  inferred_category: string | null;
  confidence: 'alta' | 'media' | 'baixa';
  reason: string;
}

/** Campos de personal_import_batches derivados do summary (sem ids/arquivo). */
export interface StagingBatchFields {
  period_start: string | null;
  period_end: string | null;
  months_complete: string[];
  months_partial: string[];
  detected_balance: number | null;
  balance_source: 'movimento' | 'rodape' | null;
  summary_json: ImportSummary;
}

/** 1 linha por movimento classificado (summary.itens). Não recalcula nada. */
export function mapImportSummaryToStagingItems(summary: ImportSummary): StagingItemRow[] {
  return summary.itens.map((i) => ({
    source_row: i.sourceRow,
    raw_date: i.date,
    raw_description: i.description,
    raw_amount: i.amount,
    direction: i.direction,
    inferred_kind: i.kind,
    inferred_category: i.category,
    confidence: i.confidence,
    reason: i.reason,
  }));
}

/** Campos do batch a partir do summary. months_complete = meses − parciais. */
export function mapImportSummaryToBatch(summary: ImportSummary): StagingBatchFields {
  const parciais = new Set(summary.period.mesesParciais);
  return {
    period_start: summary.period.from || null,
    period_end: summary.period.to || null,
    months_complete: summary.period.months.filter((m) => !parciais.has(m)),
    months_partial: summary.period.mesesParciais,
    detected_balance: summary.saldo.valor,
    balance_source: summary.saldo.fonte,
    summary_json: summary,
  };
}
