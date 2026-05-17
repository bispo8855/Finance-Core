import re

with open('src/domain/extract.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the types at the top
types_replacement = """// ==================== TYPES ====================

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
"""

content = re.sub(r'// ==================== TYPES ====================.*?export interface StatementBalances', types_replacement + '\nexport interface StatementBalances', content, flags=re.DOTALL)

# Update buildEventMicrocopy
microcopy_replacement = """function buildEventMicrocopy(
  eventType: FinancialEventType,
  doc: FinancialDocument,
  netAmount: number,
  movementCount: number,
  eventKind?: FinancialEventKind
): string | undefined {
  const gross = doc.grossAmount || 0;
  const fees = doc.marketplaceFee || 0;
  const freight = doc.shippingCost || 0;
  const source = doc.sourceType || '';

  if (eventKind === 'reserve_release') {
      return 'Esta liberação aumentou o caixa, mas não representa nova receita.';
  }
  if (eventKind === 'internal_transfer') {
      return 'Transferência entre contas não altera o resultado.';
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
"""
content = re.sub(r'function buildEventMicrocopy\([\s\S]*?case \'sale\': \{[\s\S]*?if \(gross > 0\) \{[\s\S]*?return `Venda de \$\{fmt\(gross\)\} sem deduções registradas\.`;\n      \}\n      return `Venda registrada de \$\{fmt\(netAmount\)\}\.`;\n    \}', microcopy_replacement, content)

# Replace groupMovementsIntoEvents completely
group_replacement = """// ==================== MAIN GROUPING FUNCTION (V2 Engine + Adapter) ====================

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
      
      const itemsSum = semanticBreakdown.reduce((acc, i) => acc + (i.direction === 'inflow' ? i.amount : i.amount), 0); // Wait, amounts are already negative? I pushed -feesAmount. Let's sum as is.
      if (Math.abs(totalPaid - itemsSum) > 0.01 && totalAbsolute > 0) {
         const diff = totalPaid - itemsSum;
         const isReserve = doc.description.toLowerCase().includes('reserva') || eventType === 'reserve';
         if (isReserve) {
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
              explanation: 'R$ ' + Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' ficaram temporariamente retidos e ainda não caíram no caixa.'
            });
         } else {
            semanticBreakdown.push({
              id: `${docId}-adj`,
              semanticType: 'adjustment',
              label: 'Outros ajustes',
              amount: diff,
              direction: diff > 0 ? 'inflow' : 'outflow',
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
        label: 'Transferência Interna',
        amount: totalPaid,
        direction: totalPaid > 0 ? 'inflow' : 'outflow',
        affectsCash: accountIdFilter !== 'all', 
        affectsResult: false,
        isTemporary: false,
        confidence: 0.9,
        explanation: 'Transferência entre contas não altera o resultado.'
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
      resultImpactAmount = totalPaid;
      semanticBreakdown.push({
        id: docId,
        semanticType: 'unclassified_movement',
        label: doc.description || 'Movimento não classificado',
        amount: totalPaid,
        direction: totalPaid > 0 ? 'inflow' : 'outflow',
        affectsCash: true,
        affectsResult: true,
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

    const humanSummary = buildEventMicrocopy(eventType, doc, totalPaid, docMovements.length, eventKind);

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
      affectsResult: impact.affectsResult,
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
      affectsResult: true, 
      affectsCash: true,
      status: 'warning',
      statusReason: 'Movimento sem vínculo claro. Revise para classificar ou vincular.',
      items: [{
        id: m.id,
        description: m.notes || 'Movimento não classificado',
        amount: amount,
        type: m.type,
        affectsResult: true
      }],
      eventType: 'other',
      groupKey: `orphan:${m.id}`,
      grossAmount: 0,
      feesAmount: 0,
      freightAmount: 0,
      reserveAmount: 0,
      humanSummary: 'Movimento sem vínculo claro. Revise para classificar ou vincular.',
      eventKind: 'unclassified',
      resultImpactAmount: amount,
      semanticBreakdown: [{
        id: m.id,
        semanticType: 'unclassified_movement',
        label: m.notes || 'Movimento não classificado',
        amount: amount,
        direction: m.type === 'entrada' ? 'inflow' : 'outflow',
        affectsCash: true,
        affectsResult: true,
        isTemporary: false,
        confidence: 0.1,
        explanation: 'Movimento sem vínculo claro. Revise para classificar ou vincular.'
      }]
    });
  }

  events.sort((a, b) => b.date.localeCompare(a.date));
  return events;
}

// For compatibility, export groupMovementsIntoEvents pointing to buildFinancialComposition
export const groupMovementsIntoEvents = buildFinancialComposition;
"""
content = re.sub(r'// ==================== MAIN GROUPING FUNCTION ====================[\s\S]*?return events;\n\}', group_replacement, content)

with open('src/domain/extract.ts', 'w', encoding='utf-8') as f:
    f.write(content)
