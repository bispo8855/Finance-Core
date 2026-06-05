import { Movement, Title, FinancialDocument, Category, BankAccount, Contact } from '@/types/financial';
import { getPeriodRange, PeriodOption } from '@/lib/dateUtils';
import { parseISO } from 'date-fns';

// ==================== TYPES ====================

export type EventOrigin = 'manual' | 'bank' | 'ecommerce' | 'system';

export type FinancialEventType =
  | 'sale'
  | 'repasse'
  | 'transfer'
  | 'expense'
  | 'revenue'
  | 'reserve'
  | 'chargeback'
  | 'adjustment'
  | 'pending'
  | 'other';

export type FinancialEventStatus = 'ok' | 'warning' | 'problem';

export type FinancialEventKind =
  | 'sale_settlement'
  | 'reserve_release'
  | 'refund'
  | 'chargeback'
  | 'manual_adjustment'
  | 'internal_transfer'
  | 'standalone_income'
  | 'standalone_expense'
  | 'unclassified';

export type MovementSemanticType =
  | 'sale_gross'
  | 'marketplace_fee'
  | 'gateway_fee'
  | 'shipping_cost'
  | 'reserve_withheld'
  | 'reserve_release'
  | 'tax'
  | 'refund'
  | 'chargeback'
  | 'adjustment'
  | 'net_payout'
  | 'manual_income'
  | 'manual_expense'
  | 'internal_transfer'
  | 'unclassified_movement';

export interface FinancialEventItem {
  id: string;
  description: string;
  amount: number;
  type: 'entrada' | 'saida';
  category?: string;
  tag?: string;
  affectsResult: boolean;
}

export interface FinancialCompositionItem {
  id: string;
  semanticType: MovementSemanticType;
  label: string;
  amount: number;
  direction: 'inflow' | 'outflow' | 'neutral';
  affectsCash: boolean;
  affectsResult: boolean;
  isTemporary: boolean;
  sourceMovementId?: string;
  confidence: number;
  explanation?: string;
}

export interface FinancialEvent {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  origin: EventOrigin;
  type: 'entrada' | 'saida' | 'misto';
  totalAmount: number;
  netAmount: number;
  affectsResult: boolean;
  affectsCash: boolean;
  insight?: string;
  status: FinancialEventStatus;
  statusReason?: string;
  items: FinancialEventItem[];
  documentId?: string;

  // V1 Fields
  eventType: FinancialEventType;
  sourceType?: string;
  externalReference?: string;
  groupKey: string;
  grossAmount: number;
  feesAmount: number;
  freightAmount: number;
  reserveAmount: number;
  humanSummary?: string;
  contactName?: string;

  // V2 Semantic Fields
  eventKind: FinancialEventKind;
  resultImpactAmount: number;
  semanticBreakdown: FinancialCompositionItem[];
}

export interface StatementBalances {
  previousBalance: number;
  inflows: number;
  outflows: number;
  finalBalance: number;
}

export interface ExtractStats {
  totalEvents: number;
  totalSales: number;
  totalFees: number;
  totalReserves: number;
  totalPending: number;
  feePercentage: number;
  grossSales: number;
}

// ==================== FORMATTING ====================

const fmt = (v: number) => 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

// ==================== EXECUTIVE SUMMARY ====================

export function buildExtractExecutiveMessage(
  stats: { inflows: number; outflows: number; balance: number },
  extractStats?: ExtractStats
): string {
  const { inflows, outflows } = stats;
  const net = inflows - outflows;

  if (inflows === 0 && outflows === 0) return "Nenhuma movimentação registrada no período selecionado.";

  const parts: string[] = [];

  if (net > 0) {
    parts.push(`Você recebeu ${fmt(net)} líquidos neste período.`);
  } else if (net < 0) {
    parts.push(`O caixa ficou pressionado: saídas superaram entradas em ${fmt(Math.abs(net))}.`);
  } else {
    parts.push("Entradas e saídas ficaram equilibradas neste período.");
  }

  if (extractStats) {
    if (extractStats.totalFees > 0) {
      parts.push(`${fmt(extractStats.totalFees)} foram consumidos em taxas e custos operacionais.`);
    }
    if (extractStats.totalReserves > 0) {
      parts.push(`${fmt(extractStats.totalReserves)} ficaram retidos em reservas temporárias.`);
    }
    if (extractStats.totalPending > 0) {
      parts.push(`${extractStats.totalPending} movimentação(ões) pendente(s) de classificação.`);
    }
    if (extractStats.feePercentage > 0 && extractStats.feePercentage <= 100) {
      parts.push(`Taxas representaram ${extractStats.feePercentage.toFixed(0)}% das vendas brutas.`);
    }
  }

  return parts.join(' ');
}

