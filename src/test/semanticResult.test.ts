import { describe, it, expect } from 'vitest';
import { calculateSemanticResult } from '@/domain/finance/semanticResult';
import {
  FinancialEvent,
  FinancialCompositionItem,
  MovementSemanticType,
} from '@/domain/extract';
import { FinanceSnapshot } from '@/services/finance/financeService';
import { Category, FinancialDocument, CategoryType, DREClassification } from '@/types/financial';

const MONTH = '2026-05';

// ---------- Helpers ----------

function makeItem(
  semanticType: MovementSemanticType,
  amount: number,
  over: Partial<FinancialCompositionItem> = {}
): FinancialCompositionItem {
  return {
    id: 'it_' + Math.random().toString(36).slice(2, 8),
    semanticType,
    label: semanticType,
    amount,
    direction: amount >= 0 ? 'inflow' : 'outflow',
    affectsCash: true,
    affectsResult: true,
    isTemporary: false,
    confidence: 1,
    ...over,
  };
}

function makeEvent(
  id: string,
  documentId: string | undefined,
  items: FinancialCompositionItem[],
  over: Partial<FinancialEvent> = {}
): FinancialEvent {
  const net = items.reduce((s, i) => s + i.amount, 0);
  return {
    id,
    date: `${MONTH}-15T12:00:00.000Z`,
    title: id,
    origin: 'ecommerce',
    type: net >= 0 ? 'entrada' : 'saida',
    totalAmount: Math.abs(net),
    netAmount: net,
    affectsResult: true,
    affectsCash: true,
    status: 'ok',
    items: [],
    documentId,
    eventType: 'sale',
    groupKey: `doc:${documentId}`,
    grossAmount: 0,
    feesAmount: 0,
    freightAmount: 0,
    reserveAmount: 0,
    eventKind: 'sale_settlement',
    resultImpactAmount: net,
    semanticBreakdown: items,
    ...over,
  };
}

function cat(id: string, name: string, type: CategoryType, dre?: DREClassification): Category {
  return { id, name, type, dreClassification: dre, isActive: true };
}

function doc(id: string, categoryId: string): FinancialDocument {
  return {
    id,
    type: 'venda',
    contactId: 'c1',
    categoryId,
    competenceDate: `${MONTH}-15`,
    totalValue: 0,
    description: id,
    condition: 'avista',
    installments: 1,
    createdAt: `${MONTH}-15T12:00:00.000Z`,
  };
}

function snapshot(categories: Category[], documents: FinancialDocument[]): FinanceSnapshot {
  return { accounts: [], categories, contacts: [], documents, titles: [], movements: [] };
}

// ---------- Cenário completo (comércio + serviços + híbrido + exclusões) ----------

