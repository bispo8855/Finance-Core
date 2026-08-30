// ============================================================================
// Aurys Personal — orquestração da entrada assistida por extrato (AP4C.1b).
// Junta parser (AP4C.0) + inferência (AP4C.0.1) e persiste NO STAGING via deps
// injetadas. NÃO aplica nas tabelas de entrada do Personal (contas/renda/fixos/
// dia a dia), não há passo de aplicação de lote aqui, não monta os inputs do
// motor, e não toca motor AP2 / adapter / Business.
// A leitura binária (CSV/XLSX) fica em rowsFromFile (borda); o resto é puro.
// ============================================================================

import { parseStatement } from './personalStatementParser';
import { csvToRows, xlsxToRows } from './personalStatementParser';
import { inferFromLines, ImportSummary } from './personalImportInference';

export interface StatementParseResult {
  summary: ImportSummary;
  parseIssues: string[];     // problemas globais do parser (ex.: colunas não achadas)
  titularRaw: string | null; // nome do titular como aparece no arquivo
}

/** PURO: matriz de células → ImportSummary (parser + inferência). Sem I/O. */
export function summarizeRows(rows: string[][]): StatementParseResult {
  const parsed = parseStatement(rows);
  const summary = inferFromLines(parsed.lines, {
    titular: parsed.meta.titular,
    accountBalance: parsed.meta.accountBalance,
    footerBalance: parsed.meta.footerBalance,
  });
  return { summary, parseIssues: parsed.issues, titularRaw: parsed.meta.titularRaw };
}

/**
 * Hash determinístico do conteúdo (SHA-256 → hex), via Web Crypto nativo
 * (crypto.subtle — sem nova dependência). Serve só como impressão digital do
 * arquivo para dedupe/rastreio; NÃO guardamos o arquivo bruto.
 */
export async function hashContent(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Borda de leitura: File → matriz de células. CSV por texto; XLSX por buffer. */
export async function rowsFromFile(file: File): Promise<string[][]> {
  const name = (file.name || '').toLowerCase();
  const isCsv = name.endsWith('.csv') || file.type === 'text/csv';
  if (isCsv) return csvToRows(await file.text());
  return xlsxToRows(await file.arrayBuffer());
}

/** Deps de persistência: SÓ o staging — não há passo de aplicação de lote por desenho. */
export interface ImportPersistDeps {
  createImportBatch: (
    workspaceId: string,
    args: { fileName?: string | null; fileHash?: string | null; titularRaw?: string | null; summary: ImportSummary },
  ) => Promise<{ id: string }>;
  insertImportItems: (workspaceId: string, batchId: string, summary: ImportSummary) => Promise<number>;
}

export interface PersistFileMeta { name: string; hash: string }
export interface PersistResult { batchId: string; itemCount: number }

/**
 * Grava o resultado no staging: 1 batch (com file_name/file_hash/summary_json) e
 * N import_items. Não aplica nada em personal_*. Deps injetadas p/ testabilidade.
 */
export async function persistImport(
  workspaceId: string,
  fileMeta: PersistFileMeta,
  parse: StatementParseResult,
  deps: ImportPersistDeps,
): Promise<PersistResult> {
  const { id } = await deps.createImportBatch(workspaceId, {
    fileName: fileMeta.name,
    fileHash: fileMeta.hash,
    titularRaw: parse.titularRaw,
    summary: parse.summary,
  });
  const itemCount = await deps.insertImportItems(workspaceId, id, parse.summary);
  return { batchId: id, itemCount };
}
