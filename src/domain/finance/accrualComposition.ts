import { Category, Contact, FinancialDocument, Title } from '@/types/financial';
import {
  FinancialEvent,
  FinancialEventType,
  FinancialEventKind,
  FinancialCompositionItem,
  EventOrigin,
} from '@/domain/extract';
import {
  RecognitionMeta,
  RecognitionEconomics,
  CompetenceDateSource,
  AccrualExclusionReason,
  computeRecognitionMeta,
} from './recognitionMeta';

// ============================================================================
// Etapa C1 — 2º construtor de eventos: base ECONÔMICA (competência / accrual).
// Rev.3 do desenho técnico. Fonte = DOCUMENTOS (não movimentos).
//
// Opção A (aprovada): DECOMPOSIÇÃO PARALELA. classifyEventType/classifyOrigin do
// extract.ts NÃO são exportados e extract.ts NÃO pode ser tocado nesta etapa, então
// a classificação é REPLICADA aqui, fiel ao original. O risco de drift entre as duas
// bases é coberto pelo teste T-CB (consistência entre bases).
//
// Diferenças vs. buildFinancialComposition (realizado):
//   1. event.date = competenceDate (não paymentDate).
//   2. valores vêm do documento (gross/fee/freight; total).
//   3. affectsCash = false em TODOS os itens (caixa é dimensão do realizado).
//   4. sem reconciliação movimento×itens (sem reserve_withheld/adjustment fabricados).
// ============================================================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// --- Réplica fiel de classifyOrigin (extract.ts) ---
function classifyOrigin(doc: FinancialDocument): EventOrigin {
  if (doc.sourceType) return 'ecommerce';
  if (doc.grossAmount && doc.grossAmount > 0) return 'ecommerce';
  if (doc.referenceId) return 'ecommerce';
  return 'manual';
}

// --- Réplica fiel de classifyEventType (extract.ts) ---
function classifyEventType(doc: FinancialDocument, category?: Category): FinancialEventType {
  const desc = (doc.description || '').toLowerCase();

  if (desc.includes('pendente de classificação') || desc.includes('⏳')) return 'pending';

  if (category?.dreClassification === 'estorno_devolucao') return 'chargeback';
  if (desc.includes('chargeback') || desc.includes('estorno') || desc.includes('reembolso') ||
      desc.includes('devolução') || desc.includes('devolucao')) return 'chargeback';

  if (desc.includes('reserva') || desc.includes('retenção') || desc.includes('retencao') ||
      desc.includes('bloqueio') || desc.includes('withholding') || desc.includes('reserve')) return 'reserve';

  if (desc.includes('repasse') || desc.includes('liberação') || desc.includes('liberacao') ||
      desc.includes('payout') || desc.includes('liquidação') || desc.includes('liquidacao')) return 'repasse';

  if (desc.includes('transferência') || desc.includes('transferencia') ||
      desc.includes('ted') || desc.includes('pix') || desc.includes('depósito') || desc.includes('deposito')) return 'transfer';

  if (desc.includes('ajuste') || desc.includes('compensação') || desc.includes('compensacao')) return 'adjustment';

  if (doc.type === 'venda') return 'sale';
  if (doc.type === 'despesa' || doc.type === 'compra') return 'expense';
  // (doc.type as string): 'receita_avulsa' não existe no DocumentType atual — comparação
  // mantida fiel ao classifyEventType de extract.ts (dead-code contra tipo impossível).
  if ((doc.type as string) === 'receita_avulsa' || doc.type === 'receita') return 'revenue';

  if (category?.type === 'financeiro') return 'transfer';

  return 'other';
}

interface DecomposeResult {
  eventKind: FinancialEventKind;
  semanticBreakdown: FinancialCompositionItem[];
  grossAmount: number;
  feesAmount: number;
  freightAmount: number;
  econ: Omit<RecognitionEconomics, 'competenceDateSource' | 'accrualExclusionReason'>;
}

