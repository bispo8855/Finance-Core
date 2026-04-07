import { Recommendation } from '@/types/recommendations';
import { Title, FinancialDocument, Category, BankAccount, Movement } from '@/types/financial';
import { calculateBaseMetrics } from './managerialDashboard';

interface CalcParams {
  documents: FinancialDocument[];
  titles: Title[];
  movements: Movement[];
  accounts: BankAccount[];
  categories: Category[];
  currentMonthISO: string;
  referenceDateISO: string;
}

export function generateRecommendations(params: CalcParams): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const metrics = calculateBaseMetrics(params);
  
  const { 
    caixaAtual, 
    resultadoLiquido, 
    margem, 
    despesasFixas, 
    financeiro 
  } = metrics;

  const totalDespesasFixas = despesasFixas + financeiro;

  // 1. INADIMPLÊNCIA (> 20%)
  const aReceberAberto = params.titles
    .filter(t => t.side === 'receber' && (t.status === 'previsto' || t.status === 'atrasado'));
    
  const totalAReceber = aReceberAberto.reduce((acc, t) => acc + t.value, 0);
  const aReceberVencido = aReceberAberto
    .filter(t => t.dueDate < params.referenceDateISO)
    .reduce((acc, t) => acc + t.value, 0);

  if (totalAReceber > 0 && aReceberVencido / totalAReceber > 0.2) {
    recommendations.push({
      id: 'risk_inadimplencia',
      type: 'risk',
      title: 'Inadimplência impactando seu caixa',
      description: 'Uma parcela relevante dos seus recebimentos está em atraso, o que pode comprometer sua liquidez no curto prazo.',
      impact: {
        area: 'caixa',
        severity: 'high',
        estimatedValue: aReceberVencido
      },
      action: {
        primary: 'Priorize a cobrança dos títulos vencidos',
        secondary: 'Considere políticas de pagamento antecipado',
        targetPath: '/receber',
        queryParams: { status: 'atrasado' }
      }
    });
  }

  // 2. MARGEM BAIXA (< 10%)
  if (metrics.receitaLiquida > 0 && margem < 0.1) {
    recommendations.push({
      id: 'risk_margem_baixa',
      type: 'risk',
      title: 'Margem abaixo do ideal',
      description: 'Sua operação está gerando baixo retorno sobre as vendas. Isso aumenta o risco em caso de queda no faturamento.',
      impact: {
        area: 'resultado',
        severity: 'high'
      },
      action: {
        primary: 'Revise seus preços ou custos operacionais',
        secondary: 'Simule cenários na Precificação',
        targetPath: '/precificacao'
      }
    });
  }

  // 3. CAIXA APERTADO (< despesas fixas)
  if (caixaAtual < totalDespesasFixas && totalDespesasFixas > 0) {
    recommendations.push({
      id: 'risk_caixa_apertado',
      type: 'risk',
      title: 'Caixa em zona de atenção',
      description: 'Seu saldo atual é inferior ao volume total de despesas fixas mensais. Mantenha controle rígido sobre as próximas saídas.',
      impact: {
        area: 'caixa',
        severity: 'medium'
      },
      action: {
        primary: 'Reduza despesas não essenciais imediatamente',
        secondary: 'Acompanhe a projeção no Fluxo de Caixa',
        targetPath: '/fluxo'
      }
    });
  }

  // 4. SUCESSO V1 (Profit + Margin + No grave risks)
  // Only add opportunity if no high-severity risks are present
  const highRisks = recommendations.filter(r => r.type === 'risk' && r.impact.severity === 'high');
  if (highRisks.length === 0 && resultadoLiquido > 0 && margem >= 0.2) {
    recommendations.push({
      id: 'opportunity_sucesso',
      type: 'opportunity',
      title: 'Operação saudável e lucrativa',
      description: 'Seu negócio apresenta margens sólidas e resultado positivo. Momento ideal para planejar reinvestimentos.',
      impact: {
        area: 'resultado',
        severity: 'low'
      },
      action: {
        primary: 'Avalie reinvestir no crescimento',
        secondary: 'Escalar mantendo a eficiência atual',
        targetPath: '/dre'
      }
    });
  }

  // Priority Sorting: high risks > medium risks > low/others > opportunities > efficiency
  // Simplified sorting based on user priority: risks > opportunities > efficiency
  const typePriority = { risk: 0, opportunity: 1, efficiency: 2 };
  const severityPriority = { high: 0, medium: 1, low: 2 };

  return recommendations
    .sort((a, b) => {
      if (a.type !== b.type) return typePriority[a.type] - typePriority[b.type];
      return severityPriority[a.impact.severity] - severityPriority[b.impact.severity];
    })
    .slice(0, 3);
}
