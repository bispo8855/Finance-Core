// ============================================================================
// Aurys Personal — parser de extrato/fatura CSV/XLSX (AP4C.0 spike).
// PURO: recebe MATRIZ de células (string[][]) e devolve linhas normalizadas.
// A leitura binária de XLSX/CSV (via lib xlsx) fica na borda; aqui só a lógica,
// para ser 100% testável sem arquivos. Números BR/US e datas DMY/MDY resolvidos.
// Reaproveita a IDEIA do parseNum/detectDateFormat do importEngine do Business,
// reescrita para não acoplar o Personal às regras do Business.
// ============================================================================

import * as XLSX from 'xlsx';

export interface NormalizedLine {
  date: string;              // 'YYYY-MM-DD' (best-effort); vazio se não parseável
  description: string;
  amount: number;            // magnitude POSITIVA
  direction: 'entrada' | 'saida';
  sourceRow: number;         // índice da linha de dados original (0-based)
  confidence: 'alta' | 'media' | 'baixa';
  issues: string[];          // problemas de parsing desta linha
}

export interface ColumnMapping {
  dateCol: number;
  descCol: number;
  amountCol: number;         // coluna de valor único (com sinal) — se >= 0
  debitCol: number;          // coluna de débito separada — se >= 0
  creditCol: number;         // coluna de crédito separada — se >= 0
  headerRow: number;         // índice da linha de cabeçalho (-1 se não houver)
}

export interface ParsedStatement {
  lines: NormalizedLine[];
  mapping: ColumnMapping;
  issues: string[];          // problemas globais (ex.: coluna não encontrada)
}

// -------------------- bordas de leitura (CSV / XLSX) --------------------
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false; }
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** CSV → matriz. Detecta ';' (comum no BR) vs ','. */
export function csvToRows(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const first = lines[0];
  const delim = first.split(';').length > first.split(',').length ? ';' : ',';
  return lines.map((l) => splitCsvLine(l, delim));
}

/** XLSX (buffer) → matriz. Usa a lib xlsx (já no projeto); primeira planilha. */
export function xlsxToRows(buffer: ArrayBuffer | Uint8Array): string[][] {
  const wb = XLSX.read(buffer, { type: 'array', raw: false, cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][];
  return rows.map((r) => r.map((c) => String(c ?? '')));
}

// -------------------- números (BR/US) --------------------
export function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (raw == null) return NaN;
  const s = String(raw).trim().replace(/[^0-9.,-]/g, '');
  if (s === '' || s === '-') return NaN;
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  if (dots > 0 && commas > 0) {
    return s.lastIndexOf('.') > s.lastIndexOf(',')
      ? parseFloat(s.replace(/,/g, ''))               // 1,234.56 (US)
      : parseFloat(s.replace(/\./g, '').replace(',', '.')); // 1.234,56 (BR)
  }
  if (commas > 0) return commas > 1 ? parseFloat(s.replace(/,/g, '')) : parseFloat(s.replace(',', '.'));
  return parseFloat(s);
}

// -------------------- datas --------------------
function detectDateOrder(rows: string[][], col: number): 'DMY' | 'MDY' {
  let dmy = 0, mdy = 0;
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const parts = String(rows[i][col] || '').split(/[^0-9]/).filter((p) => p).map(Number);
    if (parts.length < 2) continue;
    if (parts[0] > 12 && parts[1] <= 12) dmy++;
    if (parts[1] > 12 && parts[0] <= 12) mdy++;
  }
  return mdy > dmy ? 'MDY' : 'DMY'; // Brasil: DMY por padrão
}

