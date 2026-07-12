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
  const lowerStr = str.toLowerCase();
  
  // Lista de bloqueios de palavras genéricas
  const blockedWords = ['sim', 'não', 'nao', 'ok', '-', 'n/a', 'null', 'undefined', 'nenhum'];
  if (blockedWords.includes(lowerStr)) return '';
  
  // Validação: Ter pelo menos algum número e ter tamanho mínimo, ou ser um hash longo
  const hasNumbers = /\d/.test(str);
  if (!hasNumbers && str.length < 6) return ''; // Se não tem número, e é curto, ignora (ex: nomes curtos)
  if (str.length < 3) return ''; // Muito curto para ser referência

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
  const findBestCol = (hints: string[], blocked: string[] = ['pacote de diversos', 'pertence a um kit', 'status']) => {
    for (const hint of hints) {
      const idx = headers.findIndex(h => {
        if (!h) return false;
        if (blocked.some(b => h.includes(b))) return false;
        return h === hint || h.includes(hint);
      });
      if (idx !== -1) return idx;
    }
    return -1;
  };

  let colDate = -1, colNet = -1, colGross = -1, colDesc = -1, colRef = -1, colProduct = -1, colStatus = -1, colReleaseDate = -1;

  if (source === 'Mercado Livre' && mode === 'sales') {
    // Mapeamento explícito exigido para Mercado Livre (Sales)
    const exactMatch = (name: string) => headers.findIndex(h => h === normalizeStr(name) || h.includes(normalizeStr(name)));
    
    colRef = exactMatch('n.º de venda');
    if (colRef === -1) colRef = exactMatch('numero de venda');
    
    colDate = exactMatch('data da venda');
    colNet = exactMatch('total (brl)'); 
    if (colNet === -1) colNet = exactMatch('total');
    
    colProduct = exactMatch('título do anuncio') !== -1 ? exactMatch('título do anuncio') : exactMatch('produto');
    // Para ml sales, forçamos o colDesc a ser o mesmo do produto. 
    // Se não houver, o fallback cuidará de usar "Venda Mercado Livre #REF".
    colDesc = colProduct;

    // Também precisamos dos status de liquidação e datas de liberação para Mercado Livre Sales
    colStatus = findBestCol(['status', 'estado', 'state', 'estado da venda', 'situação', 'situacao'], []);
    colReleaseDate = findBestCol(['data de liberacao', 'data de liquidação', 'release date', 'payout date', 'data de repasse', 'data de liberação', 'data de liquidação', 'liberação do dinheiro', 'liberacao do dinheiro', 'data de disponibilidade', 'disponivel em']);
  } else {
    colDate = findBestCol(['data da venda', 'data de liberacao', 'data de', 'data', 'date', 'criacao', 'horario', 'release_date']);
    
    const NET_HINTS = ['valor liquido creditado', 'valor liquido', 'net', 'total', 'payout', 'valor da operacao', 'liquido', 'recebido', 'transaction_net_amount', 'net_credit_amount', 'net_debit_amount', 'credito', 'debito'];
    const GROSS_HINTS = ['valor bruto', 'gross', 'receita por produto', 'bruto', 'preco', 'subtotal', 'valor da venda', 'amount', 'gross_amount'];

    colNet = findBestCol(NET_HINTS);
    colGross = findBestCol(GROSS_HINTS);

    colProduct = findBestCol(['produto', 'titulo do anuncio', 'nome do produto', 'item']);
    colDesc = findBestCol(['descricao', 'descrição', 'description', 'tipo', 'transaction_type', 'titulo do anuncio', 'descricao da operacao', 'type', 'produto', 'titulo', 'nome', 'detalhe', 'operacao', 'descri']);
    colRef = findBestCol(['n.º do pacote', 'id do pacote', 'pacote', 'reference_id', 'n.º de venda', 'numero de venda', 'id do pedido', 'pedido', 'order', 'transacao', 'referencia', 'external_id', 'codigo', 'order_id']);
    if (colRef === -1) colRef = headers.findIndex(h => h === 'id');
    
    colStatus = findBestCol(['status', 'estado', 'state', 'estado da venda', 'situação', 'situacao'], []);
    colReleaseDate = findBestCol(['data de liberacao', 'data de liquidação', 'release date', 'payout date', 'data de repasse', 'data de liberação', 'data de liquidação', 'liberação do dinheiro', 'liberacao do dinheiro', 'data de disponibilidade', 'disponivel em']);
  }

  // Prioridade: Líquido > Bruto
  const isNetColumn = colNet !== -1;
  const colVal = isNetColumn ? colNet : (colGross !== -1 ? colGross : -1);
  const valueSource = isNetColumn ? 'net_column' : (colGross !== -1 ? 'calculated' : 'single_amount');

  if (colVal === -1) throw new Error("Não foi possível identificar a coluna de valor.");

  // 3.5 Detectar formato de data (DD/MM vs MM/DD) através de votação por evidência
  const dateFormat = colDate !== -1 ? detectDateFormat(dataRows, colDate) : 'DMY';

  // 4. Traduzir para ImportRawLines com Leitura Horizontal de Taxas
  const parsedLines: ImportRawLine[] = [];
  const processedRows = new Set<string>(); // Proteção contra redundância (ID + Valor + Data)

  for (const row of dataRows) {
    const amount = parseNum(row[colVal]);
    if (isNaN(amount) || amount === 0) continue;

    // Normalizar referência (ORDER_ID)
    const ref = colRef !== -1 && row[colRef] ? normalizeReference(row[colRef]) : undefined;

    let descRaw = colDesc !== -1 && row[colDesc] ? row[colDesc] : 'Movimentação sem descrição';
    let desc = colDesc !== -1 && row[colDesc] ? fixEncoding(row[colDesc]) : 'Movimentação sem descrição';

    // Melhorar descrições fracas com o nome do produto (se disponível)
    if (colProduct !== -1 && row[colProduct] && String(row[colProduct]).trim() !== '') {
      const dLower = String(desc).toLowerCase();
      if (dLower.includes('chegou em') || dLower.includes('pagamento') || dLower.includes('recebimento') || dLower.length < 5) {
        descRaw = row[colProduct];
        desc = fixEncoding(row[colProduct]);
      }
    } else if (source === 'Mercado Livre' && mode === 'sales') {
      // Regra ML: Se não há produto/título útil, usar fallback hardcoded Venda Mercado Livre #REF
      const titleFallback = ref ? `Venda Mercado Livre #${ref}` : 'Venda Mercado Livre';
      descRaw = titleFallback;
      desc = titleFallback;
    }
    
    // Função de normalização robusta
    const normalize = (text: unknown): string => {
      return (text || '')
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    };

    const normalizedDesc = normalize(descRaw);

    // REGRA ESPECÍFICA: Mercado Pago + Modo Bank (removido filtro restritivo de pagamento)
    if (source === 'Mercado Pago' && mode === 'bank') {
      console.log('MP BANK - DESC RAW:', descRaw, '| NORMALIZED:', normalizedDesc);
    }
    
    // A referência já foi normalizada acima
    
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
    let detectedType = inferLineType(desc, amount, mode);
    if (source === 'Mercado Pago' && mode === 'bank' && normalizedDesc === 'pagamento') {
      detectedType = 'entrada_liquidada';
    }

    const rawStatus = colStatus !== -1 && row[colStatus] ? String(row[colStatus]) : '';
    const releaseDateStrRaw = colReleaseDate !== -1 && row[colReleaseDate] ? String(row[colReleaseDate]) : '';
    
    let hasReleaseDate = false;
    let isReleaseFuture = false;
    let settlementDate: string | undefined;
    if (releaseDateStrRaw && releaseDateStrRaw.trim() !== '') {
       settlementDate = parseDateString(releaseDateStrRaw, dateFormat);
       const relD = new Date(settlementDate);
       if (!isNaN(relD.getTime())) {
          hasReleaseDate = true;
          // Ignorar hora para comparar apenas a data
          const today = new Date();
          today.setHours(0,0,0,0);
          const relDateOnly = new Date(relD);
          relDateOnly.setHours(0,0,0,0);
          if (relDateOnly > today) isReleaseFuture = true;
       } else {
          settlementDate = undefined;
       }
    }

    const settlementInfo = inferSettlementLineStatus(desc, rawStatus, detectedType, amount, hasReleaseDate, isReleaseFuture);
    const eventDate = dateStr;
    const competenceDate = eventDate;
    const paymentDate = settlementDate && !['predicted', 'review', 'blocked'].includes(settlementInfo.status)
      ? (settlementDate || eventDate)
      : undefined;
    const dueDate = settlementInfo.status === 'predicted' && settlementDate ? settlementDate : undefined;

    parsedLines.push({
      id: primaryLineId,
      rawData: row,
      amount,
      date: dateStr,
      eventDate,
      competenceDate,
      settlementDate,
      paymentDate,
      dueDate,
      description: desc,
      reference: ref,
      detectedType,
      settlementStatus: settlementInfo.status,
      settlementConfidence: settlementInfo.confidence,
      settlementReason: settlementInfo.reason
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
                eventDate,
                competenceDate,
                settlementDate,
                paymentDate,
                dueDate,
                description: h.charAt(0).toUpperCase() + h.slice(1).replace(' (brl)', ''),
                reference: ref,
                detectedType,
                // Sublinhas herdam status da linha pai para manter consistência, 
                // mas a decisão do evento ignora elas na heurística principal
                settlementStatus: settlementInfo.status,
                settlementConfidence: settlementInfo.confidence,
                settlementReason: 'Sublinha herdou status principal.'
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
    
    // ISO Format: YYYY-MM-DD
    if (p1 > 1000) {
      return new Date(p1, p2 - 1, p3, 12, 0, 0).toISOString();
    }
    
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

// Lista de termos que indicam movimentações ambíguas de marketplace
// Essas NÃO devem ser auto-categorizadas como taxa/deposito/receita
const AMBIGUOUS_TERMS = [
  'reserve_for_payout', 'balance_reserve', 'withholding',
  'adjustment', 'unknown_fee', 'reserve', 'blocked_amount',
  'reserva', 'retenção', 'retencao', 'bloqueio', 'compensação',
  'compensacao', 'saldo reservado', 'retencion', 'mediacion',
  'mediation', 'dispute', 'hold', 'pending', 'frozen',
  'congelado', 'ajuste', 'regularização', 'regularizacao'
];

function inferLineType(description: string, amount: number, mode: ImportMode): ImportRawLine['detectedType'] {
  const desc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Regras de Classificação Semântica para Mercado Pago/Mercado Livre
  if (desc.includes('liberacao de dinheiro')) {
    return amount > 0 ? 'liberacao' : 'pendente_classificacao';
  }
  if (desc.includes('pagamento com codigo qr pix') || desc.includes('qr pix')) {
    return amount > 0 ? 'entrada_liquidada' : 'pendente_classificacao';
  }
  if (desc.includes('pix enviado')) return 'transferencia';
  if (desc.includes('pagamento cartao de credito') || desc.includes('pagamento cartao')) return 'transferencia';
  if (desc.includes('debito por divida') || desc.includes('dinheiro retido') || desc.includes('retido')) return 'pendente_classificacao';

  // 1. Tipos claros e explícitos (alta confiança)
  if (desc.includes('frete') || desc.includes('envio') || desc.includes('shipping')) return 'frete';
  
  // Taxas explícitas (comissão, tarifa nomeada) - não confundir com tipos ambíguos
  const isExplicitFee = desc.includes('comissão') || desc.includes('comissao') || 
                        desc.includes('tarifa') || desc.includes('tarif') ||
                        (desc.includes('taxa') && (desc.includes('marketplace') || desc.includes('mercado') || desc.includes('comissão'))) ||
                        desc.includes('fee') && !desc.includes('unknown_fee');
  if (isExplicitFee) return 'taxa';
  
  // 2. Detecção de tipos AMBÍGUOS (antes de qualquer fallback)
  const isAmbiguous = AMBIGUOUS_TERMS.some(term => desc.includes(term));
  if (isAmbiguous) return 'pendente_classificacao';
  
  // 3. Natures Liquidadas
  if (desc.includes('liberação') || desc.includes('liberacao')) return 'liberacao';
  if (desc.includes('repasse') || desc.includes('transferência') || desc.includes('transferencia') || desc.includes('payout')) return 'transferencia';
  if (desc.includes('depósito') || desc.includes('deposito') || desc.includes('crédito') || desc.includes('credito')) return 'deposito';
  if (desc.includes('antecipação') || desc.includes('antecipacao')) return 'antecipacao';
  if (desc.includes('liquidação') || desc.includes('liquidacao')) return 'deposito';
  
  // 4. Estornos e chargebacks
  if (desc.includes('estorno') || desc.includes('reembolso') || desc.includes('refund')) return 'estorno';
  if (desc.includes('chargeback')) return 'chargeback';
  
  // 5. Vendas explícitas
  if (amount > 0 && (desc.includes('venda') || desc.includes('produto') || desc.includes('compra') || desc.includes('pagamento') || desc.includes('payment'))) return 'venda';
  
  // 6. Fallback seguro — no modo banco, valores sem tipo claro vão para revisão
  if (mode === 'bank') {
    // Apenas se for "pagamento" puro (já filtrado pelo MP bank filter) podemos assumir deposito
    if (desc === 'pagamento') return 'deposito';
    // Tudo mais no modo banco que não foi classificado → pendente
    return 'pendente_classificacao';
  }

  // 7. Fallback para vendas (modo sales) e genérico
  if (amount > 0) return 'venda';
  
  // Negativo não-explícito → pendente de classificação em vez de assumir taxa
  if (mode === 'generic') return 'pendente_classificacao';
  
  return 'taxa'; 
}

function inferSettlementLineStatus(
  desc: string,
  rawStatus: string,
  detectedType: ImportRawLine['detectedType'],
  amount: number,
  hasReleaseDate: boolean,
  isReleaseFuture: boolean
): { status: 'predicted' | 'settled' | 'review', confidence: number, reason: string } {
  const normalize = (value: string) =>
    value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const d = normalize(desc);
  const s = normalize(rawStatus);
  const combined = `${d} ${s}`;

  const reviewKeywords = [
    'em revisão', 'em revisao', 'bloqueado', 'bloqueio', 'contestação', 'contestacao', 
    'disputa', 'reclamação', 'reclamacao', 'mediação', 'mediacao', 'retido', 'retenção', 
    'retencao', 'revisão', 'revisao', 'under review', 'blocked', 'dispute', 'claim', 
    'mediation', 'hold', 'suspended', 'suspenso'
  ];
  const hasReviewKeyword = reviewKeywords.some(k => combined.includes(k));
  if (hasReviewKeyword) {
     return { status: 'review', confidence: 0.85, reason: 'O status ou descrição original indicam que a transação está em revisão, contestação ou bloqueio.' };
  }

  const keywords = [
    'recebido', 'recebimento', 'liquidado', 'baixado', 'liberado', 'liberação', 'liberacao', 
    'repasse', 'creditado', 'crédito', 'credito', 'disponível', 'disponivel', 'saldo disponível', 
    'saldo disponivel', 'valor disponível', 'valor disponivel', 'dinheiro disponível', 
    'dinheiro disponivel', 'pagamento recebido', 'pagamento aprovado', 'pagamento concluído', 
    'pagamento concluido', 'concluído', 'concluido', 'aprovado', 'compensado', 'transferido', 
    'transferência', 'transferencia', 'saque', 'retirada', 'valor liberado', 'dinheiro liberado',
    'paid', 'settled', 'released', 'payout', 'settlement', 'available', 'credited', 'completed', 
    'approved', 'transferred', 'withdrawal', 'received', 'liquidated'
  ];

  const hasKeyword = keywords.some(k => combined.includes(k));
  
  let hasPago = false;
  if (combined.includes('pago')) {
    if (['taxa', 'frete', 'desconhecido'].includes(detectedType) || amount < 0) {
       // Ignorar "pago" para custos
    } else {
       hasPago = true;
    }
  }

  const isIndicatingSettlement = hasKeyword || hasPago;
  const hasReleaseKeyword = [
    'liberado', 'liberacao', 'dinheiro liberado', 'valor liberado', 'released', 'settled', 'paid'
  ].some(k => combined.includes(k));

  if (hasReleaseKeyword && hasReleaseDate && !isReleaseFuture) {
     return { status: 'settled', confidence: 0.9, reason: 'Status ou descrição indicam liberação/liquidação com data passada.' };
  }
  
  if (['repasse', 'liberacao', 'transferencia', 'deposito', 'antecipacao', 'entrada_liquidada'].includes(detectedType)) {
     if (hasReleaseDate && isReleaseFuture) {
        return { status: 'review', confidence: 0.6, reason: 'Tipo de liquidação detectado, mas a data de liberação informada é futura.' };
     }
     return { status: 'settled', confidence: 0.9, reason: 'O tipo detectado indica liquidação financeira (repasse/transferência).' };
  }

  if (isIndicatingSettlement && (!hasReleaseDate || !isReleaseFuture)) {
     return { status: 'settled', confidence: 0.8, reason: 'O status ou descrição original indicam que o valor já foi liquidado.' };
  }

  if (isIndicatingSettlement && hasReleaseDate && isReleaseFuture) {
     return { status: 'review', confidence: 0.7, reason: 'Status indica liquidação, mas a data de liberação apontada é futura (Sinais conflitantes).' };
  }

  if (!isIndicatingSettlement && hasReleaseDate && isReleaseFuture) {
     return { status: 'predicted', confidence: 0.9, reason: 'Existe data de liberação projetada no futuro.' };
  }

  return { status: 'predicted', confidence: 0.5, reason: 'Nenhum indicativo claro de liquidação. Mantido como recebível futuro.' };
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
      // Linha positiva não classificada compõe o valor recebido do evento (bruto),
      // NUNCA taxa — inclusive em modo bank. Uma liberação/payout não tem taxa própria;
      // a taxa pertence ao registro da venda. (Só valores negativos vão para feeAmount.)
      if (line.amount > 0) grossAmount += line.amount;
      else feeAmount += line.amount;
    }
  }

  const primaryLine = lines.find(l => l.detectedType === 'venda' || l.detectedType === 'repasse' || l.detectedType === 'liberacao' || l.detectedType === 'transferencia' || l.detectedType === 'deposito' || l.detectedType === 'entrada_liquidada' || l.detectedType === 'pendente_classificacao') || lines[0];
  let primaryType = primaryLine.detectedType as ImportEvent['primaryType'];

  // Verificar se alguma linha é pendente de classificação
  const hasPendingClassification = lines.some(l => l.detectedType === 'pendente_classificacao');

  // Ajuste de PrimaryType baseado no Modo
  // REGRA: pendente_classificacao NUNCA é sobrescrito automaticamente
  if (primaryType !== 'pendente_classificacao') {
    if (mode === 'sales') {
      // Forçar Venda se não for algo explicitamente contrário
      if (!['venda', 'taxa', 'frete', 'estorno', 'chargeback', 'pendente_classificacao'].includes(primaryType)) {
        primaryType = 'venda';
      }
    } else if (mode === 'bank') {
      // Preservar 'entrada_liquidada' caso seja Mercado Pago, ou caso não seja mudar 'venda' para 'outros'
      if (primaryType === 'entrada_liquidada') {
        // mantém
      } else if (primaryType === 'venda') {
        primaryType = 'outros';
      }
    }
  }

  let title = primaryLine.description || 'Transação Financeira';
  if (lines.length > 1) {
    title = `Venda ${lines.find(l => l.reference)?.reference ? '#' + lines.find(l => l.reference)?.reference : 'Múltipla'}`;
  }

  let confidence: ImportConfidence = 'alta';
  if (hasPendingClassification || primaryType === 'pendente_classificacao') {
    confidence = 'revisar';
  } else if (mode === 'generic') {
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
  const isExternalLiquidation = ['transferencia', 'deposito', 'antecipacao', 'entrada_liquidada'].includes(primaryType);
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

  // Determinar classificationStatus
  const classificationStatus = (hasPendingClassification || primaryType === 'pendente_classificacao') 
    ? 'pending_review' as const
    : 'classified' as const;

  // Determinar primaryType final
  let finalPrimaryType: ImportEvent['primaryType'];
  if (primaryType === 'pendente_classificacao') {
    finalPrimaryType = 'pendente_classificacao';
  } else if (isExternalLiquidation || isInternalLiquidation) {
    finalPrimaryType = primaryType;
  } else {
    finalPrimaryType = mode === 'bank' ? 'outros' : 'venda';
  }

  // Settlement Status Consolidation
  let eventSettlementStatus: 'predicted' | 'settled' | 'review' = 'predicted';
  let eventSettlementReason = 'Padrão assumido (Previsto).';
  let eventSettlementConfidence = 0.5;

  if (primaryLine.settlementStatus) {
     eventSettlementStatus = primaryLine.settlementStatus;
     eventSettlementReason = primaryLine.settlementReason || '';
     eventSettlementConfidence = primaryLine.settlementConfidence || 0.5;
  }
  
  // Rule 5: Don't assume settled just because a fee line is settled.
  // Above we already use the primaryLine, which is the main venta/repasse.
  if (['repasse', 'liberacao', 'transferencia', 'deposito', 'antecipacao', 'entrada_liquidada'].includes(finalPrimaryType)) {
     if (eventSettlementStatus === 'predicted') {
        eventSettlementStatus = 'settled';
        eventSettlementReason = 'Sobrescrito para Liquidado porque o tipo final primário indica movimentação de caixa.';
        eventSettlementConfidence = 0.9;
     }
  }

  // Camada de Classificação Semântica Inicial
  let detectedTypeLabel = 'Outros';
  let suggestedCategoryName = 'Movimentação Pendente de Classificação';
  let classificationReason = 'Classificação automática não conclusiva';
  let classificationConfidence: 'alta' | 'media' | 'revisar' = 'revisar';
  let suggestedAction = 'Revisar classificação gerencial do lançamento.';
  let initialClassificationStatus: ImportEvent['classificationStatus'] = 'pending_review';

  const descLower = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (netAmount > 0) {
    // --- ENTRADAS ---
    if (descLower.includes('estorno') || descLower.includes('devolucao') || descLower.includes('reversao') || descLower.includes('reclamacao devolvida')) {
      // Reversão de estorno (entrada): reclamação/disputa cancelada volta como ENTRADA.
      // NÃO é receita nova → sugere Estornos (o positivo compensa o débito). Os textos reais
      // de reversão do ML ainda não estão mapeados; sem sinal claro, "liberação de dinheiro"
      // segue como venda (fica para revisão manual).
      detectedTypeLabel = 'Devolução / Estorno (reversão)';
      suggestedCategoryName = 'Devoluções e Estornos';
      classificationReason = 'Reversão de estorno / reclamação devolvida (entrada). Confirme para não inflar a receita.';
      classificationConfidence = 'media';
      suggestedAction = 'Registrar como reversão de estorno (não é receita nova).';
      initialClassificationStatus = 'pending_review';
    } else if (mode === 'sales' && finalPrimaryType === 'venda' && (source === 'Mercado Livre' || source === 'Mercado Pago')) {
      detectedTypeLabel = 'Venda';
      suggestedCategoryName = 'Venda de Produtos';
      classificationReason = 'Venda importada do relatório de vendas do marketplace';
      classificationConfidence = 'alta';
      suggestedAction = 'Criar título a receber com base na data prevista de recebimento.';
      initialClassificationStatus = 'classified';
    } else
    if (descLower.includes('liberacao de dinheiro') || finalPrimaryType === 'liberacao') {
      detectedTypeLabel = 'Liberação de dinheiro';
      suggestedCategoryName = 'Venda de Produtos';
      classificationReason = 'Liberação de saldo positivo na conta do gateway';
      classificationConfidence = 'alta';
      suggestedAction = 'Conciliar com venda ou registrar como receita.';
      initialClassificationStatus = 'classified';
    } else if (descLower.includes('codigo qr pix') || descLower.includes('qr pix') || descLower.includes('pix recebido') || descLower.includes('recebimento pix')) {
      detectedTypeLabel = 'Pagamento com Código QR Pix';
      suggestedCategoryName = 'Recebimentos via Pix';
      classificationReason = 'Recebimento de venda via Pix QR';
      classificationConfidence = 'media';
      suggestedAction = 'Aguardando conciliação comercial ou revisão.';
      initialClassificationStatus = 'pending_review';
    } else {
      detectedTypeLabel = 'Entrada de Recursos';
      suggestedCategoryName = 'Recebimentos via Pix';
      classificationReason = 'Entrada de valor via transação financeira';
      classificationConfidence = 'media';
      suggestedAction = 'Confirmar categoria de receita apropriada.';
      initialClassificationStatus = 'pending_review';
    }
  } else {
    // --- SAÍDAS (netAmount < 0) ---
    if (descLower.includes('pagamento cartao de credito') || descLower.includes('pagamento cartao')) {
      detectedTypeLabel = 'Pagamento de Cartão de Crédito';
      suggestedCategoryName = 'Pagamento de Cartão de Crédito';
      classificationReason = 'Saída para pagamento de fatura de cartão de crédito';
      classificationConfidence = 'media';
      suggestedAction = 'Registrar como movimentação financeira (sem DRE).';
      initialClassificationStatus = 'pending_review';
    } else if (
      descLower.includes('devolucao') || descLower.includes('estorno') || descLower.includes('reembolso ao comprador') ||
      descLower.includes('debito por divida') || descLower.includes('dinheiro retido') || descLower.includes('retido') || descLower.includes('retencao')
    ) {
      // REGRA DE NEGÓCIO (confirmada): retenção ML = sempre DEVOLUÇÃO/estorno definitivo.
      // Por isso a sugestão PADRÃO é "Devoluções e Estornos" (reduz o resultado), ainda em
      // revisão. "Retenção Temporária" continua disponível como opção manual no Import Review
      // para a exceção (disputa que ainda pode voltar).
      // DECISÃO (Opção A2 descartada): NÃO implementar ledger de retenção temporária. O caso
      // temporário é coberto por reclassificação manual + reversão positiva mapeada em Estornos.
      detectedTypeLabel = 'Devolução / Estorno';
      suggestedCategoryName = 'Devoluções e Estornos';
      classificationReason = 'Retenção ML tratada como devolução/estorno (regra de negócio). Ajuste manual disponível.';
      classificationConfidence = 'media';
      suggestedAction = 'Registrar como estorno de venda (reduz o resultado). Se for retenção temporária, reclassifique manualmente.';
      initialClassificationStatus = 'pending_review';
    } else if (descLower.includes('ajuste') || descLower.includes('regularizacao')) {
      detectedTypeLabel = 'Ajuste de Saldo';
      suggestedCategoryName = 'Ajuste Mercado Pago';
      classificationReason = 'Ajuste de saldo efetuado pelo gateway';
      classificationConfidence = 'media';
      suggestedAction = 'Registrar como ajuste financeiro temporário (sem DRE).';
      initialClassificationStatus = 'pending_review';
    } else if (descLower.includes('tarifa') || descLower.includes('taxa') || descLower.includes('custo operacional') || descLower.includes('comissao') || descLower.includes('fee')) {
      if (descLower.includes('retido') || descLower.includes('retencao') || descLower.includes('divida')) {
        detectedTypeLabel = 'Retenção / Tarifa Ambígua';
        suggestedCategoryName = 'Movimentação Pendente de Classificação';
        classificationReason = 'Movimentação possui características de tarifa e retenção';
        classificationConfidence = 'revisar';
        suggestedAction = 'Confirmar se é custo fixo/variável ou apenas retenção temporária.';
        initialClassificationStatus = 'pending_review';
      } else {
        detectedTypeLabel = 'Tarifa';
        suggestedCategoryName = 'Tarifa';
        classificationReason = 'Tarifa ou taxa de serviço operacional do gateway';
        classificationConfidence = 'alta';
        suggestedAction = 'Registrar como despesa de tarifa.';
        initialClassificationStatus = 'classified';
      }
    } else if (descLower.includes('pix enviado')) {
      let recipient = title.replace(/pix enviado/i, '').trim();
      recipient = recipient.replace(/\b\d{2,3}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '');
      recipient = recipient.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '');
      recipient = recipient.replace(/^\d+\s+/, '');
      recipient = recipient.trim();

      const isPJ = /\b(ltda|s\/a|s\.a\.|comercio|comércio|importacao|importação|exportacao|exportação|industria|indústria|distribuidora|servicos|serviços|cia|me|eireli|epp|limitada|sociedade|e&e)\b/i.test(recipient);

      if (isPJ) {
        const hasProductKeyword = /\b(mercadoria|estoque|produto|fornecedor|compra|pecas|peças|insumos|embalagem)\b/i.test(descLower);
        if (hasProductKeyword) {
          detectedTypeLabel = 'Pix enviado (Empresa)';
          suggestedCategoryName = 'Compra de Mercadorias';
          classificationReason = 'Pix enviado para empresa com termos de produto/estoque';
          classificationConfidence = 'alta';
          suggestedAction = 'Confirmar compra de mercadoria para estoque.';
          initialClassificationStatus = 'classified';
        } else {
          detectedTypeLabel = 'Pix enviado (Empresa)';
          suggestedCategoryName = 'Pagamento de Fornecedor';
          classificationReason = 'Pix enviado para pessoa jurídica (empresa)';
          classificationConfidence = 'revisar';
          suggestedAction = 'Revisar pagamento de fornecedor ou compra.';
          initialClassificationStatus = 'pending_review';
        }
      } else {
        detectedTypeLabel = 'Pix enviado (Pessoa Física)';
        suggestedCategoryName = 'Transferência / Retirada';
        classificationReason = 'Pix enviado para pessoa física (sem indicador de empresa)';
        classificationConfidence = 'media';
        suggestedAction = 'Revisar se é retirada, transferência pessoal ou outro tipo de saída.';
        initialClassificationStatus = 'pending_review';
      }
    } else if (
      // Compra de Mercadorias: apenas termos FORTES de estoque/revenda/matéria-prima.
      // Termos fracos isolados (ex.: "atacado", "insumo") ficam de fora — sem contexto
      // suficiente, a movimentação segue para revisão manual em vez de auto-classificar.
      // Equipamentos/ativos duráveis são excluídos (não viram mercadoria automaticamente).
      ['mercadoria', 'estoque', 'revenda', 'materia-prima', 'materia prima'].some(k => descLower.includes(k))
      && !['notebook', 'computador', 'maquina', 'equipamento', 'movel', 'mobiliario', 'ativo imobilizado', 'impressora', 'celular', 'monitor'].some(k => descLower.includes(k))
    ) {
      detectedTypeLabel = 'Compra de Mercadorias';
      suggestedCategoryName = 'Compra de Mercadorias';
      classificationReason = 'Descrição indica compra de mercadoria/estoque para revenda';
      classificationConfidence = 'alta';
      suggestedAction = 'Registrar como custo variável (Compra de Mercadorias).';
      initialClassificationStatus = 'classified';
    } else if (
      // Despesa Operacional: contas e serviços recorrentes para manter a operação.
      ['internet', 'aluguel', 'energia', 'agua', 'luz', 'telefone', 'contabilidade', 'contador', 'hospedagem', 'dominio', 'assinatura'].some(k => descLower.includes(k))
    ) {
      detectedTypeLabel = 'Despesa Operacional';
      suggestedCategoryName = 'Despesa Operacional';
      classificationReason = 'Descrição indica despesa operacional (contas/serviços da empresa)';
      classificationConfidence = 'media';
      suggestedAction = 'Registrar como despesa operacional.';
      initialClassificationStatus = 'pending_review';
    } else {
      detectedTypeLabel = 'Saída de Recursos';
      suggestedCategoryName = 'Movimentação Pendente de Classificação';
      classificationReason = 'Saída de valor não identificada automaticamente';
      classificationConfidence = 'revisar';
      suggestedAction = 'Revisar classificação gerencial do lançamento.';
      initialClassificationStatus = 'pending_review';
    }
  }

  // Proteção Global de Receita em Saída
  if (netAmount < 0) {
    if (suggestedCategoryName === 'Venda de Produtos' || suggestedCategoryName === 'Recebimentos via Pix') {
      suggestedCategoryName = 'Movimentação Pendente de Classificação';
      classificationConfidence = 'revisar';
      initialClassificationStatus = 'pending_review';
      classificationReason = 'Proteção Global de Receita: Impedida categoria de receita em valor negativo.';
      suggestedAction = 'Definir uma despesa ou movimentação financeira adequada.';
    }
  }

  // Atualizar a confiança geral se a classificação semântica exigir revisão
  const finalClassificationStatus = (hasPendingClassification || primaryType === 'pendente_classificacao') 
    ? 'pending_review' as const 
    : initialClassificationStatus;

  if (finalClassificationStatus === 'pending_review') {
    if (confidence === 'alta') {
      confidence = classificationConfidence === 'media' ? 'media' : 'revisar';
    }
  }

  const eventDate = primaryLine.eventDate || primaryLine.date || lines[0].date;
  const competenceDate = primaryLine.competenceDate || eventDate;
  const settlementDate = lines.find(l => l.settlementDate)?.settlementDate;
  const linePaymentDate = primaryLine.paymentDate || lines.find(l => l.paymentDate)?.paymentDate;
  const paymentDate = linePaymentDate
    || ((eventSettlementStatus !== 'predicted' && eventSettlementStatus !== 'review' && eventSettlementStatus !== 'blocked')
      ? (settlementDate || (eventSettlementStatus === 'settled' ? eventDate : undefined))
      : undefined);
  const dueDate = eventSettlementStatus === 'predicted'
    ? (primaryLine.dueDate || settlementDate)
    : undefined;

  return {
    id: generateId(),
    source,
    mode,
    title,
    date: lines[0].date,
    eventDate,
    competenceDate,
    settlementDate,
    paymentDate,
    dueDate,
    grossAmount,
    feeAmount: feeAmount === 0 && grossAmount !== 0 && netAmount < grossAmount ? netAmount - grossAmount : feeAmount,
    freightAmount,
    netAmount,
    confidence,
    status: 'pendente',
    rawLines: lines,
    explanation,
    flags,
    historical,
    primaryType: finalPrimaryType,
    reference: lines.find(l => l.reference)?.reference,
    classificationStatus: finalClassificationStatus,
    settlementStatus: eventSettlementStatus,
    settlementReason: eventSettlementReason,
    settlementConfidence: eventSettlementConfidence,
    detectedTypeLabel,
    suggestedCategoryName,
    classificationReason,
    classificationConfidence,
    suggestedAction
  };
}