describe('calculateSemanticResult — cenário completo', () => {
  const categories = [
    cat('cat_venda', 'Venda de Produtos', 'receita', 'receita_bruta'),
    cat('cat_servico', 'Receita de Serviços', 'receita', 'receita_bruta'),
    cat('cat_merc', 'Compra de Mercadorias', 'custo', 'custo_variavel'),
    cat('cat_consultor', 'Consultor Terceirizado', 'custo', 'custo_variavel'),
    cat('cat_desp', 'Despesa Operacional', 'despesa', 'outro'), // dreClass neutro (ajuste anterior)
    cat('cat_fin', 'Juros Bancários', 'financeiro', 'financeiro'),
    cat('cat_card', 'Pagamento de Cartão de Crédito', 'financeiro', 'outro'),
    cat('cat_imposto', 'ISS sobre Venda', 'despesa', 'deducao_imposto'),
    cat('cat_invest', 'Compra de Equipamento', 'investimento', 'investimento'),
  ];

  const documents = [
    doc('d1', 'cat_venda'),
    doc('d2', 'cat_servico'),
    doc('d3', 'cat_merc'),
    doc('d4', 'cat_consultor'),
    doc('d5', 'cat_desp'),
    doc('d6', 'cat_venda'),
    doc('d7', 'cat_card'),
    doc('d11', 'cat_imposto'),
    doc('d12', 'cat_fin'),
    doc('d13', 'cat_invest'),
    // d14 ausente de propósito → categoria_nao_resolvida
  ];

  const events: FinancialEvent[] = [
    // 1. Comércio: venda ML com taxa e frete
    makeEvent('e1', 'd1', [
      makeItem('sale_gross', 100),
      makeItem('marketplace_fee', -10),
      makeItem('shipping_cost', -5),
    ]),
    // 2. Serviços: receita de consultoria (manual_income + categoria receita)
    makeEvent('e2', 'd2', [makeItem('manual_income', 200, { confidence: 0.8 })], {
      eventKind: 'standalone_income',
      eventType: 'revenue',
    }),
    // 3. Compra de mercadorias
    makeEvent('e3', 'd3', [makeItem('manual_expense', -40, { confidence: 0.8 })], {
      eventType: 'expense',
    }),
    // 4. Consultor terceirizado (custo variável de serviço)
    makeEvent('e4', 'd4', [makeItem('manual_expense', -30, { confidence: 0.8 })], {
      eventType: 'expense',
    }),
    // 5. Despesa operacional (despesa + dreClass outro)
    makeEvent('e5', 'd5', [makeItem('manual_expense', -25, { confidence: 0.8 })], {
      eventType: 'expense',
    }),
    // 6. Chargeback
    makeEvent('e6', 'd6', [makeItem('chargeback', -15, { confidence: 0.9 })], {
      eventType: 'chargeback',
    }),
    // 7. Pagamento de cartão (financeiro + outro) → fora
    makeEvent('e7', 'd7', [makeItem('manual_expense', -300, { confidence: 0.8 })], {
      eventType: 'expense',
    }),
    // 8. Transferência interna → fora
    makeEvent('e8', undefined, [
      makeItem('internal_transfer', -500, { affectsResult: false }),
    ]),
    // 9. Reserva retida → fora
    makeEvent('e9', undefined, [
      makeItem('reserve_withheld', -50, { affectsResult: false, isTemporary: true }),
    ]),
    // 10. Pendente/unclassified → fora
    makeEvent('e10', undefined, [
      makeItem('unclassified_movement', 20, { affectsResult: false, confidence: 0.2 }),
    ], { eventType: 'pending' }),
    // 11. Imposto sobre venda (deducao_imposto) → Taxas e Deduções de Venda
    makeEvent('e11', 'd11', [makeItem('manual_expense', -8, { confidence: 0.8 })], {
      eventType: 'expense',
    }),
    // 12. Juros bancário → Resultado Financeiro
    makeEvent('e12', 'd12', [makeItem('manual_expense', -12, { confidence: 0.8 })], {
      eventType: 'expense',
    }),
    // 13. Investimento → fora
    makeEvent('e13', 'd13', [makeItem('manual_expense', -1000, { confidence: 0.8 })], {
      eventType: 'expense',
    }),
    // 14. Categoria não resolvida (documento inexistente) → fora
    makeEvent('e14', 'd14', [makeItem('manual_expense', -9, { confidence: 0.8 })], {
      eventType: 'expense',
    }),
  ];

  const result = calculateSemanticResult(events, snapshot(categories, documents), MONTH);

  it('Receita Bruta soma venda de produto e receita de serviço (natureza, não canal)', () => {
    expect(result.receitaBruta).toBe(300); // 100 + 200
  });

  it('Estornos/Chargebacks tem linha própria (não misturado em impostos)', () => {
    expect(result.estornosChargebacks).toBe(-15);
  });

  it('Taxas e Deduções de Venda = taxa marketplace + imposto sobre venda', () => {
    expect(result.taxasDeducoesVenda).toBe(-18); // -10 (fee) + -8 (ISS)
  });

  it('Receita Líquida = Bruta - Estornos - Taxas', () => {
    expect(result.receitaLiquida).toBe(267); // 300 - 15 - 18
  });

  it('Custos Variáveis funcionam para comércio e serviço (frete + mercadoria + consultor)', () => {
    expect(result.custosVariaveis).toBe(-75); // -5 -40 -30
  });

  it('Margem de Contribuição = Receita Líquida - Custos Variáveis', () => {
    expect(result.margemContribuicao).toBe(192); // 267 - 75
  });

  it('Despesas Operacionais aceitam categoria despesa mesmo com dreClass outro', () => {
    expect(result.despesasOperacionais).toBe(-25);
  });

  it('Resultado Operacional = Margem - Despesas Operacionais', () => {
    expect(result.resultadoOperacional).toBe(167); // 192 - 25
  });

  it('Resultado Financeiro fica separado de Outros', () => {
    expect(result.resultadoFinanceiro).toBe(-12);
    expect(result.outros).toBe(0);
    expect(result.resultadoFinanceiroOutros).toBe(-12);
  });

  it('Resultado do Período fecha pela soma da cascata', () => {
    expect(result.resultadoPeriodo).toBe(155); // 167 - 12 + 0
  });

  it('Cartão, transferência, retenção, pendente, investimento e categoria não resolvida ficam fora', () => {
    const reasons = result.foraDoResultado.map((f) => f.reason).sort();
    expect(reasons).toContain('financial_movement'); // cartão
    expect(reasons).toContain('internal_transfer');
    expect(reasons).toContain('reserve');
    expect(reasons).toContain('pending');
    expect(reasons).toContain('investimento');
    expect(reasons).toContain('categoria_nao_resolvida');
  });

  it('itens não classificados não somem — permanecem rastreáveis em foraDoResultado', () => {
    const card = result.foraDoResultado.find((f) => f.eventId === 'e7');
    expect(card?.reason).toBe('financial_movement');
    expect(card?.amount).toBe(-300);
    const invest = result.foraDoResultado.find((f) => f.eventId === 'e13');
    expect(invest?.reason).toBe('investimento');
  });

  it('meta indica base realizada e microcopy correta', () => {
    expect(result.meta.basis).toBe('realized');
    expect(result.meta.label).toBe('Resultado Gerencial Realizado');
    expect(result.meta.microcopy).toContain('previstos ou ainda não liquidados não estão incluídos');
  });
});