export function parseDate(raw: unknown, order: 'DMY' | 'MDY' = 'DMY'): string {
  const s = String(raw ?? '').trim();
  // ISO já pronto
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parts = s.split(/[^0-9]/).filter((p) => p);
  if (parts.length < 3) return '';
  let d: number, m: number, y: number;
  if (order === 'MDY') { m = +parts[0]; d = +parts[1]; y = +parts[2]; }
  else { d = +parts[0]; m = +parts[1]; y = +parts[2]; }
  if (y < 100) y += 2000; // 26 -> 2026
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

// -------------------- detecção de colunas --------------------
const HEADER_HINTS = {
  date: ['data', 'date', 'dt', 'dia', 'lancamento', 'data lanc', 'data mov'],
  desc: ['descricao', 'descrição', 'historico', 'histórico', 'description', 'memo', 'lancamento', 'detalhe', 'estabelecimento', 'titulo'],
  amount: ['valor', 'amount', 'montante', 'quantia', 'value', 'vlr'],
  debit: ['debito', 'débito', 'debit', 'saida', 'saída', 'despesa'],
  credit: ['credito', 'crédito', 'credit', 'entrada', 'receita'],
};

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
function findCol(header: string[], hints: string[]): number {
  for (let i = 0; i < header.length; i++) {
    const h = norm(header[i]);
    if (hints.some((hint) => h === hint || h.includes(hint))) return i;
  }
  return -1;
}

/** Detecta a linha de cabeçalho e o mapeamento de colunas. */
export function detectColumns(rows: string[][]): ColumnMapping {
  // Procura a primeira linha que pareça cabeçalho (tem 'data' e algo de valor/desc).
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const header = rows[r].map(String);
    const dateCol = findCol(header, HEADER_HINTS.date);
    const descCol = findCol(header, HEADER_HINTS.desc);
    const amountCol = findCol(header, HEADER_HINTS.amount);
    const debitCol = findCol(header, HEADER_HINTS.debit);
    const creditCol = findCol(header, HEADER_HINTS.credit);
    if (dateCol >= 0 && descCol >= 0 && (amountCol >= 0 || debitCol >= 0 || creditCol >= 0)) {
      return { dateCol, descCol, amountCol, debitCol, creditCol, headerRow: r };
    }
  }
  return { dateCol: -1, descCol: -1, amountCol: -1, debitCol: -1, creditCol: -1, headerRow: -1 };
}

// -------------------- normalização das linhas --------------------
export function parseStatement(rows: string[][]): ParsedStatement {
  const issues: string[] = [];
  const mapping = detectColumns(rows);
  if (mapping.headerRow < 0) {
    return { lines: [], mapping, issues: ['Não foi possível identificar as colunas (data / descrição / valor).'] };
  }

  const dataRows = rows.slice(mapping.headerRow + 1).filter((r) => r.some((c) => String(c).trim() !== ''));
  const dateOrder = mapping.dateCol >= 0 ? detectDateOrder(dataRows, mapping.dateCol) : 'DMY';
  const lines: NormalizedLine[] = [];

  dataRows.forEach((row, idx) => {
    const lineIssues: string[] = [];
    const date = parseDate(row[mapping.dateCol], dateOrder);
    if (!date) lineIssues.push('data ilegível');
    const description = String(row[mapping.descCol] ?? '').trim();
    if (!description) lineIssues.push('descrição vazia');

    let amount: number;
    let direction: 'entrada' | 'saida';
    if (mapping.amountCol >= 0) {
      const raw = parseAmount(row[mapping.amountCol]);
      direction = raw < 0 ? 'saida' : 'entrada';
      amount = Math.abs(raw);
    } else {
      const deb = mapping.debitCol >= 0 ? parseAmount(row[mapping.debitCol]) : NaN;
      const cred = mapping.creditCol >= 0 ? parseAmount(row[mapping.creditCol]) : NaN;
      if (Number.isFinite(deb) && Math.abs(deb) > 0) { amount = Math.abs(deb); direction = 'saida'; }
      else if (Number.isFinite(cred) && Math.abs(cred) > 0) { amount = Math.abs(cred); direction = 'entrada'; }
      else { amount = NaN; direction = 'saida'; }
    }
    if (!Number.isFinite(amount)) lineIssues.push('valor ilegível');

    const confidence: NormalizedLine['confidence'] = lineIssues.length === 0 ? 'alta' : lineIssues.length === 1 ? 'media' : 'baixa';
    lines.push({ date, description, amount: Number.isFinite(amount) ? amount : 0, direction, sourceRow: idx, confidence, issues: lineIssues });
  });

  return { lines, mapping, issues };
}
