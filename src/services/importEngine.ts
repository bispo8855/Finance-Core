import * as XLSX from 'xlsx';
import { ImportBatch, ImportEvent, ImportRawLine, ImportSource, ImportConfidence, ImportMode } from '@/types/import';
import { settlementDaysBySource } from '@/config/settlementDays';

// UUID local simples para a V1 na memória
const generateId = () => Math.random().toString(36).substring(2, 9);

/**
 * Normaliza referências (IDs) para garantir que números grandes em notação científica
 * (ex: 2.0002E+15) sejam convertidos para strings decimais consistentes.
 */
function normalizeReference(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  
  const str = String(val).trim();
  
  // Se parece notação científica ou é um número grande
  if (str.toUpperCase().includes('E+') || (typeof val === 'number' && val > 9999999999)) {
    const num = Number(val);
    if (!isNaN(num)) {
       // toLocaleString('fullwide') evita a notação exponencial e agrupadores de milhar
       return num.toLocaleString('fullwide', { useGrouping: false });
    }
  }
  
  return str;
}

export async function processImportFile(
  buffer: ArrayBuffer,
  fileName: string,
  fileType: 'xlsx' | 'csv',
  source: ImportSource,
  mode: ImportMode
): Promise<ImportBatch> {
  // 1. Ler Workbook
  // Forçamos strings formatadas e desativamos parsing automático de datas para ter controle total
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, raw: false });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // 2. Converter para JSON
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as string[][];
  if (rawRows.length < 2) throw new Error("O arquivo parece vazio ou não tem cabeçalho.");

  // Helper para corrigir encoding corrompido (UTF-8 lido como ISO-8859-1)
  const fixEncoding = (s: unknown): string => {
    if (typeof s !== 'string') return String(s || '');
    if (s.includes('Ã') || s.includes('§') || s.includes('Â')) {
      try {
        return decodeURIComponent(escape(s));
      } catch (e) {
        return s;
      }
    }
    return s;
  };

  // Encontrar o cabeçalho
  let headerRowIndex = 0;
  let maxStringCols = 0;
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i] || [];
    const strCount = row.filter(c => typeof c === 'string' && c.trim().length > 0).length;
    if (strCount > maxStringCols) {
      maxStringCols = strCount;
      headerRowIndex = i;
    }
  }

  const normalizeStr = (s: unknown) => {
    const fixed = fixEncoding(s);
    return fixed.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
  };

  const headers = Array.from(rawRows[headerRowIndex] || []).map(normalizeStr);
  const dataRows = rawRows.slice(headerRowIndex + 1).filter(row => row && row.length > 0 && row.some(cell => cell !== ''));

  // 3. Identificar Colunas Críticas
  const findBestCol = (hints: string[]) => {
    for (const hint of hints) {
      const idx = headers.findIndex(h => h && (h === hint || h.includes(hint)));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colDate = findBestCol(['data da venda', 'data de', 'data', 'date', 'criacao', 'horario', 'release_date']);
  
  // Separar colunas por Natureza (Líquida vs Bruta)
  const NET_HINTS = ['valor liquido', 'net', 'total', 'payout', 'valor da operacao', 'liquido', 'recebido', 'transaction_net_amount', 'net_credit_amount', 'net_debit_amount', 'credito', 'debito'];
  const GROSS_HINTS = ['valor bruto', 'gross', 'receita por produto', 'bruto', 'preco', 'subtotal', 'valor da venda', 'amount', 'gross_amount'];

  const colNet = findBestCol(NET_HINTS);
  const colGross = findBestCol(GROSS_HINTS);

  // Prioridade: Líquido > Bruto
  const isNetColumn = colNet !== -1;
  const colVal = isNetColumn ? colNet : (colGross !== -1 ? colGross : -1);
  const valueSource = isNetColumn ? 'net_column' : (colGross !== -1 ? 'calculated' : 'single_amount');

  const colDesc = findBestCol(['titulo do anuncio', 'descricao da operacao', 'transaction_type', 'type', 'tipo', 'produto', 'titulo', 'nome', 'detalhe', 'operacao', 'descri', 'description']);
  let colRef = findBestCol(['reference_id', 'n.º de venda', 'numero de venda', 'id', 'pedido', 'order', 'transacao', 'referencia', 'external_id', 'codigo', 'order_id']);
  if (colRef === -1) colRef = headers.findIndex(h => h === 'id');

  if (colVal === -1) throw new Error("Não foi possível identificar a coluna de valor.");

  // 3.5 Detectar formato de data (DD/MM vs MM/DD) através de votação por evidência
  const dateFormat = colDate !== -1 ? detectDateFormat(dataRows, colDate) : 'DMY';

  // 4. Traduzir para ImportRawLines com Leitura Horizontal de Taxas
  const parsedLines: ImportRawLine[] = [];
  const processedRows = new Set<string>(); // Proteção contra redundância (ID + Valor + Data)

  for (const row of dataRows) {
    const amount = parseNum(row[colVal]);
    if (isNaN(amount) || amount === 0) continue;

    const desc = colDesc !== -1 && row[colDesc] ? fixEncoding(row[colDesc]) : 'Movimentação sem descrição';
    
    // Normalizar referência (ORDER_ID)
    const ref = colRef !== -1 && row[colRef] ? normalizeReference(row[colRef]) : undefined;
    
    let dateStr = new Date().toISOString();
    if (colDate !== -1 && row[colDate]) {
      const rDate = row[colDate];
      if (typeof rDate === 'string') {
        dateStr = parseDateString(rDate, dateFormat);
      } else if (typeof rDate === 'number') {
        // Excel serial date fallback
        const jsDate = new Date(Math.round((Number(rDate) - 25569) * 86400 * 1000));
        dateStr = new Date(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate(), 12, 0, 0).toISOString();
      }
    }

    // --- PROTEÇÃO CONTRA REDUNDÂNCIA ---
    // Se a mesma linha (ID + Valor + Data) aparecer repetida como redundância de export, ignorar
    const rowKey = `${ref || 'noref'}_${amount.toFixed(2)}_${dateStr.substring(0, 10)}`;
    if (processedRows.has(rowKey)) continue;
    processedRows.add(rowKey);

    const primaryLineId = generateId();
    parsedLines.push({
      id: primaryLineId,
      rawData: row,
      amount,
      date: dateStr,
      description: desc,
      reference: ref,
      detectedType: inferLineType(desc, amount, mode)
    });

    // --- REGRA DE EXCLUSIVIDADE ---
    // Se usamos uma coluna Líquida, NÃO escaneamos taxas horizontais para evitar double-counting.
    if (isNetColumn) continue;

    // Sub-linhas Horizontais (Taxas e Fretes na mesma linha) - Apenas para colunas Brutas
    const ignoreList = ['total', 'liquido', 'líquido', 'unidades', 'quantidade', 'unidade', 'balance', 'saldo'];
    
    for (let c = 0; c < headers.length; c++) {
       if (c === colVal) continue;
       const h = headers[c];
       if (!h || ignoreList.some(w => h.includes(w))) continue;

       const isFee = h.includes('tarifa') || h.includes('taxa') || h.includes('comissao') || h.includes('fee') || h.includes('desconto') || h.includes('custo') || h.includes('reembolso');
       const isFreight = h.includes('frete') || h.includes('envio') || h.includes('shipping');
       const isAddon = h.includes('acrescimo') || (h.includes('receita') && !h.includes('produto'));

       if (isFee || isFreight || isAddon) {
          const subAmount = parseNum(row[c]);
          if (!isNaN(subAmount) && subAmount !== 0) {
             let detectedType: ImportRawLine['detectedType'] = 'taxa';
             if (isFreight) detectedType = 'frete';
             else if (isAddon) detectedType = 'venda';

             parsedLines.push({
                id: generateId(),
                rawData: {},
                amount: subAmount,
                date: dateStr,
                description: h.charAt(0).toUpperCase() + h.slice(1).replace(' (brl)', ''),
                reference: ref,
                detectedType
             });
          }
       }
    }
  }

  // 5. Agrupar em ImportEvents
  const events = groupLinesIntoEvents(parsedLines, source, mode, valueSource);

  return {
    id: generateId(),
    fileName,
    fileType,
    source,
    mode,
    linesCount: parsedLines.length,
    events
  };
}

function parseNum(rawVal: unknown): number {
  if (typeof rawVal === 'number') return rawVal;
  if (!rawVal) return 0;
  
  // Limpar a string mas manter dígitos, separadores e sinal
  const s = String(rawVal).trim().replace(/[^0-9.,-]/g, '');
  if (s === '') return 0;

  const dotCount = (s.match(/\./g) || []).length;
  const commaCount = (s.match(/,/g) || []).length;

  // Ambos os separadores (ex: 1.234,56 ou 1,234.56)
  if (dotCount > 0 && commaCount > 0) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    // O último separador é sempre o decimal
    if (lastDot > lastComma) {
      return parseFloat(s.replace(/,/g, '')); // 1,234.56 (US)
    } else {
      return parseFloat(s.replace(/\./g, '').replace(',', '.')); // 1.234,56 (BR)
    }
  }

  // Apenas vírgula (99,23)
  if (commaCount > 0) {
    if (commaCount > 1) return parseFloat(s.replace(/,/g, ''));
    return parseFloat(s.replace(',', '.'));
  }

  // Apenas ponto (99.23)
  if (dotCount > 0) {
    if (dotCount > 1) return parseFloat(s.replace(/\./g, ''));
    
    // Se houver apenas um ponto, priorizamos o decimal (99.23)
    // Isso evita o erro de x100 em arquivos de Gateway que usam ponto
    return parseFloat(s);
  }

  return parseFloat(s);
}

