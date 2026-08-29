// ============================================================================
// Aurys Personal — inferência sobre linhas de extrato/fatura (AP4C.0 spike).
// PURO. Recebe NormalizedLine[] e destila BLOCOS para o usuário validar.
// Regras (não IA): pagamento de fatura ≠ despesa; transferência ≠ gasto (com
// indício forte); crédito recorrente ⇒ renda provável; débito recorrente ⇒ fixa
// provável; reembolso/estorno ≠ renda estrutural; dia a dia é RESÍDUO (medido).
// Categoria é sugestão. NADA é aplicado — só um resumo para decisão.
// ============================================================================

import { NormalizedLine } from './personalStatementParser';
import { PersonalCategory, categorize, normalizeDescription } from './personalCategories';

// Categorias que PODEM virar conta fixa quando recorrentes (fixas por natureza).
// Mercado/Transporte/Restaurantes/Compras/Lazer/Outros NÃO viram fixa só por recorrer —
// permanecem como gasto variável (dia a dia), mesmo repetindo mês a mês.
const FIXED_ELIGIBLE = new Set<PersonalCategory>([
  'Moradia', 'Assinaturas/Serviços', 'Dívidas/Financiamentos', 'Educação', 'Saúde',
]);
// Saúde é elegível, mas com confiança menor (nem toda saúde recorrente é fixa).
const FIXED_LOWER_CONFIDENCE = new Set<PersonalCategory>(['Saúde']);

export interface LineRef { sourceRow: number; date: string; description: string; amount: number; direction: 'entrada' | 'saida'; }
export interface InferredIncome { key: string; description: string; amount: number; occurrences: number; months: string[]; confidence: 'alta' | 'media' | 'baixa'; reason: string; }
export interface InferredFixed { key: string; description: string; amount: number; occurrences: number; months: string[]; dayOfMonth: number; confidence: 'alta' | 'media' | 'baixa'; }
export interface CategoryTotal { category: PersonalCategory; total: number; count: number; }
export interface Flagged { line: LineRef; reason: string; }

export interface ImportSummary {
  period: { from: string; to: string; months: string[] };
  counts: { linhas: number; rendas: number; fixas: number; transferencias: number; pagamentosFatura: number; variaveis: number; ignorados: number; duvidosos: number };
  rendasProvaveis: InferredIncome[];
  fixasProvaveis: InferredFixed[];
  transferencias: LineRef[];
  pagamentosFatura: LineRef[];
  gastosVariaveis: { total: number; byCategory: CategoryTotal[] };
  categoriasTop: CategoryTotal[];
  ignorados: Flagged[];
  duvidosos: Flagged[];
  diaADia: { porMes: { monthISO: string; total: number }[]; min: number; normal: number; heavy: number; confidence: 'alta' | 'media' | 'baixa' };
}

const monthOf = (d: string) => d.slice(0, 7);
const dayOf = (d: string) => Number(d.slice(8, 10)) || 1;
const ref = (l: NormalizedLine): LineRef => ({ sourceRow: l.sourceRow, date: l.date, description: l.description, amount: l.amount, direction: l.direction });

// Palavras-chave (descrição já normalizada: minúscula, sem acento).
const KW = {
  transfer: ['transferencia', 'transf ', 'ted ', 'doc ', 'pix ', 'pix-', 'pix recebido', 'pix enviado', 'entre contas'],
  faturaPayment: ['pagamento de fatura', 'pagamento fatura', 'pag fatura', 'pagto fatura', 'pagamento cartao', 'pagto cartao', 'fatura cartao'],
  reembolso: ['estorno', 'reembolso', 'devolucao', 'chargeback', 'ajuste', 'reversao'],
  salario: ['salario', 'pagamento salario', 'provento', 'pro-labore', 'pro labore', 'vencimento', 'ordenado', 'inss', 'aposentad', 'pensao', 'remuneracao'],
};
const hasKw = (norm: string, list: string[]) => list.some((k) => norm.includes(k));

