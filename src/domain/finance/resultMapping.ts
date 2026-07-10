import { Category } from '@/types/financial';
import { MovementSemanticType, FinancialCompositionItem } from '@/domain/extract';

// ============================================================================
// Fonte única de roteamento do Resultado Gerencial Realizado.
// Princípio: NATUREZA ECONÔMICA primeiro, canal/origem depois.
// Prioridade de decisão (confirmada):
//   1. semanticType forte
//   2. affectsResult
//   3. categoria / type / dreClassification
//   4. nome canônico apenas como último recurso
// ============================================================================

export type ResultLineKey =
  | 'receitaBruta'
  | 'estornosChargebacks'
  | 'taxasDeducoesVenda'
  | 'custosVariaveis'
  | 'despesasOperacionais'
  | 'resultadoFinanceiro'
  | 'outros';

export const RESULT_LINE_LABELS: Record<ResultLineKey, string> = {
  receitaBruta: 'Receita Bruta',
  estornosChargebacks: 'Estornos / Chargebacks',
  taxasDeducoesVenda: 'Taxas e Deduções de Venda',
  custosVariaveis: 'Custos Variáveis',
  despesasOperacionais: 'Despesas Operacionais',
  resultadoFinanceiro: 'Resultado Financeiro',
  outros: 'Outros',
};

export type ExclusionReason =
  | 'affects_result_false'
  | 'low_confidence'
  | 'internal_transfer'
  | 'reserve'
  | 'unclassified'
  | 'pending'
  | 'financial_movement'
  | 'investimento'
  | 'categoria_nao_resolvida';

export type RoutingDecision =
  | { kind: 'line'; line: ResultLineKey; motivo: string }
  | { kind: 'excluded'; reason: ExclusionReason; motivo: string };

// dreClassification efetiva — mesma lógica de fallback de dre.ts/managerialDashboard.ts
export function effectiveDreClass(category: Category | undefined): string | undefined {
  if (!category) return undefined;
  if (category.dreClassification) return category.dreClassification;
  switch (category.type) {
    case 'receita': return 'receita_bruta';
    case 'custo': return 'custo_variavel';
    case 'despesa': return 'despesa_fixa';
    case 'financeiro': return 'financeiro';
    case 'investimento': return 'investimento';
    default: return 'outro';
  }
}

// semanticTypes cuja natureza é forte o suficiente para decidir a linha sozinhos
const STRONG_INCLUDE: Partial<Record<MovementSemanticType, ResultLineKey>> = {
  sale_gross: 'receitaBruta',
  refund: 'estornosChargebacks',
  chargeback: 'estornosChargebacks',
  marketplace_fee: 'taxasDeducoesVenda',
  gateway_fee: 'taxasDeducoesVenda',
  shipping_cost: 'custosVariaveis',
};

// semanticTypes que excluem do resultado independentemente da categoria (decisão B:
// reserve_withheld já basta, sem depender do nome).
const STRONG_EXCLUDE: Partial<Record<MovementSemanticType, ExclusionReason>> = {
  internal_transfer: 'internal_transfer',
  reserve_withheld: 'reserve',
  reserve_release: 'reserve',
  unclassified_movement: 'unclassified',
  net_payout: 'financial_movement',
};

export interface RouteContext {
  isPending?: boolean; // event.eventType === 'pending'
  confidenceThreshold: number;
}