// ==================== STATEMENT BALANCES ====================

export function calculateStatementBalances(
  movements: Movement[],
  accounts: BankAccount[],
  period: PeriodOption,
  accountId: string
): StatementBalances {
  const { start, end } = getPeriodRange(period);

  let baseOpening = 0;
  if (accountId === 'all') {
    baseOpening = accounts.reduce((sum, acc) => sum + acc.openingBalance, 0);
  } else {
    baseOpening = accounts.find(a => a.id === accountId)?.openingBalance || 0;
  }

  let inflows = 0;
  let outflows = 0;

  movements.forEach(m => {
    const isTargetAccount = accountId === 'all' || m.accountId === accountId;
    if (!isTargetAccount) return;

    const mDate = parseISO(m.paymentDate);

    if ((!start || mDate >= start) && (!end || mDate <= end)) {
      if (m.type === 'entrada') inflows += m.valuePaid;
      else outflows += m.valuePaid;
    }
  });

  const previousBalance = baseOpening;
  const finalBalance = previousBalance + inflows - outflows;

  return { previousBalance, inflows, outflows, finalBalance };
}

// ==================== EVENT TYPE CLASSIFICATION ====================

function classifyEventType(doc: FinancialDocument, category?: Category): FinancialEventType {
  const desc = (doc.description || '').toLowerCase();

  // Pendente de classificação
  if (desc.includes('pendente de classificação') || desc.includes('⏳')) return 'pending';

  // Chargeback / Estorno
  if (desc.includes('chargeback') || desc.includes('estorno') || desc.includes('reembolso')) return 'chargeback';

  // Reserva
  if (desc.includes('reserva') || desc.includes('retenção') || desc.includes('retencao') ||
      desc.includes('bloqueio') || desc.includes('withholding') || desc.includes('reserve')) return 'reserve';

  // Repasse / Transferência
  if (desc.includes('repasse') || desc.includes('liberação') || desc.includes('liberacao') ||
      desc.includes('payout') || desc.includes('liquidação') || desc.includes('liquidacao')) return 'repasse';

  // Transferência bancária
  if (desc.includes('transferência') || desc.includes('transferencia') ||
      desc.includes('ted') || desc.includes('pix') || desc.includes('depósito') || desc.includes('deposito')) return 'transfer';

  // Ajuste
  if (desc.includes('ajuste') || desc.includes('compensação') || desc.includes('compensacao')) return 'adjustment';

  // Venda (por tipo de documento)
  if (doc.type === 'venda') return 'sale';

  // Despesa
  if (doc.type === 'despesa' || doc.type === 'compra') return 'expense';

  // Receita avulsa
  if (doc.type === 'receita_avulsa' || doc.type === 'receita') return 'revenue';

  // Categoria financeira
  if (category?.type === 'financeiro') return 'transfer';

  return 'other';
}

function classifyOrigin(doc: FinancialDocument): EventOrigin {
  if (doc.sourceType) return 'ecommerce';
  if (doc.grossAmount && doc.grossAmount > 0) return 'ecommerce';
  if (doc.referenceId) return 'ecommerce';
  return 'manual';
}

// ==================== IMPACT ANALYSIS ====================

function analyzeImpact(eventType: FinancialEventType): { affectsCash: boolean; affectsResult: boolean } {
  switch (eventType) {
    case 'sale':
    case 'expense':
    case 'revenue':
    case 'chargeback':
      return { affectsCash: true, affectsResult: true };
    case 'transfer':
    case 'reserve':
      return { affectsCash: true, affectsResult: false };
    case 'repasse':
      return { affectsCash: true, affectsResult: false }; // Repasse move caixa, resultado já estava na venda
    case 'pending':
      return { affectsCash: false, affectsResult: false }; // Pendente não impacta nada até classificar
    default:
      return { affectsCash: true, affectsResult: true };
  }
}

// ==================== STATUS ANALYSIS ====================

