// ============================================================================
// Aurys Personal — taxonomia de categorias + categorizador por regras (AP4C.0 spike).
// PURO e determinístico. Categoria é SUGESTÃO, nunca verdade absoluta — o usuário
// valida/corrige. Sem IA: só palavras-chave. Não depende do Business.
// ============================================================================

export const PERSONAL_CATEGORIES = [
  'Moradia',
  'Mercado',
  'Restaurantes/Delivery',
  'Transporte',
  'Saúde',
  'Educação',
  'Filhos/Família',
  'Compras',
  'Assinaturas/Serviços',
  'Dívidas/Financiamentos',
  'Lazer',
  'Outros',
] as const;

export type PersonalCategory = (typeof PERSONAL_CATEGORIES)[number];

export interface CategoryGuess {
  category: PersonalCategory;
  confidence: 'alta' | 'media' | 'baixa';
  matched?: string; // termo que casou (rastreabilidade)
}

// Regras palavra-chave → categoria. Ordem importa (primeira que casa vence).
// Termos em minúsculo, sem acento (a normalização remove acentos antes de comparar).
const RULES: { category: PersonalCategory; terms: string[] }[] = [
  { category: 'Transporte', terms: ['uber', '99app', '99 *', '99pop', 'cabify', 'posto', 'ipiranga', 'shell', 'combustivel', 'estacionamento', 'metro', 'brt', 'bilhete unico', 'sem parar', 'veloe'] },
  { category: 'Mercado', terms: ['supermercado', 'mercado', 'atacad', 'assai', 'carrefour', 'pao de acucar', 'extra ', 'hortifruti', 'sacolao', 'zaffari', 'bistek'] },
  { category: 'Restaurantes/Delivery', terms: ['ifood', 'rappi', 'restaurante', 'lanchonete', 'padaria', 'burger', 'mc donalds', 'mcdonalds', 'bk ', 'pizzaria', 'cafe', 'starbucks', 'aiqfome'] },
  { category: 'Saúde', terms: ['farmacia', 'drogaria', 'drogasil', 'raia', 'pacheco', 'hospital', 'clinica', 'laboratorio', 'unimed', 'amil', 'dentista', 'psicolog'] },
  { category: 'Educação', terms: ['escola', 'colegio', 'faculdade', 'universidade', 'curso', 'udemy', 'alura', 'ensino', 'mensalidade escolar', 'material escolar'] },
  { category: 'Filhos/Família', terms: ['creche', 'bercario', 'pediatr', 'brinquedo', 'fralda', 'pampers'] },
  { category: 'Assinaturas/Serviços', terms: ['netflix', 'spotify', 'amazon prime', 'prime video', 'disney', 'hbo', 'globoplay', 'youtube premium', 'icloud', 'google one', 'microsoft', 'office 365', 'chatgpt', 'openai', 'claude', 'anthropic', 'internet', 'vivo', 'claro', 'tim ', 'oi ', 'assinatura'] },
  { category: 'Moradia', terms: ['aluguel', 'condominio', 'condominial', 'energia', 'eletric', 'enel', 'cpfl', 'light', 'agua', 'sabesp', 'sanepar', 'gas ', 'iptu'] },
  { category: 'Dívidas/Financiamentos', terms: ['emprestimo', 'financiamento', 'parcela', 'consorcio', 'prestacao', 'crediario', 'financ '] },
  { category: 'Lazer', terms: ['cinema', 'ingresso', 'show', 'teatro', 'viagem', 'hotel', 'airbnb', 'booking', 'bar ', 'balada', 'academia', 'smartfit'] },
  { category: 'Compras', terms: ['amazon', 'magazine', 'magalu', 'americanas', 'mercadolivre', 'mercado livre', 'shopee', 'aliexpress', 'shopping', 'loja', 'renner', 'riachuelo', 'zara', 'nike', 'adidas'] },
];

/** Normaliza descrição: minúsculo, sem acento, espaços colapsados. */
export function normalizeDescription(desc: string): string {
  return (desc || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos (marcas diacríticas)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sugere categoria para uma DESPESA a partir da descrição.
 * Sem match → 'Outros' com confiança baixa (nunca inventa certeza).
 */
export function categorize(description: string): CategoryGuess {
  const norm = normalizeDescription(description);
  for (const rule of RULES) {
    const hit = rule.terms.find((t) => norm.includes(t));
    if (hit) return { category: rule.category, confidence: 'media', matched: hit };
  }
  return { category: 'Outros', confidence: 'baixa' };
}
