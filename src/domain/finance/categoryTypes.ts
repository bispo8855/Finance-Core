import { CategoryType } from '@/types/financial';

// Fonte única da taxonomia de tipos de categoria (Natureza da categoria).
// Reaproveitada pela tela oficial de Categorias e pelo modal de criação
// rápida dentro do Novo Lançamento, para evitar divergência entre as telas.
export const categoryTypeLabels: Record<CategoryType, string> = {
  receita: 'Receita',
  custo: 'Custo',
  despesa: 'Despesa',
  investimento: 'Investimento',
  financeiro: 'Financeiro',
};
