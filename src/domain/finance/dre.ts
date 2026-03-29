import { FinancialDocument, Category } from '@/types/financial';

export interface DREResult {
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  custosVariaveis: number;
  margemContribuicao: number;
  despesasFixas: number;
  resultadoOperacional: number;
  financeiro: number;
  resultadoLiquido: number;
  top5: { name: string; value: number }[];
  top5Insight: string | null;
  actionPlan: { primary: string; alternative?: string; reasoning?: string } | null;
  diagnostics: { type: 'positive' | 'warning' | 'negative'; text: string }[];
  riskState: 'saudavel' | 'atencao' | 'critico';
  kpis: {
    margemPercentual: number;
    despesasFixasPercentual: number;
    breakEven: number;
  };
}

function getDreClass(category: Category): string {
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

export function calculateDRE({
  documents,
  categories,
  monthISO
}: {
  documents: FinancialDocument[];
  categories: Category[];
  monthISO: string; // Ex: '2026-02'
}): DREResult {
  const monthDocs = documents.filter(d => d.competenceDate.startsWith(monthISO));

  const dreTotal = (dClass: string) => monthDocs
    .filter(d => {
      const c = categories.find(cat => cat.id === d.categoryId);
      return c ? getDreClass(c) === dClass : false;
    })
    .reduce((acc, d) => acc + d.totalValue, 0);

  const receitaBruta = dreTotal('receita_bruta');
  const deducoes = dreTotal('deducao_imposto');
  const receitaLiquida = receitaBruta - deducoes;
  const custosVariaveis = dreTotal('custo_variavel');
  const margemContribuicao = receitaLiquida - custosVariaveis;
  const despesasFixas = dreTotal('despesa_fixa');
  const resultadoOperacional = margemContribuicao - despesasFixas;
  const financeiro = dreTotal('financeiro');
  const resultadoLiquido = resultadoOperacional - financeiro;

  const gastosPorCategoria: Record<string, number> = {};
  monthDocs
    .filter(d => {
      const c = categories.find(cat => cat.id === d.categoryId);
      if (!c) return false;
      const dClass = getDreClass(c);
      return ['custo_variavel', 'despesa_fixa', 'financeiro'].includes(dClass);
    })
    .forEach(d => {
      gastosPorCategoria[d.categoryId] = (gastosPorCategoria[d.categoryId] || 0) + d.totalValue;
    });

  const top5 = Object.entries(gastosPorCategoria)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([catId, value]) => ({
      name: categories.find(c => c.id === catId)?.name || 'Desconhecida',
      value
    }));

  const diagnostics: { type: 'positive' | 'warning' | 'negative'; text: string }[] = [];

  if (receitaLiquida === 0) {
    diagnostics.push({ type: 'warning', text: 'Sem faturamento suficiente no período para gerar um diagnóstico estrutural.' });
  } else {
    // 1. Resultado
    if (resultadoOperacional < 0) {
      diagnostics.push({ type: 'negative', text: 'O negócio fechou o período no prejuízo.' });
    } else if (resultadoOperacional / receitaLiquida > 0.2) {
      diagnostics.push({ type: 'positive', text: 'A operação consolidou alta lucratividade neste período.' });
    } else {
      diagnostics.push({ type: 'warning', text: 'A operação deu lucro, mas a sobra real na última linha é apertada.' });
    }

    // 2. Estrutura Fixa
    if (despesasFixas > receitaLiquida) {
      diagnostics.push({ type: 'negative', text: 'O custo fixo está maior do que o faturamento consegue sustentar.' });
    } else if (despesasFixas > margemContribuicao) {
      diagnostics.push({ type: 'warning', text: 'As despesas fixas estão asfixiando todo o lucro gerado pelas vendas.' });
    } else {
      diagnostics.push({ type: 'positive', text: 'O peso da estrutura fixa frente às vendas está muito bem dimensionado.' });
    }

    // 3. Margem
    if (margemContribuicao < 0) {
      diagnostics.push({ type: 'negative', text: 'Margem negativa: os custos diretos para vender superaram as próprias vendas.' });
    } else if (margemContribuicao / receitaLiquida > 0.5) {
      diagnostics.push({ type: 'positive', text: 'A operação tem excelente margem e eficiência nos custos diretos.' });
    } else {
      diagnostics.push({ type: 'warning', text: 'Margem muito esticada. Otimizar custos operacionais diretos traria fôlego.' });
    }
  }

  const margemPercentual = receitaLiquida > 0 ? (margemContribuicao / receitaLiquida) : 0;
  const despesasFixasPercentual = receitaLiquida > 0 ? (despesasFixas / receitaLiquida) : 0;
  const breakEven = margemPercentual > 0 ? (despesasFixas / margemPercentual) : 0;

  const kpis = {
    margemPercentual,
    despesasFixasPercentual,
    breakEven
  };

  let riskState: 'saudavel' | 'atencao' | 'critico' = 'saudavel';
  if (resultadoLiquido < 0) {
    riskState = 'critico';
  } else if (receitaLiquida > 0 && despesasFixasPercentual > 0.8) {
    riskState = 'atencao';
  }

  let top5Insight: string | null = null;
  const totalDespesas = custosVariaveis + despesasFixas + financeiro;
  if (top5.length > 0 && totalDespesas > 0) {
    const maiorCat = top5[0];
    const pct = (maiorCat.value / totalDespesas) * 100;
    top5Insight = `A categoria "${maiorCat.name}" representa ${pct.toFixed(1)}% das despesas totais.`;
    if (pct > 50) {
      top5Insight += ' Essa categoria concentra quase todo o custo e é o principal ponto de pressão no resultado.';
    }
  }

  // PLANO DE AÇÃO AUTOMÁTICO
  let actionPlan: { primary: string; alternative?: string; reasoning?: string } | null = null;
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format;

  if (receitaLiquida === 0) {
    if (resultadoLiquido < 0) {
      actionPlan = {
        primary: "Operação sem receita no período, gerando apenas queima de caixa.",
        alternative: "Revise urgentemente os custos fixos para minimizar o déficit.",
        reasoning: "Sem faturamento, qualquer despesa tem impacto direto e integral no prejuízo."
      };
    } else {
      actionPlan = {
        primary: "Sem movimentação suficiente para gerar um plano de ação detalhado.",
        reasoning: "Registre suas receitas e despesas para obter diretrizes automáticas."
      };
    }
  } else {
    actionPlan = {} as NonNullable<typeof actionPlan>;
    const resultadoPercentual = receitaLiquida > 0 ? (resultadoLiquido / receitaLiquida) : 0;
    
    if (resultadoLiquido < 0) {
      const deficit = Math.abs(resultadoLiquido);
      const receitaNecessaria = margemPercentual > 0 ? (deficit / margemPercentual) : deficit;
      
      actionPlan!.primary = `Reduza custos fixos em aproximadamente ${fmt(deficit)} para atingir o equilíbrio.`;
      actionPlan!.alternative = `Ou aumente a receita em aproximadamente ${fmt(receitaNecessaria)} mantendo a estrutura atual.`;
      
      if (margemPercentual > 0.5) {
        actionPlan!.reasoning = "Como a margem é alta, aumentar receita é mais eficiente do que cortar custos.";
      } else {
        actionPlan!.reasoning = "Como a margem está pressionada, priorize revisão de custos antes do crescimento.";
      }
    } else if (resultadoLiquido > 0 && resultadoPercentual <= 0.2) {
      actionPlan!.primary = "A operação é lucrativa, mas com baixa sobra. Revise custos para ganhar eficiência.";
      actionPlan!.alternative = "Pequenos ganhos de receita podem aumentar significativamente o resultado final.";
      actionPlan!.reasoning = "Margem líquida apertada deixa o negócio vulnerável a imprevistos.";
    } else if (resultadoPercentual > 0.2) {
      actionPlan!.primary = "Operação saudável. Avalie reinvestir para crescimento.";
      actionPlan!.alternative = "Monitore custos fixos para manter a rentabilidade atual.";
      actionPlan!.reasoning = "Com alta rentabilidade, focar em escala pode multiplicar os resultados.";
    }
  }

  return {
    receitaBruta, deducoes, receitaLiquida, custosVariaveis, margemContribuicao,
    despesasFixas, resultadoOperacional, financeiro, resultadoLiquido, top5, top5Insight, actionPlan, diagnostics, kpis, riskState
  };
}
