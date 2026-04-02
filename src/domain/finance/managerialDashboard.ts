import { Title, FinancialDocument, Category, BankAccount, Movement } from '@/types/financial';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface ManagerialAlert {
  id: string;
  type: 'critico' | 'atencao' | 'info';
  title: string;
  description: string;
}

export interface DriverItem {
  id: string;
  name: string;
  value: number;
}

export interface ManagerialDashboardKPIs {
  receitaLiquida: number;
  resultadoLiquido: number;
  margem: number; // percentage 0 to 1
  caixaAtual: number;

  statusGeral: {
    status: 'saudavel' | 'atencao' | 'critico';
    message: string;
  };

  alertas: ManagerialAlert[];
  
  drivers: {
    receitas: DriverItem[];
    custos: DriverItem[];
    despesas: DriverItem[];
  };

  evolucao: Array<{
    monthLabel: string; // Ex: 'Jan', 'Fev'
    receita: number;
    resultado: number;
  }>;

  evolucaoInsight: string;
  insights: string[];
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

export function calculateManagerialDashboard({
  documents,
  titles,
  movements,
  accounts,
  categories,
  currentMonthISO,
  referenceDateISO
}: {
  documents: FinancialDocument[];
  titles: Title[];
  movements: Movement[];
  accounts: BankAccount[];
  categories: Category[];
  currentMonthISO: string; // Ex: '2026-04'
  referenceDateISO: string; // Ex: '2026-04-01'
}): ManagerialDashboardKPIs {
  
  // CAIXA ATUAL
  let caixaAtual = 0;
  for (const a of accounts) {
    const openDate = a.openingBalanceDate || '1970-01-01';
    if (openDate <= referenceDateISO) {
      let accountBal = a.openingBalance;
      movements.filter(m => m.accountId === a.id && m.paymentDate >= openDate && m.paymentDate <= referenceDateISO).forEach(m => {
        if (m.type === 'entrada') accountBal += m.valuePaid;
        else accountBal -= m.valuePaid;
      });
      caixaAtual += accountBal;
    }
  }

  // DRE - Mês Atual
  const curMonthDocs = documents.filter(d => d.competenceDate.startsWith(currentMonthISO));
  
  const dreTotal = (docs: FinancialDocument[], dClass: string) => docs
    .filter(d => {
      const c = categories.find(cat => cat.id === d.categoryId);
      return c ? getDreClass(c) === dClass : false;
    })
    .reduce((acc, d) => acc + d.totalValue, 0);

  const receitaBruta = dreTotal(curMonthDocs, 'receita_bruta');
  const deducoes = dreTotal(curMonthDocs, 'deducao_imposto');
  const receitaLiquida = receitaBruta - deducoes;
  const custosVariaveis = dreTotal(curMonthDocs, 'custo_variavel');
  const margemContribuicao = receitaLiquida - custosVariaveis;
  const despesasFixas = dreTotal(curMonthDocs, 'despesa_fixa');
  const financeiro = dreTotal(curMonthDocs, 'financeiro');
  const resultadoLiquido = margemContribuicao - despesasFixas - financeiro;
  
  const margem = receitaLiquida > 0 ? (resultadoLiquido / receitaLiquida) : 0;

  // DRIVERS (Top 3 Receitas, Custos, Despesas do mês atual)
  const getTopDrivers = (classes: string[], limit: number = 3) => {
    const porCat: Record<string, number> = {};
    const relevantDocs = curMonthDocs.filter(d => {
      const c = categories.find(cat => cat.id === d.categoryId);
      if (!c) return false;
      return classes.includes(getDreClass(c));
    });
    
    for (const d of relevantDocs) {
      porCat[d.categoryId] = (porCat[d.categoryId] || 0) + d.totalValue;
    }

    return Object.entries(porCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([catId, value]) => ({
        id: catId,
        name: categories.find(c => c.id === catId)?.name || 'Desconhecida',
        value
      }));
  };

  const drivers = {
    receitas: getTopDrivers(['receita_bruta']),
    custos: getTopDrivers(['custo_variavel']),
    despesas: getTopDrivers(['despesa_fixa', 'financeiro'])
  };

  // ALERTAS EXECUTIVOS (Max 3, ordenados por severidade)
  const alertas: ManagerialAlert[] = [];

  // 1. Risco de Caixa (Títulos Vencidos vs Caixa Atual)
  const aPagarVencido = titles
    .filter(t => t.side === 'pagar' && t.status === 'previsto' && t.dueDate < referenceDateISO)
    .reduce((acc, t) => acc + t.value, 0);

  const aReceberVencido = titles
    .filter(t => t.side === 'receber' && t.status === 'previsto' && t.dueDate < referenceDateISO)
    .reduce((acc, t) => acc + t.value, 0);

  if (aPagarVencido > caixaAtual + aReceberVencido) {
    alertas.push({
      id: 'risco_caixa_critico',
      type: 'critico',
      title: 'Ruptura de Caixa Iminente',
      description: `Títulos vencidos superam o caixa disponível mais previsão de recebimentos em atraso.`
    });
  } else if (aPagarVencido > 0) {
    alertas.push({
      id: 'contas_vencidas',
      type: 'atencao',
      title: 'Contas Vencidas',
      description: `Há R$ ${aPagarVencido.toLocaleString('pt-BR', {minimumFractionDigits: 2})} de títulos a pagar já vencidos.`
    });
  }

  // 2. Margem e Resultado
  if (receitaLiquida > 0 && margem < 0) {
    alertas.push({
      id: 'margem_negativa',
      type: 'critico',
      title: 'Operação no Vermelho',
      description: `O resultado líquido deste mês está negativo em R$ ${Math.abs(resultadoLiquido).toLocaleString('pt-BR', {minimumFractionDigits: 2})}.`
    });
  } else if (receitaLiquida > 0 && margem < 0.1) {
    alertas.push({
      id: 'margem_baixa',
      type: 'atencao',
      title: 'Margem Executiva Baixa',
      description: `Sua margem líquida atual é de apenas ${(margem * 100).toFixed(1)}%.`
    });
  }

  // 3. Recebimentos Atrasados
  if (aReceberVencido > caixaAtual * 0.5 && aReceberVencido > 0 && caixaAtual > 0) {
    alertas.push({
      id: 'inadimplencia_alta',
      type: 'atencao',
      title: 'Alto Risco de Inadimplência',
      description: `Há um grande volume de contas a receber em atraso que afetam seu fluxo de caixa.`
    });
  }

  // Ordenar e limitar a 3 (Severidade: critico > atencao > info)
  const orderMap = { critico: 0, atencao: 1, info: 2 };
  alertas.sort((a, b) => orderMap[a.type] - orderMap[b.type]);
  const finalAlertas = alertas.slice(0, 3);

  // STATUS GERAL
  let statusGeral: ManagerialDashboardKPIs['statusGeral'] = { status: 'saudavel', message: 'Operação com bons indicadores.' };
  
  const criticos = finalAlertas.filter(a => a.type === 'critico').length;
  const atencao = finalAlertas.filter(a => a.type === 'atencao').length;

  if (resultadoLiquido < 0 || criticos >= 1 || finalAlertas.length >= 3) {
    statusGeral = { 
      status: 'critico', 
      message: margem < 0 ? 'Margem negativa e operação no vermelho.' : 'Múltiplos alertas críticos detectados.' 
    };
  } else if ((margem >= 0 && margem <= 0.1) || atencao >= 1 || finalAlertas.length > 0) {
    statusGeral = { 
      status: 'atencao', 
      message: margem <= 0.1 && receitaLiquida > 0 ? 'Margem pressionada. Fique atento aos custos.' : 'Alguns indicadores exigem sua atenção.' 
    };
  }

  // INSIGHTS ACIONÁVEIS
  const insights: string[] = [];
  if (finalAlertas.length === 0 && receitaLiquida > 0) {
    insights.push(`Sua operação está saudável estatisticamente. Concentre esforços em escalar e diversificar suas receitas.`);
  }
  
  if (drivers.despesas.length > 0 && despesasFixas > 0) {
    const topDespesa = drivers.despesas[0];
    const rep = (topDespesa.value / (despesasFixas + financeiro)) * 100;
    if (rep > 40) {
      insights.push(`"${topDespesa.name}" concentra ${rep.toFixed(1)}% das despesas. Revise e renegocie estes contratos para ganhar eficiência e margem.`);
    }
  }

  if (drivers.custos.length > 0 && custosVariaveis > 0) {
    const topCusto = drivers.custos[0];
    const rep = (topCusto.value / custosVariaveis) * 100;
    if (rep > 50) {
      insights.push(`Alto custo isolado em "${topCusto.name}". Busque novos fornecedores ou negocie compras em volume para aliviar a margem direta.`);
    }
  }
  
  if (insights.length < 2 && receitaLiquida === 0) {
      insights.push(`Nenhuma receita registrada neste mês. Registre suas vendas para ativar a análise financeira.`);
      insights.push(`Sem dados para gerar inteligência de custos. Comece mapeando suas principais despesas fixas.`);
  }
  
  const finalInsights = insights.slice(0, 2);

  // EVOLUÇÃO (Últimos 6 meses)
  const evolucao = [];
  const currentDate = new Date(currentMonthISO + '-01T12:00:00');
  for (let i = 5; i >= 0; i--) {
    const targetDate = subMonths(currentDate, i);
    const mIso = format(targetDate, 'yyyy-MM');
    // For chart labels use a localized short month logic (hardcoded here to keep it simple, or format)
    // let's just use string mapping
    const monthIndex = targetDate.getMonth();
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const monthLabel = `${months[monthIndex]}/${targetDate.getFullYear().toString().substring(2, 4)}`;

    const mDocs = documents.filter(d => d.competenceDate.startsWith(mIso));
    const mRecBruta = dreTotal(mDocs, 'receita_bruta');
    const mDed = dreTotal(mDocs, 'deducao_imposto');
    const mRecLiq = mRecBruta - mDed;
    const mCustos = dreTotal(mDocs, 'custo_variavel');
    const mMC = mRecLiq - mCustos;
    const mDespesa = dreTotal(mDocs, 'despesa_fixa');
    const mFin = dreTotal(mDocs, 'financeiro');
    const mResLiq = mMC - mDespesa - mFin;

    evolucao.push({
      monthLabel,
      receita: mRecLiq,
      resultado: mResLiq
    });
  }

  // EVOLUCAO INSIGHT
  let evolucaoInsight = "Sem dados históricos suficientes para identificar tendência.";
  if (evolucao.length >= 2) {
    // Basic trend analysis across all elements
    let accRevenueDiffs = 0;
    let accResultDiffs = 0;
    for(let i = 1; i < evolucao.length; i++) {
      accRevenueDiffs += (evolucao[i].receita - evolucao[i-1].receita);
      accResultDiffs += (evolucao[i].resultado - evolucao[i-1].resultado);
    }
    const avgRevDiff = accRevenueDiffs / evolucao.length;
    let revTrend = 'estável';
    if (avgRevDiff > 500) revTrend = 'em crescimento';
    else if (avgRevDiff < -500) revTrend = 'em queda';
    
    const avgResDiff = accResultDiffs / evolucao.length;
    let resTrend = 'mantido constante';
    if (avgResDiff > 500) resTrend = 'com recuperação consistente';
    else if (avgResDiff < -500) resTrend = 'exigindo atenção e revisão de custos';
    else if (evolucao[evolucao.length-1].resultado < 0) resTrend = 'pressionado e no vermelho';

    evolucaoInsight = `No último semestre a receita segue ${revTrend} com o resultado líquido ${resTrend}.`;
  }

  return {
    receitaLiquida,
    resultadoLiquido,
    margem,
    caixaAtual,
    statusGeral,
    alertas: finalAlertas,
    drivers,
    evolucao,
    evolucaoInsight,
    insights: finalInsights
  };
}
