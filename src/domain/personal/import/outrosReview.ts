// ============================================================================
// Aurys Personal — revisão dirigida dos maiores "Outros" (AP4C.1d).
// PURO. Seleciona os maiores gastos ainda em "Outros", aplica as decisões do
// usuário RECALCULANDO o summary em memória (Outros, %, dia a dia) e mapeia a
// decisão para os campos JÁ EXISTENTES do staging (user_decision/kind/category).
// NÃO escreve no banco, NÃO toca motor AP2, NÃO reabre renda/fixa.
// ============================================================================

import { ImportSummary, CategoryTotal } from './personalImportInference';
import { PersonalCategory } from './personalCategories';
import { ImportItemRow } from './applyPlan';

export type OutrosDecisionKind = 'pessoal' | 'pontual' | 'negocio' | 'duvida';
export interface OutrosDecision { kind: OutrosDecisionKind; category?: PersonalCategory }
export type OutrosDecisions = Record<string, OutrosDecision>; // itemId → decisão

export interface OutrosItem { id: string; description: string; amount: number; date: string }

const monthOf = (d: string) => d.slice(0, 7);
const r2 = (n: number) => Math.round(n * 100) / 100;
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Item ainda em "Outros" = variável cuja categoria inferida é Outros (sem reclassificação). */
function isOutrosItem(i: ImportItemRow): boolean {
  return i.inferred_kind === 'variavel' && (i.inferred_category ?? 'Outros') === 'Outros';
}

/**
 * Maiores itens de "Outros" em ordem decrescente. Para não pedir revisão de 128
 * linhas: corta no que vier primeiro — top 10 OU itens que expliquem ~80% do
 * valor de Outros.
 */
export function selectBiggestOutros(items: ImportItemRow[], opts: { topN?: number; coverage?: number } = {}): OutrosItem[] {
  const topN = opts.topN ?? 10;
  const coverage = opts.coverage ?? 0.80;
  const outros = items.filter(isOutrosItem)
    .map((i) => ({ id: i.id, description: i.raw_description, amount: i.raw_amount, date: i.raw_date }))
    .sort((a, b) => b.amount - a.amount);
  const total = outros.reduce((s, o) => s + o.amount, 0);
  const out: OutrosItem[] = [];
  let acc = 0;
  for (const o of outros) {
    out.push(o);
    acc += o.amount;
    if (out.length >= topN) break;
    if (total > 0 && acc / total >= coverage) break;
  }
  return out;
}

/**
 * Recalcula o summary aplicando as decisões da revisão (em memória):
 *  - 'negocio'  → item sai da leitura pessoal (fora de Outros e do dia a dia);
 *  - 'pontual'  → sai do dia a dia estrutural (não entra em Outros nem no resíduo);
 *  - 'pessoal'  → reclassifica para a categoria escolhida (sai de Outros, segue no dia a dia);
 *  - 'duvida'/ausente → permanece em Outros.
 * Só recomputa os campos derivados de variáveis (gastosVariaveis + diaADia).
 */
export function adjustSummaryForReview(summary: ImportSummary, items: ImportItemRow[], decisions: OutrosDecisions): ImportSummary {
  const variaveis = items.filter((i) => i.inferred_kind === 'variavel');
  const catMap = new Map<string, { total: number; count: number }>();
  const residue = new Map<string, number>();
  let total = 0;

  for (const it of variaveis) {
    const d = decisions[it.id];
    if (d && (d.kind === 'negocio' || d.kind === 'pontual')) continue; // sai da leitura estrutural
    const cat = d && d.kind === 'pessoal' && d.category ? d.category : (it.inferred_category ?? 'Outros');
    total += it.raw_amount;
    const cur = catMap.get(cat) ?? { total: 0, count: 0 };
    cur.total += it.raw_amount; cur.count += 1; catMap.set(cat, cur);
    residue.set(monthOf(it.raw_date), (residue.get(monthOf(it.raw_date)) ?? 0) + it.raw_amount);
  }

  const byCategory: CategoryTotal[] = [...catMap.entries()]
    .map(([category, v]) => ({ category: category as PersonalCategory, total: r2(v.total), count: v.count }))
    .sort((a, b) => b.total - a.total);

  const parcialByMonth = new Map(summary.diaADia.porMes.map((p) => [p.monthISO, p.parcial]));
  const porMes = [...residue.entries()]
    .map(([monthISO, t]) => ({ monthISO, total: r2(t), parcial: parcialByMonth.get(monthISO) ?? false }))
    .sort((a, b) => a.monthISO.localeCompare(b.monthISO));
  const completos = porMes.filter((p) => !p.parcial);
  const base = completos.length ? completos : porMes;
  const totais = base.map((p) => p.total);

  return {
    ...summary,
    gastosVariaveis: { total: r2(total), byCategory },
    categoriasTop: byCategory.slice(0, 5),
    diaADia: {
      ...summary.diaADia,
      porMes,
      min: totais.length ? r2(Math.min(...totais)) : 0,
      normal: totais.length ? r2(median(totais)) : 0,
      heavy: totais.length ? r2(Math.max(...totais)) : 0,
    },
  };
}

export interface OutrosStatus { outrosTotal: number; variableTotal: number; outrosPct: number; blockedByOutros: boolean }
/** % de "Outros" sobre o total variável; bloqueia daily quando > 20%. */
export function outrosStatus(summary: ImportSummary): OutrosStatus {
  const variableTotal = summary.gastosVariaveis.total;
  const outrosTotal = summary.gastosVariaveis.byCategory.find((c) => c.category === 'Outros')?.total ?? 0;
  const outrosPct = variableTotal > 0 ? outrosTotal / variableTotal : 0;
  return { outrosTotal, variableTotal, outrosPct, blockedByOutros: variableTotal > 0 && outrosPct > 0.20 };
}

/** Mapeia a decisão da revisão para os campos JÁ EXISTENTES do staging. duvida → null (não persiste). */
export interface ItemDecisionPatch { itemId: string; userDecision: 'corrigido' | 'ignorado'; userKind: string; userCategory: string | null }
export function decisionToItemPatch(itemId: string, d: OutrosDecision): ItemDecisionPatch | null {
  switch (d.kind) {
    case 'pessoal': return { itemId, userDecision: 'corrigido', userKind: 'variavel', userCategory: d.category ?? null };
    case 'pontual': return { itemId, userDecision: 'ignorado', userKind: 'pontual', userCategory: null };
    case 'negocio': return { itemId, userDecision: 'ignorado', userKind: 'negocio', userCategory: null };
    case 'duvida': return null;
  }
}
export function outrosDecisionWrites(decisions: OutrosDecisions): ItemDecisionPatch[] {
  return Object.entries(decisions)
    .map(([itemId, d]) => decisionToItemPatch(itemId, d))
    .filter((w): w is ItemDecisionPatch => w !== null);
}
