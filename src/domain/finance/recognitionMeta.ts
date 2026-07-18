import { FinancialDocument, Title } from '@/types/financial';

// ============================================================================
// Etapa C1 — Metadados de reconhecimento econômico (base 'accrual').
// Contrato fechado na Rev.3 do desenho técnico (docs/etapa-c1-desenho-tecnico.md).
//
// Princípios honrados aqui:
//  - Três dimensões econômicas DISTINTAS (recognized / resultImpact / expected),
//    nunca colapsadas num número só.
//  - Todos os valores monetários são ASSINADOS
//    (receita/contas a receber > 0 ; despesa/contas a pagar < 0).
//  - Liquidação pertence ao DOCUMENTO (via títulos), não ao item semântico.
//  - Sem soma cega de títulos: renegociado e cancelado são excluídos de settled/open.
//  - RecognitionMeta NUNCA entra na soma da cascata — é rastreabilidade.
// ============================================================================

export type ResultBasis = 'realized' | 'accrual';

export type CompetenceDateSource =
  | 'user_defined'
  | 'imported'
  | 'suggested_default'
  | 'unknown_review';

// V1 emite apenas 'unknown_review'. 'cancelado' fica RESERVADO para quando existir
// sinal de cancelamento em nível de documento (o schema atual não tem — Rev.3 §4.1).
export type AccrualExclusionReason = 'cancelado' | 'unknown_review';

export interface RecognitionMeta {
  documentId: string;

  // Três dimensões econômicas distintas
  documentRecognizedAmount: number;    // valor econômico PRINCIPAL do documento (item-âncora)
  resultImpactAmount: number;          // soma assinada dos itens affectsResult === true
  expectedSettlementAmount?: number;   // caixa líquido que o documento espera movimentar (quando determinável)

  // Eixo da liquidação (títulos)
  documentSettledAmount: number;       // efetivamente liquidado (assinado)
  documentOpenAmount: number;          // ainda em aberto (assinado)
  unexplainedDiff?: number;            // divergência documento × títulos (§3.7)

  settlementStatus: 'settled' | 'partial' | 'open' | 'untracked';
  recognitionBasis: ResultBasis;       // sempre 'accrual' na V1

  accrualExclusionReason?: AccrualExclusionReason;

  dataQuality: {
    competenceDateSource: CompetenceDateSource;
    netOnly?: boolean;
  };
}

// Valores econômicos vindos da composição (accrualComposition), já assinados.
export interface RecognitionEconomics {
  documentRecognizedAmount: number;
  resultImpactAmount: number;
  expectedSettlementAmount?: number;
  competenceDateSource: CompetenceDateSource;
  netOnly?: boolean;
  accrualExclusionReason?: AccrualExclusionReason;
}

const SETTLED_STATUS = new Set<Title['status']>(['pago', 'recebido']);
const OPEN_STATUS = new Set<Title['status']>(['previsto', 'atrasado']); // 'atrasado' (vencido) = aberto
// 'renegociado' e 'cancelado' NÃO são rastreáveis (excluídos de settled e open).

function inferSide(doc: FinancialDocument): 'receber' | 'pagar' {
  return doc.type === 'venda' || doc.type === 'receita' ? 'receber' : 'pagar';
}

function titleSign(t: Title, doc: FinancialDocument): 1 | -1 {
  const side = t.side ?? inferSide(doc);
  return side === 'receber' ? 1 : -1;
}

const EPS = 0.005;

/**
 * Calcula o RecognitionMeta de UM documento a partir dos seus títulos e dos
 * valores econômicos já decompostos pela composição. Puro, sem I/O.
 */
export function computeRecognitionMeta(
  doc: FinancialDocument,
  titlesDoDoc: Title[],
  econ: RecognitionEconomics
): RecognitionMeta {
  let documentSettledAmount = 0;
  let documentOpenAmount = 0;
  let settledCount = 0;
  let openCount = 0;

  for (const t of titlesDoDoc) {
    if (SETTLED_STATUS.has(t.status)) {
      documentSettledAmount += titleSign(t, doc) * t.value;
      settledCount += 1;
    } else if (OPEN_STATUS.has(t.status)) {
      documentOpenAmount += titleSign(t, doc) * t.value;
      openCount += 1;
    }
    // renegociado / cancelado → ignorados (§3.6)
  }

  const trackable = settledCount + openCount;
  let settlementStatus: RecognitionMeta['settlementStatus'];
  if (trackable === 0) {
    settlementStatus = 'untracked';
  } else if (openCount === 0) {
    settlementStatus = 'settled';
  } else if (settledCount === 0) {
    settlementStatus = 'open';
  } else {
    settlementStatus = 'partial';
  }

  const meta: RecognitionMeta = {
    documentId: doc.id,
    documentRecognizedAmount: econ.documentRecognizedAmount,
    resultImpactAmount: econ.resultImpactAmount,
    expectedSettlementAmount: econ.expectedSettlementAmount,
    documentSettledAmount,
    documentOpenAmount,
    settlementStatus,
    recognitionBasis: 'accrual',
    accrualExclusionReason: econ.accrualExclusionReason,
    dataQuality: {
      competenceDateSource: econ.competenceDateSource,
      netOnly: econ.netOnly,
    },
  };

  // Divergência documento × títulos — só quando há expectativa determinável e há o que reconciliar.
  if (econ.expectedSettlementAmount !== undefined && settlementStatus !== 'untracked') {
    const diff = econ.expectedSettlementAmount - (documentSettledAmount + documentOpenAmount);
    if (Math.abs(diff) >= EPS) meta.unexplainedDiff = diff;
  }

  return meta;
}