// Decompõe UM documento em itens semânticos a partir dos VALORES DO DOCUMENTO.
function decomposeDocument(
  doc: FinancialDocument,
  eventType: FinancialEventType,
  isEcom: boolean
): DecomposeResult {
  const id = doc.id;
  const total = Math.abs(doc.totalValue || 0);
  const desc = (doc.description || '').toLowerCase();
  const breakdown: FinancialCompositionItem[] = [];

  let eventKind: FinancialEventKind = 'unclassified';
  let grossAmount = 0;
  let feesAmount = 0;
  let freightAmount = 0;
  let documentRecognizedAmount = 0;
  let resultImpactAmount = 0;
  let expectedSettlementAmount: number | undefined = undefined;
  let netOnly: boolean | undefined = undefined;

  // Mesma condição/ordem do realizado: chargeback tem prioridade sobre o atalho de venda.
  if (eventType !== 'chargeback' && (eventType === 'sale' || (isEcom && doc.type === 'venda'))) {
    eventKind = 'sale_settlement';
    grossAmount = isEcom ? (doc.grossAmount && doc.grossAmount > 0 ? doc.grossAmount : total) : total;
    feesAmount = isEcom ? (doc.marketplaceFee || 0) : 0;
    freightAmount = isEcom ? (doc.shippingCost || 0) : 0;
    // netOnly: ecommerce sem bruto explícito → o líquido está sendo usado como bruto.
    netOnly = isEcom && !(doc.grossAmount && doc.grossAmount > 0) ? true : undefined;

    if (grossAmount > 0) {
      breakdown.push(item(`${id}-gross`, 'sale_gross', 'Venda Bruta', grossAmount, 'inflow', true, 1));
    }
    if (feesAmount > 0) {
      breakdown.push(item(`${id}-fee`, 'marketplace_fee', 'Taxa Marketplace', -feesAmount, 'outflow', true, 1));
    }
    if (freightAmount > 0) {
      breakdown.push(item(`${id}-freight`, 'shipping_cost', 'Frete', -freightAmount, 'outflow', true, 1));
    }

    documentRecognizedAmount = grossAmount;                          // âncora = bruto (decisão 1)
    resultImpactAmount = grossAmount - feesAmount - freightAmount;   // soma assinada affectsResult
    // Frete deduz o esperado por ser item outflow que reduz o repasse (decisão 6).
    expectedSettlementAmount = netOnly ? undefined : resultImpactAmount;
  } else if (eventType === 'reserve' || desc.includes('libera')) {
    eventKind = 'reserve_release';
    breakdown.push(item(id, 'reserve_release', 'Liberação de Reserva', total, 'inflow', false, 0.9));
    documentRecognizedAmount = total;
    resultImpactAmount = 0;
  } else if (eventType === 'transfer') {
    eventKind = 'internal_transfer';
    breakdown.push(item(id, 'internal_transfer', 'Transferência', total, 'inflow', false, 0.9));
    documentRecognizedAmount = total;
    resultImpactAmount = 0;
  } else if (eventType === 'chargeback') {
    eventKind = 'chargeback';
    const amount = -total; // devolução/estorno reduz a receita (contra-receita)
    breakdown.push(item(id, 'chargeback', 'Estorno / Chargeback', amount, 'outflow', true, 0.9));
    documentRecognizedAmount = amount;
    resultImpactAmount = amount;
    expectedSettlementAmount = amount;
  } else if (eventType === 'expense') {
    eventKind = 'standalone_expense';
    const amount = -total;
    breakdown.push(item(id, 'manual_expense', doc.description || 'Despesa', amount, 'outflow', true, 0.8));
    documentRecognizedAmount = amount;
    resultImpactAmount = amount;
    expectedSettlementAmount = amount;
  } else if (eventType === 'revenue') {
    eventKind = 'standalone_income';
    const amount = total;
    breakdown.push(item(id, 'manual_income', doc.description || 'Receita', amount, 'inflow', true, 0.8));
    documentRecognizedAmount = amount;
    resultImpactAmount = amount;
    expectedSettlementAmount = amount;
  } else {
    eventKind = 'unclassified';
    breakdown.push(item(id, 'unclassified_movement', doc.description || 'Movimento não classificado', total, 'inflow', false, 0.2));
    documentRecognizedAmount = total;
    resultImpactAmount = 0;
  }

  return {
    eventKind,
    semanticBreakdown: breakdown,
    grossAmount,
    feesAmount,
    freightAmount,
    econ: { documentRecognizedAmount, resultImpactAmount, expectedSettlementAmount, netOnly },
  };
}

