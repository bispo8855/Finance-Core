export type ImportConfidence = 'alta' | 'revisar' | 'incompleto' | 'duplicidade';
export type ImportMode = 'sales' | 'bank' | 'generic';

export type ImportEventStatus = 'aprovado' | 'ignorado' | 'pendente';

export type ImportSource = 'Mercado Livre' | 'Shopee' | 'Shopify' | 'Gateway' | 'Outro';

export interface ImportRawLine {
  id: string; // uuid local
  rawData: unknown; // O objeto JSON original da linha da planilha
  detectedType: 'venda' | 'taxa' | 'frete' | 'repasse' | 'antecipacao' | 'estorno' | 'chargeback' | 'ajuste' | 'transferencia' | 'desconhecido';
  amount: number;
  date: string; // ISO string
  reference?: string; // ID do pedido ou transação na origem
  description: string;
}

export interface ImportEvent {
  id: string; // uuid local
  source: ImportSource;
  mode: ImportMode;
  title: string;
  date: string; // ISO string
  
  // Breakdown
  grossAmount: number; // venda total (positivo)
  feeAmount: number; // taxas e descontos originados de comissões (negativo)
  freightAmount: number; // fretes (negativo)
  netAmount: number; // Total que vai cair no caixa (pode ser repasse, ou lucro = gross + fee + freight)
  
  confidence: ImportConfidence;
  status: ImportEventStatus;
  
  // Detalhes extras processados
  categoryId?: string; // associado se encontrarmos um fit ideal
  rawLines: ImportRawLine[];
  
  // Explicação sobre por que esse evento foi agrupado
  explanation?: string;
  // Natureza financeira
  primaryType: 'venda' | 'repasse' | 'liberacao' | 'transferencia' | 'deposito' | 'antecipacao' | 'recebivel_futuro' | 'pedido' | 'outros';
  // Referência do pedido/transação (normalizada)
  reference?: string;
  // New fields for Reconciliation
  flags?: string[]; // e.g., ['duplicate']
  historical?: boolean; // true for historic imports where receipt date already passed
  reconciliationId?: string; // ID of existing title for match
  reconciliationType?: 'match' | 'multiple' | 'none';
  // Traceability
  valueSource?: 'net_column' | 'calculated' | 'single_amount';
}

export interface ImportBatch {
  id: string;
  fileName: string;
  fileType: 'xlsx' | 'csv';
  source: ImportSource;
  mode: ImportMode;
  linesCount: number;
  events: ImportEvent[];
}