function analyzeEventStatus(
  doc: FinancialDocument,
  eventType: FinancialEventType,
  category?: Category
): { status: FinancialEventStatus; reason?: string } {
  if (eventType === 'pending') {
    return { status: 'warning', reason: 'Movimentação pendente de classificação. Não impacta DRE até ser resolvida.' };
  }

  if (doc.grossAmount && doc.marketplaceFee) {
    const feeRatio = doc.marketplaceFee / doc.grossAmount;
    if (feeRatio > 0.20) return { status: 'problem', reason: 'Taxas acima de 20% consomem muito da sua margem neste evento.' };
    if (feeRatio >= 0.12) return { status: 'warning', reason: 'Taxas entre 12% e 20%. Atenção ao custo de venda neste canal.' };
  }

  const vagueTerms = ['movimentação', 'teste', 'extra', 'avulso', 'avulsa'];
  const desc = (doc.description || '').toLowerCase();
  if (vagueTerms.some(term => desc.includes(term))) {
    return { status: 'warning', reason: 'Descrição genérica dificulta a análise futura.' };
  }

  if (!category || category.name === 'Sem Categoria') {
    return { status: 'warning', reason: 'Evento sem categoria prejudica a organização do seu DRE.' };
  }

  return { status: 'ok' };
}

// ==================== MICROCOPY ====================

function buildEventMicrocopy(
  eventType: FinancialEventType,
  doc: FinancialDocument,
  netAmount: number,
  movementCount: number,
  eventKind?: FinancialEventKind,
  accountIdFilter?: string
): string | undefined {
  const gross = doc.grossAmount || 0;
  const fees = doc.marketplaceFee || 0;
  const freight = doc.shippingCost || 0;
  const source = doc.sourceType || '';

  if (eventKind === 'reserve_release') {
      return 'Esta liberação aumentou o caixa, mas não representa nova receita.';
  }
  if (eventKind === 'internal_transfer') {
      if (accountIdFilter === 'all') {
          return 'Transferência entre contas. Não altera o caixa consolidado nem o resultado.';
      }
      return 'Transferência entre contas. Não altera o resultado.';
  }
  if (eventKind === 'unclassified') {
      return 'Movimento sem vínculo claro. Revise para classificar ou vincular.';
  }

  switch (eventType) {
    case 'sale': {
      if (fees > 0 && gross > 0) {
        const pct = Math.round((fees / gross) * 100);
        const srcLabel = source ? ` no ${source}` : '';
        return `Venda bruta de ${fmt(gross)}${srcLabel}. Taxas consumiram ${pct}% (${fmt(fees)}).`;
      }
      if (gross > 0) {
        return `Venda de ${fmt(gross)} sem deduções registradas.`;
      }
      return `Venda registrada de ${fmt(netAmount)}.`;
    }

    case 'repasse':
      return source
        ? `Repasse recebido do ${source}.`
        : 'Repasse recebido do marketplace.';

    case 'reserve':
      return 'O marketplace reteve parte do valor temporariamente.';

    case 'expense':
      return `Despesa operacional de ${fmt(netAmount)}.`;

    case 'chargeback':
      return 'Estorno ou chargeback registrado. Impacta caixa e resultado.';

    case 'pending':
      return 'Movimentação pendente de classificação. Classifique para impactar o DRE corretamente.';

    case 'transfer':
      if (accountIdFilter === 'all') {
          return 'Transferência entre contas. Não altera o caixa consolidado nem o resultado.';
      }
      return 'Transferência entre contas. Não altera o resultado.';

    case 'adjustment':
      return 'Ajuste ou compensação financeira.';

    default:
      return undefined;
  }
}

// ==================== TAG MAPPING ====================

function getItemTag(detectedType: string): string | undefined {
  const tagMap: Record<string, string> = {
    'Venda Bruta': 'Venda',
    'Taxa Marketplace': 'Taxa',
    'Frete': 'Frete',
    'Reserva': 'Reserva',
    'Repasse': 'Repasse',
    'Estorno': 'Estorno',
    'Antecipação': 'Antecipação',
    'Ajuste': 'Ajuste',
  };
  return tagMap[detectedType];
}

// ==================== MAIN GROUPING FUNCTION (V2 Engine + Adapter) ====================