function detectDateFormat(dataRows: string[][], colIdx: number): 'DMY' | 'MDY' {
  let evidenceDMY = 0;
  let evidenceMDY = 0;

  for (let i = 0; i < Math.min(dataRows.length, 60); i++) {
    const val = String(dataRows[i][colIdx] || '');
    const parts = val.split(/[^0-9]/).filter(p => p.length > 0).map(p => parseInt(p));
    if (parts.length < 2) continue;
    
    if (parts[0] > 12 && parts[1] <= 12) evidenceDMY++;
    if (parts[1] > 12 && parts[0] <= 12) evidenceMDY++;
  }

  if (evidenceMDY > evidenceDMY) return 'MDY';
  return 'DMY'; 
}

function parseDateString(rDate: string, format: 'DMY' | 'MDY'): string {
  const clean = rDate.toLowerCase().trim();
  const ptBRMonths: Record<string, number> = {
    'janeiro': 0, 'fevereiro': 1, 'marco': 2, 'março': 2, 'abril': 3,
    'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8,
    'outubro': 9, 'novembro': 10, 'dezembro': 11
  };
  
  const ptMatch = clean.match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/);
  if (ptMatch) {
    const day = parseInt(ptMatch[1]);
    const m = ptBRMonths[ptMatch[2]];
    const year = parseInt(ptMatch[3]);
    if (m !== undefined) return new Date(year, m, day, 12, 0, 0).toISOString();
  }

  const parts = clean.substring(0, 10).split(/[^0-9]/).filter(p => p.length > 0);
  if (parts.length >= 3) {
    const p1 = parseInt(parts[0]);
    const p2 = parseInt(parts[1]);
    const p3 = parseInt(parts[2]);
    const year = p3 > 100 ? p3 : (p3 < 50 ? 2000 + p3 : 1900 + p3);
    
    if (format === 'DMY') {
      return new Date(year, p2 - 1, p1, 12, 0, 0).toISOString();
    } else {
      return new Date(year, p1 - 1, p2, 12, 0, 0).toISOString();
    }
  }

  try {
    const d = new Date(rDate);
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).toISOString();
  } catch(e) {
    // Silently ignore invalid date attempts
  }
  
  return new Date().toISOString();
}

