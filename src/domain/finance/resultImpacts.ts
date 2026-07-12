import { SemanticResult } from './semanticResult';
import { ResultLineKey } from './resultMapping';

// "Maiores impactos do mês": os itens NEGATIVOS de todas as linhas da cascata,
// ordenados por |valor| desc, top N. Derivado do result já carregado (zero queries).

export interface ResultImpact {
  label: string;
  categoryName?: string;
  amount: number; // negativo
  origin?: string;
  lineKey: ResultLineKey;
  lineLabel: string;
}

export function topNegativeImpacts(result: SemanticResult, limit = 5): ResultImpact[] {
  const impacts: ResultImpact[] = [];
  for (const linha of result.linhas) {
    for (const item of linha.items) {
      if (item.amount < 0) {
        impacts.push({
          label: item.label,
          categoryName: item.categoryName,
          amount: item.amount,
          origin: item.origin,
          lineKey: linha.key,
          lineLabel: linha.label,
        });
      }
    }
  }
  impacts.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return impacts.slice(0, limit);
}