export function buildFinancialComposition(
  movements: Movement[],
  titles: Title[],
  documents: FinancialDocument[],
  categories: Category[],
  contacts?: Contact[],
  accountIdFilter: string = 'all'
): FinancialEvent[] {
  // 1. Group movements by documentId (via title)
  const docGroups = new Map<string, { movements: Movement[]; title: Title; doc: FinancialDocument }>();
  const orphanedMovements: Movement[] = [];

  for (const m of movements) {
    const title = titles.find(t => t.id === m.titleId);
    if (!title) {
      orphanedMovements.push(m);
      continue;
    }
    const doc = documents.find(d => d.id === title.documentId);
    if (!doc) {
      orphanedMovements.push(m);
      continue;
    }

    const key = doc.id;
    if (!docGroups.has(key)) {
      docGroups.set(key, { movements: [], title, doc });
    }
    docGroups.get(key)!.movements.push(m);
  }

  // 2. Build events
  const events: FinancialEvent[] = [];

  for (const [docId, group] of docGroups) {
    const { movements: docMovements, title, doc } = group;
    const category = categories.find(c => c.id === doc.categoryId);
    const contact = contacts?.find(c => c.id === doc.contactId);

    // V1 Classifications
    const eventType = classifyEventType(doc, category);
    const origin = classifyOrigin(doc);
    const impact = analyzeImpact(eventType);
    const { status, reason } = analyzeEventStatus(doc, eventType, category);

    // Aggregate movement values
    const totalPaid = docMovements.reduce((sum, m) =>
      sum + (m.type === 'entrada' ? m.valuePaid : -m.valuePaid), 0
    );
    const totalAbsolute = docMovements.reduce((sum, m) => sum + m.valuePaid, 0);
    const movementType: 'entrada' | 'saida' | 'misto' =
      docMovements.every(m => m.type === 'entrada') ? 'entrada' :
      docMovements.every(m => m.type === 'saida') ? 'saida' : 'misto';

    const isEcom = origin === 'ecommerce';
    let grossAmount = isEcom ? (doc.grossAmount || doc.totalValue) : 0;
    let feesAmount = isEcom ? (doc.marketplaceFee || 0) : 0;
    let freightAmount = isEcom ? (doc.shippingCost || 0) : 0;
    let reserveAmount = 0;

    // V2 SEMANTIC CLASSIFICATION
    let eventKind: FinancialEventKind = 'unclassified';
    let resultImpactAmount = 0;
    const semanticBreakdown: FinancialCompositionItem[] = [];

    if (eventType === 'sale' || (isEcom && doc.type === 'venda')) {
      eventKind = 'sale_settlement';
      
      if (!isEcom) {
          grossAmount = totalAbsolute; 
      } else if (grossAmount === 0 && totalAbsolute > 0) {
          grossAmount = totalAbsolute;
      }
      
      resultImpactAmount = grossAmount - feesAmount - freightAmount;
      
      if (grossAmount > 0) {
        semanticBreakdown.push({
          id: `${docId}-gross`,
          semanticType: 'sale_gross',
          label: 'Venda Bruta',
          amount: grossAmount,
          direction: 'inflow',
          affectsCash: true,
          affectsResult: true,
          isTemporary: false,
          confidence: 1
        });
      }
      if (feesAmount > 0) {
        semanticBreakdown.push({
          id: `${docId}-fee`,
          semanticType: 'marketplace_fee',
          label: 'Taxa Marketplace',
          amount: -feesAmount,
          direction: 'outflow',
          affectsCash: true,
          affectsResult: true,
          isTemporary: false,
          confidence: 1
        });
      }
      if (freightAmount > 0) {
        semanticBreakdown.push({
          id: `${docId}-freight`,
          semanticType: 'shipping_cost',
          label: 'Frete',
          amount: -freightAmount,
          direction: 'outflow',
          affectsCash: true,
          affectsResult: true,
          isTemporary: false,
          confidence: 1
        });
      }
      
      const itemsSum = semanticBreakdown.reduce((acc, i) => acc + i.amount, 0);
      if (Math.abs(totalPaid - itemsSum) > 0.01 && totalAbsolute > 0) {
         const diff = totalPaid - itemsSum;
         if (diff < 0) {
            reserveAmount = Math.abs(diff);
            semanticBreakdown.push({
              id: `${docId}-reserve`,
              semanticType: 'reserve_withheld',
              label: 'Reserva Temporária',
              amount: diff,
              direction: 'outflow',
              affectsCash: true,
              affectsResult: false,
              isTemporary: true,
              confidence: 0.8,
              explanation: 'R$ ' + Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' ficaram retidos e não caíram no caixa.'
            });
         } else {
            semanticBreakdown.push({
              id: `${docId}-adj`,
              semanticType: 'adjustment',
              label: 'Outros ajustes',
              amount: diff,
              direction: 'inflow',
              affectsCash: true,
              affectsResult: true,
              isTemporary: false,
              confidence: 0.5
            });
            resultImpactAmount += diff;
         }
      }
    } else if (eventType === 'reserve' || doc.description.toLowerCase().includes('libera')) {
      eventKind = 'reserve_release';
      resultImpactAmount = 0; 
      semanticBreakdown.push({
        id: docId,
        semanticType: 'reserve_release',
        label: 'Liberação de Reserva',
        amount: totalPaid,
        direction: totalPaid > 0 ? 'inflow' : 'outflow',
        affectsCash: true,
        affectsResult: false,
        isTemporary: false,
        confidence: 0.9,
        explanation: 'Esta liberação aumentou o caixa, mas não representa nova receita.'
      });
    } else if (eventType === 'transfer') {
      eventKind = 'internal_transfer';
      resultImpactAmount = 0;
      semanticBreakdown.push({
        id: docId,
        semanticType: 'internal_transfer',
        label: totalPaid > 0 ? 'Transferência recebida' : 'Transferência enviada',
        amount: totalPaid,
        direction: totalPaid > 0 ? 'inflow' : 'outflow',
        affectsCash: accountIdFilter !== 'all', 
        affectsResult: false,
        isTemporary: false,
        confidence: 0.9,
        explanation: 'Movimentação entre contas bancárias.'
      });
    } else if (eventType === 'chargeback') {
      eventKind = 'chargeback';
      resultImpactAmount = totalPaid; 
      semanticBreakdown.push({
        id: docId,
        semanticType: 'chargeback',
        label: 'Estorno / Chargeback',
        amount: totalPaid,
        direction: 'outflow',
        affectsCash: true,
        affectsResult: true,
        isTemporary: false,
        confidence: 0.9
      });
    } else if (eventType === 'expense') {
      eventKind = 'standalone_expense';
      resultImpactAmount = totalPaid;
      semanticBreakdown.push({
        id: docId,
        semanticType: 'manual_expense',
        label: doc.description || 'Despesa',
        amount: totalPaid,
        direction: 'outflow',
        affectsCash: true,
        affectsResult: true,
        isTemporary: false,
        confidence: 0.8
      });
    } else if (eventType === 'revenue') {
      eventKind = 'standalone_income';
      resultImpactAmount = totalPaid;
      semanticBreakdown.push({
        id: docId,
        semanticType: 'manual_income',
        label: doc.description || 'Receita',
        amount: totalPaid,
        direction: 'inflow',
        affectsCash: true,
        affectsResult: true,
        isTemporary: false,
        confidence: 0.8
      });
    } else {
      eventKind = 'unclassified';
      resultImpactAmount = 0;
      semanticBreakdown.push({
        id: docId,
        semanticType: 'unclassified_movement',
        label: doc.description || 'Movimento não classificado',
        amount: totalPaid,
        direction: totalPaid > 0 ? 'inflow' : 'outflow',
        affectsCash: true,
        affectsResult: false,
        isTemporary: false,
        confidence: 0.2,
        explanation: 'Movimento sem vínculo claro. Revise para classificar ou vincular.'
      });
    }

    // V1 items mapping (Adapter)
    const items: FinancialEventItem[] = semanticBreakdown.map(sb => ({
      id: sb.id,
      description: sb.label,
      amount: sb.amount,
      type: sb.direction === 'inflow' ? 'entrada' : 'saida',
      category: category?.name,
      tag: getItemTag(sb.label) || 'Outro',
      affectsResult: sb.affectsResult
    }));

    // Insight
    let insight: string | undefined;
    if (isEcom && feesAmount > 0 && grossAmount > 0) {
      const feePercent = Math.round((feesAmount / grossAmount) * 100);
      insight = `Taxas consumiram ${feePercent}% desta venda`;
    } else if (eventKind === 'unclassified') {
      insight = 'Movimento sem vínculo claro. Revise para classificar ou vincular.';
    } else if (eventKind === 'reserve_release') {
      insight = 'Valor liberado de reserva temporária.';
    } else if (eventKind === 'internal_transfer') {
      insight = 'Transferência entre contas.';
    }

    const humanSummary = buildEventMicrocopy(eventType, doc, totalPaid, docMovements.length, eventKind, accountIdFilter);

    let eventTitle = doc.description || 'Movimentação';
    eventTitle = eventTitle.replace(/\[#[^\]]+\]\s*/, '').replace(/\[⏳[^\]]+\]\s*/, '').trim();
    if (!eventTitle) eventTitle = 'Movimentação';

    let subtitle = '';
    if (title.totalInstallments > 1) {
      subtitle = `Parcela ${title.installment}/${title.totalInstallments}`;
    }

    const latestDate = docMovements.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0]?.paymentDate || title.dueDate;

    events.push({
      id: docId,
      date: latestDate,
      title: eventTitle,
      subtitle,
      origin,
      type: movementType,
      totalAmount: totalAbsolute,
      netAmount: totalPaid,
      affectsResult: eventKind === 'unclassified' ? false : impact.affectsResult,
      affectsCash: impact.affectsCash,
      insight,
      status,
      statusReason: reason,
      items,
      documentId: docId,
      eventType,
      sourceType: doc.sourceType || (isEcom ? contact?.name : undefined),
      externalReference: doc.referenceId || undefined,
      groupKey: `doc:${docId}`,
      grossAmount,
      feesAmount,
      freightAmount,
      reserveAmount,
      humanSummary,
      contactName: contact?.name,
      // V2
      eventKind,
      resultImpactAmount,
      semanticBreakdown
    });
  }

  // 3. Handle orphaned movements
  for (const m of orphanedMovements) {
    const amount = m.valuePaid * (m.type === 'saida' ? -1 : 1);
    
    events.push({
      id: m.id,
      date: m.paymentDate,
      title: m.notes || 'Movimentação sem documento',
      origin: 'system',
      type: m.type,
      totalAmount: m.valuePaid,
      netAmount: amount,
      affectsResult: false, 
      affectsCash: true,
      status: 'warning',
      statusReason: 'Movimento sem vínculo claro. Revise para classificar ou vincular.',
      items: [{
        id: m.id,
        description: m.notes || 'Movimento não classificado',
        amount: amount,
        type: m.type,
        affectsResult: false
      }],
      eventType: 'other',
      groupKey: `orphan:${m.id}`,
      grossAmount: 0,
      feesAmount: 0,
      freightAmount: 0,
      reserveAmount: 0,
      humanSummary: 'Movimento sem vínculo claro. Revise para classificar ou vincular.',
      eventKind: 'unclassified',
      resultImpactAmount: 0,
      semanticBreakdown: [{
        id: m.id,
        semanticType: 'unclassified_movement',
        label: m.notes || 'Movimento não classificado',
        amount: amount,
        direction: m.type === 'entrada' ? 'inflow' : 'outflow',
        affectsCash: true,
        affectsResult: false,
        isTemporary: false,
        confidence: 0.1,
        explanation: 'Movimento sem vínculo claro. Revise para classificar ou vincular.'
      }]
    });
  }

  events.sort((a, b) => b.date.localeCompare(a.date));
  return events;
}

export const groupMovementsIntoEvents = buildFinancialComposition;

// ==================== EXTRACT STATS ====================

export function calculateExtractStats(events: FinancialEvent[]): ExtractStats {
  let totalSales = 0;
  let totalFees = 0;
  let totalReserves = 0;
  let grossSales = 0;
  let totalPending = 0;

  for (const ev of events) {
    if (ev.eventType === 'sale') {
      totalSales++;
      grossSales += ev.grossAmount;
      totalFees += ev.feesAmount;
    }
    if (ev.eventType === 'reserve') {
      totalReserves += Math.abs(ev.netAmount);
    }
    if (ev.eventType === 'pending') {
      totalPending++;
    }
    // Also count fees from non-sale ecommerce events
    if (ev.eventType !== 'sale' && ev.feesAmount > 0) {
      totalFees += ev.feesAmount;
    }
  }

  return {
    totalEvents: events.length,
    totalSales,
    totalFees,
    totalReserves,
    totalPending,
    feePercentage: grossSales > 0 ? (totalFees / grossSales) * 100 : 0,
    grossSales
  };
}
