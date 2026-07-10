import { FinanceSnapshot } from '@/services/finance/financeService';
import { FinancialEvent } from '@/domain/extract';
import {
  ResultLineKey,
  ExclusionReason,
  RESULT_LINE_LABELS,
  routeItem,
} from './resultMapping';

// ============================================================================
// Resultado Gerencial REALIZADO (V1)
// Baseado nos eventos financeiros classificados e realizados no período
// (buildFinancialComposition trabalha sobre movimentos realizados).
// Valores previstos / não liquidados NÃO entram.
//
// CONVENÇÃO DE SINAL (importante para a Etapa 2):
//   Todos os campos são somas ASSINADAS dos itens (inflow > 0, outflow < 0).
//   - receitaBruta            → normalmente ≥ 0
//   - estornosChargebacks     → normalmente ≤ 0
//   - taxasDeducoesVenda      → normalmente ≤ 0
//   - custosVariaveis         → normalmente ≤ 0
//   - despesasOperacionais    → normalmente ≤ 0
//   - resultadoFinanceiro     → assinado (+/-)
//   - outros                  → assinado (+/-)
//   A cascata é pura soma; nada é multiplicado por -1 aqui.
// ============================================================================

export interface ResultContributor {
  eventId: string;
  documentId?: string;
  date: string;
  label: string;
  categoryName?: string;
  amount: number;
  origin?: string;
  semanticType: string;
  motivo: string;
}

export interface ResultLine {
  key: ResultLineKey;
  label: string;
  value: number; // soma assinada dos itens da linha
  items: ResultContributor[];
}

export interface ExcludedItem {
  reason: ExclusionReason;
  eventId: string;
  documentId?: string;
  date: string;
  label: string;
  categoryName?: string;
  amount: number;
  semanticType: string;
  motivo: string;
}

export interface SemanticResult {
  receitaBruta: number;
  estornosChargebacks: number;
  taxasDeducoesVenda: number;
  receitaLiquida: number;
  custosVariaveis: number;
  margemContribuicao: number;
  despesasOperacionais: number;
  resultadoOperacional: number;
  resultadoFinanceiro: number;
  outros: number;
  resultadoFinanceiroOutros: number;
  resultadoPeriodo: number;
  // Linhas com itens contribuintes (para o drill-down da Etapa 3)
  linhas: ResultLine[];
  // Itens que ficaram fora do resultado (para os alertas da Etapa 3)
  foraDoResultado: ExcludedItem[];
  meta: {
    basis: 'realized';
    periodo: string;
    confidenceThreshold: number;
    totalAffectsCash: number;
    totalAffectsResult: number;
    label: string;
    microcopy: string;
  };
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;
const RESULT_LABEL = 'Resultado Gerencial Realizado';
const RESULT_MICROCOPY =
  'Baseado nos eventos financeiros classificados e realizados pelo Aurys no período. ' +
  'Valores previstos ou ainda não liquidados não estão incluídos.';

function emptyLine(key: ResultLineKey): ResultLine {
  return { key, label: RESULT_LINE_LABELS[key], value: 0, items: [] };
}

export function calculateSemanticResult(
  events: FinancialEvent[],
  snapshot: FinanceSnapshot,
  monthISO: string,
  options?: { confidenceThreshold?: number }
): SemanticResult {
  const confidenceThreshold = options?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  const buckets: Record<ResultLineKey, ResultLine> = {
    receitaBruta: emptyLine('receitaBruta'),
    estornosChargebacks: emptyLine('estornosChargebacks'),
    taxasDeducoesVenda: emptyLine('taxasDeducoesVenda'),
    custosVariaveis: emptyLine('custosVariaveis'),
    despesasOperacionais: emptyLine('despesasOperacionais'),
    resultadoFinanceiro: emptyLine('resultadoFinanceiro'),
    outros: emptyLine('outros'),
  };

  const foraDoResultado: ExcludedItem[] = [];
  let totalAffectsCash = 0;
  let totalAffectsResult = 0;

  const periodEvents = events.filter((e) => (e.date || '').startsWith(monthISO));

  for (const event of periodEvents) {
    const doc = event.documentId
      ? snapshot.documents.find((d) => d.id === event.documentId)
      : undefined;
    const category = doc
      ? snapshot.categories.find((c) => c.id === doc.categoryId)
      : undefined;
    const isPending = event.eventType === 'pending';

    for (const item of event.semanticBreakdown) {
      // Métricas caixa × resultado (para o alerta de divergência da Etapa 3)
      if (item.affectsCash) totalAffectsCash += item.amount;
      if (item.affectsResult) totalAffectsResult += item.amount;

      const decision = routeItem(item, category, { isPending, confidenceThreshold });

      if (decision.kind === 'line') {
        const line = buckets[decision.line];
        line.value += item.amount;
        line.items.push({
          eventId: event.id,
          documentId: event.documentId,
          date: event.date,
          label: item.label,
          categoryName: category?.name,
          amount: item.amount,
          origin: event.sourceType,
          semanticType: item.semanticType,
          motivo: decision.motivo,
        });
      } else {
        foraDoResultado.push({
          reason: decision.reason,
          eventId: event.id,
          documentId: event.documentId,
          date: event.date,
          label: item.label,
          categoryName: category?.name,
          amount: item.amount,
          semanticType: item.semanticType,
          motivo: decision.motivo,
        });
      }
    }
  }

  const receitaBruta = buckets.receitaBruta.value;
  const estornosChargebacks = buckets.estornosChargebacks.value;
  const taxasDeducoesVenda = buckets.taxasDeducoesVenda.value;
  const receitaLiquida = receitaBruta + estornosChargebacks + taxasDeducoesVenda;
  const custosVariaveis = buckets.custosVariaveis.value;
  const margemContribuicao = receitaLiquida + custosVariaveis;
  const despesasOperacionais = buckets.despesasOperacionais.value;
  const resultadoOperacional = margemContribuicao + despesasOperacionais;
  const resultadoFinanceiro = buckets.resultadoFinanceiro.value;
  const outros = buckets.outros.value;
  const resultadoFinanceiroOutros = resultadoFinanceiro + outros;
  const resultadoPeriodo = resultadoOperacional + resultadoFinanceiroOutros;

  return {
    receitaBruta,
    estornosChargebacks,
    taxasDeducoesVenda,
    receitaLiquida,
    custosVariaveis,
    margemContribuicao,
    despesasOperacionais,
    resultadoOperacional,
    resultadoFinanceiro,
    outros,
    resultadoFinanceiroOutros,
    resultadoPeriodo,
    linhas: [
      buckets.receitaBruta,
      buckets.estornosChargebacks,
      buckets.taxasDeducoesVenda,
      buckets.custosVariaveis,
      buckets.despesasOperacionais,
      buckets.resultadoFinanceiro,
      buckets.outros,
    ],
    foraDoResultado,
    meta: {
      basis: 'realized',
      periodo: monthISO,
      confidenceThreshold,
      totalAffectsCash,
      totalAffectsResult,
      label: RESULT_LABEL,
      microcopy: RESULT_MICROCOPY,
    },
  };
}