function inferLineType(description: string, amount: number, mode: ImportMode): ImportRawLine['detectedType'] {
  const desc = description.toLowerCase();
  
  if (desc.includes('frete') || desc.includes('envio') || desc.includes('shipping')) return 'frete';
  if (desc.includes('comissão') || desc.includes('taxa') || desc.includes('tarif') || desc.includes('fee')) return 'taxa';
  
  // Natures Liquidadas
  const isLiquidation = desc.includes('liberação') || desc.includes('liberacao') || 
                        desc.includes('repasse') || desc.includes('transferência') || desc.includes('transferencia') ||
                        desc.includes('depósito') || desc.includes('deposito') || desc.includes('crédito') || desc.includes('credito') ||
                        desc.includes('payout') || desc.includes('liquidação') || desc.includes('liquidacao') ||
                        desc.includes('antecipação') || desc.includes('antecipacao');

  if (desc.includes('liberação') || desc.includes('liberacao')) return 'liberacao';
  if (desc.includes('repasse') || desc.includes('transferência') || desc.includes('transferencia') || desc.includes('payout')) return 'transferencia';
  if (desc.includes('depósito') || desc.includes('deposito') || desc.includes('crédito') || desc.includes('credito')) return 'deposito';
  if (desc.includes('antecipação') || desc.includes('antecipacao')) return 'antecipacao';
  
  if (desc.includes('estorno') || desc.includes('reembolso') || desc.includes('refund')) return 'estorno';
  if (desc.includes('chargeback')) return 'chargeback';
  
  if (amount > 0 && (desc.includes('venda') || desc.includes('produto') || desc.includes('compra') || desc.includes('pagamento') || desc.includes('payment'))) return 'venda';
  
  // No modo banco, se não for taxa/frete/estorno, preferimos tratar como repasse/deposito se for positivo
  if (mode === 'bank' && amount > 0) return 'deposito';

  if (amount > 0) return 'venda'; 
  return 'taxa'; 
}