// ---------- Regras específicas ----------

describe('calculateSemanticResult — regras de prioridade e exclusão', () => {
  it('só usa itens com affectsResult === true dentro de um evento com breakdown', () => {
    const categories = [cat('cv', 'Venda', 'receita', 'receita_bruta')];
    const documents = [doc('dx', 'cv')];
    const ev = makeEvent('ex', 'dx', [
      makeItem('sale_gross', 100),
      makeItem('reserve_withheld', -30, { affectsResult: false, isTemporary: true }),
    ]);
    const r = calculateSemanticResult([ev], snapshot(categories, documents), MONTH);
    expect(r.receitaBruta).toBe(100); // reserva ignorada
    expect(r.foraDoResultado.some((f) => f.reason === 'reserve')).toBe(true);
  });

  it('semanticType forte vence a categoria (prioridade 1)', () => {
    // categoria é despesa, mas o item é sale_gross → deve ir para Receita Bruta
    const categories = [cat('cd', 'Despesa qualquer', 'despesa', 'despesa_fixa')];
    const documents = [doc('dd', 'cd')];
    const ev = makeEvent('ep', 'dd', [makeItem('sale_gross', 50)]);
    const r = calculateSemanticResult([ev], snapshot(categories, documents), MONTH);
    expect(r.receitaBruta).toBe(50);
    expect(r.despesasOperacionais).toBe(0);
  });

  it('tax só reduz receita quando a categoria justifica (deducao_imposto)', () => {
    const categories = [
      cat('imp_venda', 'ISS Venda', 'despesa', 'deducao_imposto'),
      cat('imp_lucro', 'Imposto sobre Lucro', 'despesa', 'despesa_fixa'),
    ];
    const documents = [doc('dv', 'imp_venda'), doc('dl', 'imp_lucro')];
    const evVenda = makeEvent('iv', 'dv', [makeItem('manual_expense', -10, { confidence: 0.8 })], { eventType: 'expense' });
    const evLucro = makeEvent('il', 'dl', [makeItem('manual_expense', -20, { confidence: 0.8 })], { eventType: 'expense' });
    const r = calculateSemanticResult([evVenda, evLucro], snapshot(categories, documents), MONTH);
    expect(r.taxasDeducoesVenda).toBe(-10); // só o imposto sobre venda
    expect(r.despesasOperacionais).toBe(-20); // imposto sobre lucro NÃO reduz receita
  });

  it('financeiro genuíno vai para Resultado Financeiro; financeiro+outro fica fora', () => {
    const categories = [
      cat('juros', 'Juros', 'financeiro', 'financeiro'),
      cat('transf', 'Transferência / Retirada', 'financeiro', 'outro'),
    ];
    const documents = [doc('dj', 'juros'), doc('dt', 'transf')];
    const evJ = makeEvent('ej', 'dj', [makeItem('manual_expense', -12, { confidence: 0.8 })], { eventType: 'expense' });
    const evT = makeEvent('et', 'dt', [makeItem('manual_expense', -500, { confidence: 0.8 })], { eventType: 'expense' });
    const r = calculateSemanticResult([evJ, evT], snapshot(categories, documents), MONTH);
    expect(r.resultadoFinanceiro).toBe(-12);
    expect(r.foraDoResultado.find((f) => f.eventId === 'et')?.reason).toBe('financial_movement');
  });

  it('ajuste com affectsResult:true vai para Outros; ajuste de baixa confiança fica fora', () => {
    const categories = [cat('cv', 'Venda', 'receita', 'receita_bruta')];
    const documents = [doc('dz', 'cv')];
    const evOk = makeEvent('aok', 'dz', [makeItem('adjustment', 7, { confidence: 0.8 })]);
    const evLow = makeEvent('alow', 'dz', [makeItem('adjustment', 3, { confidence: 0.2 })]);
    const r = calculateSemanticResult([evOk, evLow], snapshot(categories, documents), MONTH);
    expect(r.outros).toBe(7);
    expect(r.foraDoResultado.find((f) => f.eventId === 'alow')?.reason).toBe('low_confidence');
  });

  it('categoria estorno_devolucao roteia para Estornos/Chargebacks e reduz a Receita Líquida', () => {
    const categories = [
      cat('crev', 'Venda', 'receita', 'receita_bruta'),
      cat('cest', 'Devoluções e Estornos', 'despesa', 'estorno_devolucao'),
    ];
    const documents = [doc('dv', 'crev'), doc('de', 'cest')];
    const events = [
      makeEvent('v', 'dv', [makeItem('sale_gross', 100)]),
      makeEvent('e', 'de', [makeItem('manual_expense', -30, { confidence: 0.8 })], { eventType: 'expense' }),
    ];
    const r = calculateSemanticResult(events, snapshot(categories, documents), MONTH);
    expect(r.receitaBruta).toBe(100);
    expect(r.estornosChargebacks).toBe(-30); // negativo reduz a receita líquida
    expect(r.despesasOperacionais).toBe(0); // não cai em despesas
    expect(r.custosVariaveis).toBe(0);
    expect(r.receitaLiquida).toBe(70); // 100 - 30
  });

  it('não conta em dobro: resultado = soma algébrica das linhas', () => {
    const categories = [
      cat('cv', 'Venda', 'receita', 'receita_bruta'),
      cat('cc', 'Custo', 'custo', 'custo_variavel'),
    ];
    const documents = [doc('dv', 'cv'), doc('dc', 'cc')];
    const events = [
      makeEvent('v', 'dv', [makeItem('sale_gross', 100), makeItem('marketplace_fee', -10)]),
      makeEvent('c', 'dc', [makeItem('manual_expense', -40, { confidence: 0.8 })], { eventType: 'expense' }),
    ];
    const r = calculateSemanticResult(events, snapshot(categories, documents), MONTH);
    const soma =
      r.receitaBruta + r.estornosChargebacks + r.taxasDeducoesVenda +
      r.custosVariaveis + r.despesasOperacionais + r.resultadoFinanceiro + r.outros;
    expect(soma).toBeCloseTo(r.resultadoPeriodo, 2);
    expect(r.resultadoPeriodo).toBe(50); // 100 - 10 - 40
  });

  it('eventos fora do período são ignorados', () => {
    const categories = [cat('cv', 'Venda', 'receita', 'receita_bruta')];
    const documents = [doc('dv', 'cv')];
    const evForaPeriodo = makeEvent('op', 'dv', [makeItem('sale_gross', 999)], {
      date: '2026-04-15T12:00:00.000Z',
    });
    const r = calculateSemanticResult([evForaPeriodo], snapshot(categories, documents), MONTH);
    expect(r.receitaBruta).toBe(0);
  });

  it('adjustment com confiança exatamente no limiar (0.5) vai para revisão, não para Outros', () => {
    const categories = [cat('cv', 'Venda', 'receita', 'receita_bruta')];
    const documents = [doc('dz', 'cv')];
    const ev = makeEvent('a05', 'dz', [makeItem('adjustment', 4, { confidence: 0.5 })]);
    const r = calculateSemanticResult([ev], snapshot(categories, documents), MONTH);
    expect(r.outros).toBe(0);
    expect(r.foraDoResultado.find((f) => f.eventId === 'a05')?.reason).toBe('low_confidence');
  });

  it("'tax' em categoria de receita não vira receitaBruta; vai para revisão", () => {
    const categories = [cat('cv', 'Venda', 'receita', 'receita_bruta')];
    const documents = [doc('dv', 'cv')];
    const ev = makeEvent('tx', 'dv', [makeItem('tax', -8, { confidence: 0.8 })], { eventType: 'expense' });
    const r = calculateSemanticResult([ev], snapshot(categories, documents), MONTH);
    expect(r.receitaBruta).toBe(0);
    expect(r.foraDoResultado.find((f) => f.eventId === 'tx')?.reason).toBe('categoria_nao_resolvida');
  });

  it("'tax' com categoria deducao_imposto vai para Taxas e Deduções de Venda", () => {
    const categories = [cat('imp', 'ISS', 'despesa', 'deducao_imposto')];
    const documents = [doc('di', 'imp')];
    const ev = makeEvent('tx2', 'di', [makeItem('tax', -8, { confidence: 0.8 })], { eventType: 'expense' });
    const r = calculateSemanticResult([ev], snapshot(categories, documents), MONTH);
    expect(r.taxasDeducoesVenda).toBe(-8);
  });

  it('manual_income negativo em categoria receita é excluído (guard de receita negativa)', () => {
    const categories = [cat('cv', 'Venda', 'receita', 'receita_bruta')];
    const documents = [doc('dn', 'cv')];
    const ev = makeEvent('mn', 'dn', [makeItem('manual_income', -50, { confidence: 0.8 })]);
    const r = calculateSemanticResult([ev], snapshot(categories, documents), MONTH);
    expect(r.receitaBruta).toBe(0);
    const ex = r.foraDoResultado.find((f) => f.eventId === 'mn');
    expect(ex?.reason).toBe('categoria_nao_resolvida');
    expect(ex?.motivo).toContain('negativo');
  });

  it('semanticType não mapeado que chega ao roteamento por categoria é excluído (categoria_nao_resolvida)', () => {
    const categories = [cat('cv', 'Venda', 'receita', 'receita_bruta')];
    const documents = [doc('dm', 'cv')];
    // semanticType fora do conjunto conhecido → não pode herdar a categoria do documento
    const ev = makeEvent('mystery', 'dm', [makeItem('future_type' as MovementSemanticType, -5, { confidence: 0.9 })]);
    const r = calculateSemanticResult([ev], snapshot(categories, documents), MONTH);
    expect(r.foraDoResultado.find((f) => f.eventId === 'mystery')?.reason).toBe('categoria_nao_resolvida');
    expect(r.receitaBruta).toBe(0);
    expect(r.despesasOperacionais).toBe(0);
  });
});
