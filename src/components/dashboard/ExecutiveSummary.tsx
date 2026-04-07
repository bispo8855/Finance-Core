import { KPICard } from '@/components/shared/KPICard';
import { TrendingUp, TrendingDown, Percent, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { navigateToDRE, navigateToCashFlow } from '@/utils/navigation';

interface ExecutiveSummaryProps {
  receitaLiquida: number;
  resultadoLiquido: number;
  margem: number;
  caixaAtual: number;
}

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ExecutiveSummary({ receitaLiquida, resultadoLiquido, margem, caixaAtual }: ExecutiveSummaryProps) {
  const navigate = useNavigate();
  
  const margemPercentual = (margem * 100).toFixed(1) + '%';
  let margemVariant : 'default' | 'positive' | 'negative' | 'warning' = 'default';
  if (receitaLiquida > 0) {
    if (margem >= 0.2) margemVariant = 'positive';
    else if (margem > 0) margemVariant = 'warning';
    else margemVariant = 'negative';
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. RESULTADO (FEATURED) */}
      <KPICard 
        title="Resultado" 
        value={fmt(resultadoLiquido)} 
        icon={resultadoLiquido >= 0 ? TrendingUp : TrendingDown} 
        variant="featured" 
        onClick={() => navigateToDRE(navigate)}
      />
      
      {/* 2. RECEITA */}
      <KPICard 
        title="Receita Líquida" 
        value={fmt(receitaLiquida)} 
        icon={TrendingUp} 
        variant="default" 
        onClick={() => navigateToDRE(navigate)}
      />

      {/* 3. MARGEM */}
      <KPICard 
        title="Margem" 
        value={receitaLiquida > 0 ? margemPercentual : '0%'} 
        subtitle={receitaLiquida === 0 ? 'Sem margem calculada no período' : undefined}
        icon={Percent} 
        variant={margemVariant} 
        onClick={() => navigateToDRE(navigate)}
      />

      {/* 4. CAIXA */}
      <KPICard 
        title="Caixa Atual" 
        value={fmt(caixaAtual)} 
        icon={Wallet} 
        variant={caixaAtual >= 0 ? 'default' : 'negative'} 
        onClick={() => navigateToCashFlow(navigate)}
      />
    </div>
  );
}