function groupLinesIntoEvents(lines: ImportRawLine[], source: ImportSource, mode: ImportMode, valueSource?: ImportEvent['valueSource']): ImportEvent[] {
  const refMap = new Map<string, ImportRawLine[]>();
  const orphaned: ImportRawLine[] = [];

  for (const line of lines) {
    const ref = line.reference?.trim();
    if (ref && ref !== '') {
      if (!refMap.has(ref)) refMap.set(ref, []);
      refMap.get(ref)!.push(line);
    } else {
      orphaned.push(line);
    }
  }

  const events: ImportEvent[] = [];
  for (const [ref, groupRaw] of refMap.entries()) {
    const event = buildEventFromGroup(groupRaw, source, mode, `Agrupado pelo Pedido/Referência: ${ref}`);
    event.valueSource = valueSource;
    events.push(event);
  }
  for (const line of orphaned) {
    const event = buildEventFromGroup([line], source, mode, 'Linha isolada na origem');
    event.valueSource = valueSource;
    events.push(event);
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return events;
}

function buildEventFromGroup(lines: ImportRawLine[], source: ImportSource, mode: ImportMode, explanation: string): ImportEvent {
  let grossAmount = 0;
  let feeAmount = 0;
  let freightAmount = 0;
  let netAmount = 0;

  for (const line of lines) {
    netAmount += line.amount;
    
    // Regra por Modo para Bruto (Gross)
    const isSalesMode = mode === 'sales';
    const isBankMode = mode === 'bank';

    if (line.detectedType === 'venda') {
      if (isBankMode) {
        // No modo banco, não tratamos nada como venda bruta
        feeAmount += 0; 
      } else {
        grossAmount += line.amount;
      }
    } else if (line.detectedType === 'repasse') {
      if (isSalesMode) {
        // No modo vendas, ignoramos repasses no cálculo de bruto (evita duplicidade)
        // Eles ficam apenas no netAmount como referência se necessário
      } else {
        grossAmount += line.amount;
      }
    } else if (line.detectedType === 'taxa') {
      feeAmount += line.amount;
    } else if (line.detectedType === 'frete') {
      freightAmount += line.amount;
    } else {
      if (line.amount > 0 && !isBankMode) grossAmount += line.amount;
      else feeAmount += line.amount;
    }
  }

  const primaryLine = lines.find(l => l.detectedType === 'venda' || l.detectedType === 'repasse' || l.detectedType === 'liberacao' || l.detectedType === 'transferencia' || l.detectedType === 'deposito') || lines[0];
  let primaryType = primaryLine.detectedType as ImportEvent['primaryType'];

  // Ajuste de PrimaryType baseado no Modo
  if (mode === 'sales') {
    // Forçar Venda se não for algo explicitamente contrário
    if (!['venda', 'taxa', 'frete', 'estorno', 'chargeback'].includes(primaryType)) {
      primaryType = 'venda';
    }
  } else if (mode === 'bank') {
    // Nunca ser venda no modo banco
    if (primaryType === 'venda') primaryType = 'outros';
  }

  let title = primaryLine.description || 'Transação Financeira';
  if (lines.length > 1) {
    title = `Venda ${lines.find(l => l.reference)?.reference ? '#' + lines.find(l => l.reference)?.reference : 'Múltipla'}`;
  }

  let confidence: ImportConfidence = 'alta';
  if (mode === 'generic') {
    confidence = 'revisar';
  } else if (lines.length === 1 && lines[0].amount < 0) {
    confidence = 'revisar';
  } else if (Math.abs(grossAmount) < Math.abs(feeAmount)) {
    confidence = 'revisar';
  }

  const flags: string[] = [];
  const days = settlementDaysBySource[source] ?? settlementDaysBySource.default;
  const expected = new Date(lines[0].date);
  expected.setDate(expected.getDate() + days);
  
  // Regra de Ouro: Tipos de liquidação externa sempre são históricos (já ocorreram)
  const isExternalLiquidation = ['transferencia', 'deposito', 'antecipacao'].includes(primaryType);
  const isInternalLiquidation = ['liberacao', 'repasse'].includes(primaryType);
  
  let historical = isExternalLiquidation || isInternalLiquidation || expected < new Date();
  
  // Ajuste de histórico baseado no Modo
  if (mode === 'sales') {
    // No modo vendas, queremos que as vendas e liberações internas fiquem como "Contas a Receber"
    // para serem conciliadas depois pelo arquivo do Banco.
    // Apenas transferências externas ou o que for explicitamente um payout vira histórico.
    historical = isExternalLiquidation;
  } else if (mode === 'bank') {
    // No modo banco, quase tudo é histórico (já realizado)
    historical = true;
  }

  return {
    id: generateId(),
    source,
    mode,
    title,
    date: lines[0].date,
    grossAmount,
    feeAmount: feeAmount === 0 && grossAmount !== 0 && netAmount < grossAmount ? netAmount - grossAmount : feeAmount,
    freightAmount,
    netAmount,
    confidence,
    status: mode === 'generic' ? 'pendente' : 'pendente', // Ambos pendentes por enquanto, mas generic pode ser mais rígido no futuro
    rawLines: lines,
    explanation,
    flags,
    historical,
    primaryType: (isExternalLiquidation || isInternalLiquidation) ? primaryType : (mode === 'bank' ? 'outros' : 'venda'),
    reference: lines.find(l => l.reference)?.reference
  };
}
