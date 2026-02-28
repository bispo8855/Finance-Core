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

  const typeTotal = (ctype: string) => monthDocs
    .filter(d => categories.find(c => c.id === d.categoryId)?.type === ctype)
    .reduce((acc, d) => acc + d.totalValue, 0);

  const receitaBruta = typeTotal('receita');
  const deducoes = 0;
  const receitaLiquida = receitaBruta - deducoes;
  const custosVariaveis = typeTotal('custo');
  const margemContribuicao = receitaLiquida - custosVariaveis;
  const despesasFixas = typeTotal('despesa');
  const resultadoOperacional = margemContribuicao - despesasFixas;
  const financeiro = typeTotal('financeiro');
  const resultadoLiquido = resultadoOperacional - financeiro;

  const gastosPorCategoria: Record<string, number> = {};
  monthDocs
    .filter(d => ['custo', 'despesa', 'financeiro'].includes(categories.find(c => c.id === d.categoryId)?.type || ''))
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

  return {
    receitaBruta, deducoes, receitaLiquida, custosVariaveis, margemContribuicao,
    despesasFixas, resultadoOperacional, financeiro, resultadoLiquido, top5
  };
}