/** Chave de comerciante: remove números/pontuação, primeiras 4 palavras. */
function merchantKey(desc: string): string {
  return normalizeDescription(desc).replace(/[0-9]+/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).join(' ');
}
const similar = (a: number, b: number) => { const d = Math.abs(a - b); return d <= 5 || d <= Math.max(a, b) * 0.05; };
function median(nums: number[]): number { const s = [...nums].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function mode(nums: number[]): number { const c = new Map<number, number>(); let best = nums[0], bestN = 0; for (const n of nums) { const k = (c.get(n) ?? 0) + 1; c.set(n, k); if (k > bestN) { bestN = k; best = n; } } return best; }

export function inferFromLines(lines: NormalizedLine[]): ImportSummary {
  const valid = lines.filter((l) => l.date && l.amount > 0);
  const months = [...new Set(valid.map((l) => monthOf(l.date)))].sort();
  const dates = valid.map((l) => l.date).sort();

  const transferencias: LineRef[] = [];
  const pagamentosFatura: LineRef[] = [];
  const ignorados: Flagged[] = [];
  const duvidosos: Flagged[] = [];
  const expenseCandidates: NormalizedLine[] = [];
  const incomeCandidates: NormalizedLine[] = [];
  const transferLines: NormalizedLine[] = [];

  for (const l of valid) {
    const norm = normalizeDescription(l.description);
    if (l.issues.length > 0) { duvidosos.push({ line: ref(l), reason: `parsing incerto: ${l.issues.join(', ')}` }); continue; }

    if (l.direction === 'saida') {
      if (hasKw(norm, KW.faturaPayment)) { pagamentosFatura.push(ref(l)); continue; } // fatura ≠ despesa
      if (hasKw(norm, KW.transfer)) { transferLines.push(l); continue; }
      if (hasKw(norm, KW.reembolso)) { ignorados.push({ line: ref(l), reason: 'estorno/ajuste — não é despesa de rotina' }); continue; }
      expenseCandidates.push(l);
    } else {
      if (hasKw(norm, KW.transfer)) { transferLines.push(l); continue; }
      if (hasKw(norm, KW.reembolso)) { ignorados.push({ line: ref(l), reason: 'reembolso/estorno — não é renda estrutural' }); continue; }
      incomeCandidates.push(l);
    }
  }

  // Transferências: com contrapartida (par oposto ~mesmo valor, ≤3 dias) → interna (ignorada);
  // sem contrapartida → dúvida para revisão.
  const used = new Set<number>();
  for (let i = 0; i < transferLines.length; i++) {
    if (used.has(i)) continue;
    const a = transferLines[i];
    let matched = false;
    for (let j = 0; j < transferLines.length; j++) {
      if (i === j || used.has(j)) continue;
      const b = transferLines[j];
      const dias = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) / 86400000;
      if (a.direction !== b.direction && similar(a.amount, b.amount) && dias <= 3) { matched = true; used.add(i); used.add(j); transferencias.push(ref(a)); transferencias.push(ref(b)); break; }
    }
    if (!matched) duvidosos.push({ line: ref(a), reason: 'transferência sem contrapartida — revisar (pode ser gasto ou renda)' });
  }

  // Agrupamento por comerciante para detectar recorrência.
  const groupBy = (arr: NormalizedLine[]) => {
    const g = new Map<string, NormalizedLine[]>();
    for (const l of arr) { const k = merchantKey(l.description) || l.description.toLowerCase(); (g.get(k) ?? g.set(k, []).get(k)!).push(l); }
    return g;
  };

  // Fixas prováveis: despesa recorrente (≥2 meses, valores semelhantes) E de categoria
  // FIXA POR NATUREZA. Recorrente de categoria variável (Mercado/Transporte/…) NÃO vira
  // fixa só por recorrer — segue como gasto variável (dia a dia). Categoria gateia recorrência.
  const fixasProvaveis: InferredFixed[] = [];
  const variableLines: NormalizedLine[] = [];
  for (const [key, group] of groupBy(expenseCandidates)) {
    const distinctMonths = [...new Set(group.map((l) => monthOf(l.date)))];
    const amounts = group.map((l) => l.amount);
    const rep = median(amounts);
    const recurring = distinctMonths.length >= 2 && amounts.every((a) => similar(a, rep));
    const cat = categorize(group[0].description).category;
    const fixedByNature = FIXED_ELIGIBLE.has(cat);
    if (recurring && fixedByNature) {
      const baseConf = distinctMonths.length >= 3 ? 'alta' : 'media';
      const conf: InferredFixed['confidence'] = FIXED_LOWER_CONFIDENCE.has(cat) ? 'baixa' : baseConf;
      fixasProvaveis.push({ key, description: group[0].description, amount: rep, occurrences: group.length, months: distinctMonths.sort(), dayOfMonth: mode(group.map((l) => dayOf(l.date))), confidence: conf });
    } else {
      // recorrente-mas-variável (ex.: Uber/Mercado) OU não-recorrente → gasto variável
      variableLines.push(...group);
    }
  }

  // Rendas prováveis: crédito recorrente (≥2 meses) OU crédito com palavra de salário.
  const rendasProvaveis: InferredIncome[] = [];
  for (const [key, group] of groupBy(incomeCandidates)) {
    const distinctMonths = [...new Set(group.map((l) => monthOf(l.date)))];
    const rep = median(group.map((l) => l.amount));
    const isSalary = group.some((l) => hasKw(normalizeDescription(l.description), KW.salario));
    if (distinctMonths.length >= 2) {
      rendasProvaveis.push({ key, description: group[0].description, amount: rep, occurrences: group.length, months: distinctMonths.sort(), confidence: distinctMonths.length >= 3 ? 'alta' : 'media', reason: 'crédito recorrente em vários meses' });
    } else if (isSalary) {
      rendasProvaveis.push({ key, description: group[0].description, amount: rep, occurrences: group.length, months: distinctMonths, confidence: 'media', reason: 'descrição indica salário/provento' });
    } else {
      // crédito avulso e sem indício de salário → dúvida (pode ser venda, presente, etc.)
      for (const l of group) duvidosos.push({ line: ref(l), reason: 'crédito avulso sem recorrência nem indício de salário — revisar' });
    }
  }

  // Gastos variáveis (resíduo) → categorização + totais.
  const catMap = new Map<PersonalCategory, CategoryTotal>();
  let variaveisTotal = 0;
  const residuePorMes = new Map<string, number>();
  for (const l of variableLines) {
    variaveisTotal += l.amount;
    residuePorMes.set(monthOf(l.date), (residuePorMes.get(monthOf(l.date)) ?? 0) + l.amount);
    const cat = categorize(l.description).category;
    const cur = catMap.get(cat) ?? { category: cat, total: 0, count: 0 };
    cur.total += l.amount; cur.count += 1; catMap.set(cat, cur);
  }
  const byCategory = [...catMap.values()].sort((a, b) => b.total - a.total);

  // Dia a dia MEDIDO (resíduo por mês → min/normal/heavy). Nunca chute.
  const porMes = [...residuePorMes.entries()].map(([monthISO, total]) => ({ monthISO, total })).sort((a, b) => a.monthISO.localeCompare(b.monthISO));
  const totais = porMes.map((p) => Math.round(p.total * 100) / 100);
  const diaADia = {
    porMes,
    min: totais.length ? Math.min(...totais) : 0,
    normal: totais.length ? Math.round(median(totais) * 100) / 100 : 0,
    heavy: totais.length ? Math.max(...totais) : 0,
    confidence: (totais.length >= 3 ? 'media' : 'baixa') as 'alta' | 'media' | 'baixa', // 1-2 meses = pouca base
  };

  return {
    period: { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '', months },
    counts: { linhas: valid.length, rendas: rendasProvaveis.length, fixas: fixasProvaveis.length, transferencias: transferencias.length, pagamentosFatura: pagamentosFatura.length, variaveis: variableLines.length, ignorados: ignorados.length, duvidosos: duvidosos.length },
    rendasProvaveis, fixasProvaveis, transferencias, pagamentosFatura,
    gastosVariaveis: { total: Math.round(variaveisTotal * 100) / 100, byCategory },
    categoriasTop: byCategory.slice(0, 5),
    ignorados, duvidosos, diaADia,
  };
}