function item(
  id: string,
  semanticType: FinancialCompositionItem['semanticType'],
  label: string,
  amount: number,
  direction: FinancialCompositionItem['direction'],
  affectsResult: boolean,
  confidence: number
): FinancialCompositionItem {
  return {
    id,
    semanticType,
    label,
    amount,
    direction,
    affectsCash: false, // accrual: caixa é dimensão do realizado
    affectsResult,
    isTemporary: false,
    confidence,
  };
}

function competenceSource(doc: FinancialDocument, origin: EventOrigin, validCompetence: boolean): CompetenceDateSource {
  if (!validCompetence) return 'unknown_review';
  if (origin === 'manual') return 'user_defined';
  return doc.sourceType ? 'imported' : 'suggested_default';
}

export interface AccrualCompositionResult {
  events: FinancialEvent[];
  metaByDocumentId: Record<string, RecognitionMeta>;
}

export function buildAccrualComposition(
  documents: FinancialDocument[],
  titles: Title[],
  categories: Category[],
  contacts?: Contact[]
): AccrualCompositionResult {
  const events: FinancialEvent[] = [];
  const metaByDocumentId: Record<string, RecognitionMeta> = {};

  const titlesByDoc = new Map<string, Title[]>();
  for (const t of titles) {
    const arr = titlesByDoc.get(t.documentId) || [];
    arr.push(t);
    titlesByDoc.set(t.documentId, arr);
  }

  for (const doc of documents) {
    const category = categories.find((c) => c.id === doc.categoryId);
    const contact = contacts?.find((c) => c.id === doc.contactId);
    const titlesDoDoc = titlesByDoc.get(doc.id) || [];

    const origin = classifyOrigin(doc);
    const isEcom = origin === 'ecommerce';
    const eventType = classifyEventType(doc, category);

    // Elegibilidade / motivo de exclusão explícito (§4.1)
    const validCompetence = DATE_RE.test(doc.competenceDate || '');
    const allCancelled =
      titlesDoDoc.length > 0 && titlesDoDoc.every((t) => t.status === 'cancelado');
    let accrualExclusionReason: AccrualExclusionReason | undefined = undefined;
    if (!validCompetence) accrualExclusionReason = 'unknown_review';
    else if (allCancelled) accrualExclusionReason = 'unknown_review'; // NÃO 'cancelado' (Rev.3 §4.1)

    const eventDate = validCompetence ? doc.competenceDate : doc.createdAt;

    const dec = decomposeDocument(doc, eventType, isEcom);

    const econ: RecognitionEconomics = {
      ...dec.econ,
      competenceDateSource: competenceSource(doc, origin, validCompetence),
      accrualExclusionReason,
    };
    metaByDocumentId[doc.id] = computeRecognitionMeta(doc, titlesDoDoc, econ);

    const hasResultItem = dec.semanticBreakdown.some((i) => i.affectsResult);

    events.push({
      id: doc.id,
      date: eventDate,
      title: (doc.description || 'Movimentação').replace(/\[#[^\]]+\]\s*/, '').replace(/\[⏳[^\]]+\]\s*/, '').trim() || 'Movimentação',
      origin,
      type: dec.econ.resultImpactAmount < 0 ? 'saida' : 'entrada',
      totalAmount: Math.abs(doc.totalValue || 0),
      netAmount: dec.econ.resultImpactAmount,
      affectsResult: hasResultItem,
      affectsCash: false,
      status: accrualExclusionReason ? 'warning' : 'ok',
      items: [],
      documentId: doc.id,
      eventType,
      sourceType: doc.sourceType || (isEcom ? contact?.name : undefined),
      externalReference: doc.referenceId || undefined,
      groupKey: `doc:${doc.id}`,
      grossAmount: dec.grossAmount,
      feesAmount: dec.feesAmount,
      freightAmount: dec.freightAmount,
      reserveAmount: 0,
      contactName: contact?.name,
      eventKind: dec.eventKind,
      resultImpactAmount: dec.econ.resultImpactAmount,
      semanticBreakdown: dec.semanticBreakdown,
    });
  }

  return { events, metaByDocumentId };
}