export function routeItem(
  item: FinancialCompositionItem,
  category: Category | undefined,
  ctx: RouteContext
): RoutingDecision {
  const st = item.semanticType;

  // (1) semanticType forte de EXCLUSÃO — antes de qualquer outra checagem
  const strongEx = STRONG_EXCLUDE[st];
  if (strongEx) {
    const reason: ExclusionReason =
      strongEx === 'unclassified' && ctx.isPending ? 'pending' : strongEx;
    return { kind: 'excluded', reason, motivo: `semanticType ${st}` };
  }

  // (2) affectsResult
  if (!item.affectsResult) {
    return { kind: 'excluded', reason: 'affects_result_false', motivo: 'affectsResult=false' };
  }

  // (3) confiança mínima
  if (item.confidence < ctx.confidenceThreshold) {
    return {
      kind: 'excluded',
      reason: 'low_confidence',
      motivo: `confiança ${item.confidence} < ${ctx.confidenceThreshold}`,
    };
  }

  // (1') semanticType forte de INCLUSÃO
  const strongInc = STRONG_INCLUDE[st];
  if (strongInc) {
    // Guard global: movimento negativo nunca pode virar Receita Bruta.
    if (strongInc === 'receitaBruta' && item.amount < 0) {
      return {
        kind: 'excluded',
        reason: 'categoria_nao_resolvida',
        motivo: 'movimento negativo não pode virar receita',
      };
    }
    return { kind: 'line', line: strongInc, motivo: `semanticType ${st}` };
  }

  // Ajuste (decisão D, corrigida): só entra em Outros com confiança ACIMA do limiar.
  // O produtor (extract.ts) emite ajustes automáticos com confidence 0.5 e natureza
  // desconhecida — esses vão para revisão, nunca viram linha silenciosa de Outros.
  if (st === 'adjustment') {
    if (item.confidence <= ctx.confidenceThreshold) {
      return {
        kind: 'excluded',
        reason: 'low_confidence',
        motivo: `ajuste com confiança ${item.confidence} <= ${ctx.confidenceThreshold}`,
      };
    }
    return { kind: 'line', line: 'outros', motivo: 'ajuste com impacto no resultado' };
  }

  // (3') Natureza por categoria — SOMENTE para semanticTypes cuja natureza depende da
  // categoria. Qualquer outro semanticType que chegue aqui NÃO herda a categoria do
  // documento; vai para revisão (evita vazamento de categoria).
  const dependsOnCategory =
    st === 'manual_income' || st === 'manual_expense' || st === 'tax';
  if (!dependsOnCategory) {
    return {
      kind: 'excluded',
      reason: 'categoria_nao_resolvida',
      motivo: `semanticType ${st} sem natureza definida`,
    };
  }

  const eff = effectiveDreClass(category);
  if (!category || !eff) {
    // decisão A: não adivinhar, não descartar em silêncio.
    return {
      kind: 'excluded',
      reason: 'categoria_nao_resolvida',
      motivo: 'categoria não resolvida com confiança',
    };
  }

  // 'tax' tem tratamento próprio: só reduz a receita quando é dedução sobre faturamento;
  // caso contrário é despesa operacional (imposto sobre lucro/folha) ou revisão.
  // 'tax' NUNCA pode virar Receita Bruta.
  if (st === 'tax') {
    if (eff === 'deducao_imposto') {
      return { kind: 'line', line: 'taxasDeducoesVenda', motivo: 'tributo sobre faturamento (dedução de venda)' };
    }
    if (category.type === 'despesa' || eff === 'despesa_fixa') {
      return { kind: 'line', line: 'despesasOperacionais', motivo: 'tributo tratado como despesa operacional' };
    }
    return { kind: 'excluded', reason: 'categoria_nao_resolvida', motivo: 'tributo sem natureza clara' };
  }

  // manual_income / manual_expense
  // Investimento fica fora do resultado operacional (é capital, não P&L).
  if (category.type === 'investimento' || eff === 'investimento') {
    return { kind: 'excluded', reason: 'investimento', motivo: 'natureza de investimento (capital)' };
  }

  // Tributo sobre faturamento reduz a receita.
  if (eff === 'deducao_imposto') {
    return { kind: 'line', line: 'taxasDeducoesVenda', motivo: 'tributo sobre faturamento (dedução de venda)' };
  }

  if (category.type === 'receita' || eff === 'receita_bruta') {
    // Guard global: movimento negativo nunca pode virar Receita Bruta.
    if (item.amount < 0) {
      return {
        kind: 'excluded',
        reason: 'categoria_nao_resolvida',
        motivo: 'movimento negativo não pode virar receita',
      };
    }
    return { kind: 'line', line: 'receitaBruta', motivo: 'categoria de receita' };
  }

  if (category.type === 'custo' || eff === 'custo_variavel') {
    return { kind: 'line', line: 'custosVariaveis', motivo: 'categoria de custo variável' };
  }

  // type despesa entra em Despesas Operacionais mesmo com dreClassification 'outro' (ajuste 3).
  if (category.type === 'despesa' || eff === 'despesa_fixa') {
    return { kind: 'line', line: 'despesasOperacionais', motivo: 'categoria de despesa operacional' };
  }

  if (category.type === 'financeiro' || eff === 'financeiro') {
    // financeiro + dreClassification 'outro' = movimentação financeira neutra
    // (cartão, transferência, retenção) → fora do resultado (decisão B).
    if (category.dreClassification === 'outro') {
      return {
        kind: 'excluded',
        reason: 'financial_movement',
        motivo: 'movimentação financeira neutra (cartão/transferência/retenção)',
      };
    }
    return { kind: 'line', line: 'resultadoFinanceiro', motivo: 'resultado financeiro (juros/tarifas)' };
  }

  if (eff === 'outro') {
    return { kind: 'line', line: 'outros', motivo: 'categoria classificada como outro' };
  }

  return { kind: 'excluded', reason: 'categoria_nao_resolvida', motivo: 'natureza não determinável' };
}
