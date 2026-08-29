// ============================================================================
// Aurys Personal — inferência sobre linhas de extrato/fatura (AP4C.0.1).
// PURO. Recebe NormalizedLine[] (+ meta opcional) e destila BLOCOS para o
// usuário validar. NADA é aplicado — só um resumo para decisão.
//
// Calibrado com extrato real PF/PIX:
//  - PIX/TED é TRILHO NEUTRO: só é transferência quando a contraparte é o
//    próprio titular (ou indício de conta própria). PIX a terceiro é gasto;
//    PIX recebido de terceiro é recebimento/renda candidata.
//  - Fixa também por DESCRIÇÃO (mensalidade/seguro/parcela…), com gate de categoria.
//  - Dia a dia é RESÍDUO medido; mês parcial baixa a confiança e vira issue.
//  - Conta com termos PJ vira ALERTA, nunca classificação forçada.
// ============================================================================

import { NormalizedLine } from './personalStatementParser';
import { PersonalCategory, categorize, normalizeDescription } from './personalCategories';

export interface LineRef { sourceRow: number; date: string; description: string; amount: number; direction: 'entrada' | 'saida'; }
export interface InferredIncome { key: string; description: string; amount: number; occurrences: number; months: string[]; confidence: 'alta' | 'media' | 'baixa'; reason: string; }
export interface InferredFixed { key: string; description: string; amount: number; occurrences: number; months: string[]; dayOfMonth: number; confidence: 'alta' | 'media' | 'baixa'; reason: string; }
export interface CategoryTotal { category: PersonalCategory; total: number; count: number; }
export interface Flagged { line: LineRef; reason: string; }

export interface ImportSummary {
  period: { from: string; to: string; months: string[]; mesesParciais: string[] };
  counts: { linhas: number; rendas: number; fixas: number; transferenciasProprias: number; pagamentosFatura: number; variaveis: number; ignorados: number; duvidosos: number };
  saldo: { valor: number | null; fonte: 'movimento' | 'rodape' | null };
  alertaContaMista: string | null;
  rendasProvaveis: InferredIncome[];
  fixasProvaveis: InferredFixed[];
  transferenciasProprias: LineRef[];
  pagamentosFatura: LineRef[];
  gastosVariaveis: { total: number; byCategory: CategoryTotal[] };
  categoriasTop: CategoryTotal[];
  ignorados: Flagged[];
  duvidosos: Flagged[];
  diaADia: { porMes: { monthISO: string; total: number; parcial: boolean }[]; min: number; normal: number; heavy: number; confidence: 'alta' | 'media' | 'baixa'; issues: string[] };
}

export interface InferMeta { titular?: string | null; accountBalance?: number | null; footerBalance?: number | null; }

const monthOf = (d: string) => d.slice(0, 7);
const dayOf = (d: string) => Number(d.slice(8, 10)) || 1;
const daysInMonth = (m: string) => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm, 0).getDate(); };
const ref = (l: NormalizedLine): LineRef => ({ sourceRow: l.sourceRow, date: l.date, description: l.description, amount: l.amount, direction: l.direction });

const RAIL_RE = /\bpix\b|\bted\b|\bdoc\b|\btef\b|transferenci|\btransf\b/;
const RAIL_WORDS = new Set(['pix', 'ted', 'doc', 'tef', 'transf', 'transferencia', 'transferencias']);
const DIRECTION_WORDS = new Set(['enviado', 'enviada', 'recebido', 'recebida', 'agendado', 'agendada', 'enviar', 'receber', 'pagamento', 'pgto', 'de', 'para', 'e']);
const OWN_HINTS = ['entre contas', 'conta propria', 'mesma titularidade', 'aplicacao', 'resgate', 'investimento'];
const FATURA = ['pagamento de fatura', 'pagamento fatura', 'pag fatura', 'pagto fatura', 'pagamento cartao', 'pagto cartao', 'fatura cartao'];
const REEMBOLSO = ['estorno', 'reembolso', 'devolucao', 'chargeback', 'reversao'];
const SALARIO = ['salario', 'provento', 'pro-labore', 'pro labore', 'vencimento', 'ordenado', 'inss', 'aposentad', 'pensao', 'remuneracao trabalho'];
const FIXED_DESC = ['mensalidade', 'seguro', 'internet', 'plano ', 'assinatura', 'aluguel', 'condominio', 'consorcio', 'financiamento', 'emprestimo', 'previdencia'];
// Exige prefixo "parc" — a fração NN/NN sozinha casava códigos/docs bancários (falso positivo).
const PARCELA_RE = /parc(ela)?\.?\s*\d{1,3}\s*\/\s*\d{1,3}/;
// Encargos/tarifas/one-offs NUNCA são conta fixa (mesmo tendo aparência recorrente).
const FIXED_EXCLUDE = ['iof', 'juros', 'multa', 'anuidade', 'tarifa', 'tributo', 'boleto outros'];
const MIXED_TERMS = ['pagamento a fornecedores', 'fornecedor', 'remuneracao aplicacao', 'folha de pagamento', 'pro-labore', 'pro labore', 'faturamento', 'nota fiscal', 'boleto recebido', 'tarifa pj', 'das ', 'dctf', 'simples nacional'];

const has = (norm: string, list: string[]) => list.some((k) => norm.includes(k));

// Categorias que PODEM virar fixa quando recorrentes (fixas por natureza).
const FIXED_ELIGIBLE = new Set<PersonalCategory>(['Moradia', 'Assinaturas/Serviços', 'Dívidas/Financiamentos', 'Educação', 'Saúde']);
const FIXED_LOWER_CONF = new Set<PersonalCategory>(['Saúde']);

function merchantKey(desc: string): string {
  return normalizeDescription(desc).replace(/[0-9]+/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).join(' ');
}
const similar = (a: number, b: number) => { const d = Math.abs(a - b); return d <= 5 || d <= Math.max(a, b) * 0.05; };
function median(nums: number[]): number { const s = [...nums].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function mode(nums: number[]): number { const c = new Map<number, number>(); let best = nums[0], bestN = 0; for (const n of nums) { const k = (c.get(n) ?? 0) + 1; c.set(n, k); if (k > bestN) { bestN = k; best = n; } } return best; }

/** Tokens de contraparte (nome do destinatário), sem trilho/direção/dígitos. */
function counterpartTokens(norm: string, titularTokens: string[]): string[] {
  const tset = new Set(titularTokens);
  return norm.split(' ').filter((t) => t.length >= 3 && /^[a-z]+$/.test(t) && !RAIL_WORDS.has(t) && !DIRECTION_WORDS.has(t) && !tset.has(t));
}
/** ≥2 tokens do titular presentes na descrição → é o próprio titular. */
function isTitular(norm: string, titularTokens: string[]): boolean {
  if (titularTokens.length < 2) return false;
  const present = titularTokens.filter((t) => t.length >= 3 && new RegExp(`\\b${t}\\b`).test(norm));
  return present.length >= 2;
}

const groupBy = (arr: NormalizedLine[]) => {
  const g = new Map<string, NormalizedLine[]>();
  for (const l of arr) { const k = merchantKey(l.description) || normalizeDescription(l.description); const arr2 = g.get(k) ?? []; arr2.push(l); g.set(k, arr2); }
  return g;
};

export function inferFromLines(lines: NormalizedLine[], meta: InferMeta = {}): ImportSummary {
  const titularTokens = (meta.titular ?? '').split(' ').filter((t) => t.length >= 3);
  const valid = lines.filter((l) => l.date && l.amount > 0);
  const months = [...new Set(valid.map((l) => monthOf(l.date)))].sort();
  const dates = valid.map((l) => l.date).sort();
  const from = dates[0] ?? '', to = dates[dates.length - 1] ?? '';

  const transferenciasProprias: LineRef[] = [];
  const pagamentosFatura: LineRef[] = [];
  const ignorados: Flagged[] = [];
  const duvidosos: Flagged[] = [];
  const expenseCandidates: NormalizedLine[] = [];
  const incomeCandidates: NormalizedLine[] = [];
  let alertaContaMista: string | null = null;

  for (const l of valid) {
    const norm = normalizeDescription(l.description);
    if (has(norm, MIXED_TERMS)) alertaContaMista = 'Esta conta parece ter uso misto PF/PJ. Confirmar antes de classificar renda/despesa.';
    if (l.issues.length > 0) { duvidosos.push({ line: ref(l), reason: `parsing incerto: ${l.issues.join(', ')}` }); continue; }
    if (has(norm, FATURA)) { pagamentosFatura.push(ref(l)); continue; }
    if (has(norm, REEMBOLSO)) { ignorados.push({ line: ref(l), reason: 'estorno/reembolso — não é renda estrutural nem despesa de rotina' }); continue; }

    if (RAIL_RE.test(norm)) {
      // Trilho de pagamento NEUTRO — decide a contraparte, não o trilho.
      if (isTitular(norm, titularTokens) || has(norm, OWN_HINTS)) { transferenciasProprias.push(ref(l)); continue; }
      const cp = counterpartTokens(norm, titularTokens);
      if (cp.length >= 1) { (l.direction === 'saida' ? expenseCandidates : incomeCandidates).push(l); }
      else { duvidosos.push({ line: ref(l), reason: 'transferência/PIX sem contraparte identificável — revisar (gasto, renda ou transferência?)' }); }
      continue;
    }
    (l.direction === 'saida' ? expenseCandidates : incomeCandidates).push(l);
  }

  // ---- Fixas prováveis: recorrência (categoria fixa) OU descrição de fixa (com gate) ----
  const fixasProvaveis: InferredFixed[] = [];
  const variableLines: NormalizedLine[] = [];
  for (const [key, group] of groupBy(expenseCandidates)) {
    const distinctMonths = [...new Set(group.map((l) => monthOf(l.date)))];
    const amounts = group.map((l) => l.amount);
    const rep = median(amounts);
    const recurring = distinctMonths.length >= 2 && amounts.every((a) => similar(a, rep));
    const cat = categorize(group[0].description).category;
    const fixedByNature = FIXED_ELIGIBLE.has(cat);
    const excluded = group.some((l) => has(normalizeDescription(l.description), FIXED_EXCLUDE));
    const fixedByDesc = !excluded && group.some((l) => { const n = normalizeDescription(l.description); return has(n, FIXED_DESC) || PARCELA_RE.test(n); });
    const descAllowed = fixedByNature || cat === 'Outros'; // descrição promove Outros/elegível; nunca categoria variável

    const isFixa = !excluded && ((recurring && fixedByNature) || (fixedByDesc && descAllowed));
    if (isFixa) {
      let conf: InferredFixed['confidence'] = recurring ? (distinctMonths.length >= 3 ? 'alta' : 'media') : 'baixa';
      if (FIXED_LOWER_CONF.has(cat)) conf = 'baixa';
      const reason = recurring && fixedByNature ? 'recorrente e categoria fixa por natureza' : 'descrição indica compromisso fixo (mensalidade/seguro/parcela)';
      fixasProvaveis.push({ key, description: group[0].description, amount: rep, occurrences: group.length, months: distinctMonths.sort(), dayOfMonth: mode(group.map((l) => dayOf(l.date))), confidence: conf, reason });
    } else {
      variableLines.push(...group);
    }
  }

  // ---- Rendas prováveis: crédito recorrente OU indício de salário ----
  const rendasProvaveis: InferredIncome[] = [];
  for (const [key, group] of groupBy(incomeCandidates)) {
    const distinctMonths = [...new Set(group.map((l) => monthOf(l.date)))];
    const rep = median(group.map((l) => l.amount));
    const isSalary = group.some((l) => has(normalizeDescription(l.description), SALARIO));
    if (distinctMonths.length >= 2) {
      rendasProvaveis.push({ key, description: group[0].description, amount: rep, occurrences: group.length, months: distinctMonths.sort(), confidence: distinctMonths.length >= 3 ? 'alta' : 'media', reason: 'crédito recorrente em vários meses' });
    } else if (isSalary) {
      rendasProvaveis.push({ key, description: group[0].description, amount: rep, occurrences: group.length, months: distinctMonths, confidence: 'media', reason: 'descrição indica salário/provento' });
    } else {
      for (const l of group) duvidosos.push({ line: ref(l), reason: 'crédito avulso sem recorrência nem indício de salário — revisar (recebimento? venda? renda?)' });
    }
  }

  // ---- Gastos variáveis (resíduo) → categorias + resíduo por mês ----
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

  // ---- Período parcial: mês inicial/final incompletos ----
  const mesesParciais: string[] = [];
  if (from && dayOf(from) > 1) mesesParciais.push(monthOf(from));
  if (to && dayOf(to) < daysInMonth(monthOf(to)) && !mesesParciais.includes(monthOf(to))) mesesParciais.push(monthOf(to));

  // ---- Dia a dia MEDIDO (resíduo). Só meses COMPLETOS entram na faixa. ----
  const porMes = [...residuePorMes.entries()].map(([monthISO, total]) => ({ monthISO, total: Math.round(total * 100) / 100, parcial: mesesParciais.includes(monthISO) })).sort((a, b) => a.monthISO.localeCompare(b.monthISO));
  const ddIssues: string[] = [];
  const completos = porMes.filter((p) => !p.parcial);
  const baseFaixa = completos.length > 0 ? completos : porMes; // sem mês completo → usa todos, mas avisa
  if (completos.length === 0) ddIssues.push('período parcial — sem mês completo; faixa do dia a dia é aproximada');
  const totais = baseFaixa.map((p) => p.total);
  const diaADia = {
    porMes,
    min: totais.length ? Math.min(...totais) : 0,
    normal: totais.length ? Math.round(median(totais) * 100) / 100 : 0,
    heavy: totais.length ? Math.max(...totais) : 0,
    confidence: (completos.length >= 3 ? 'media' : 'baixa') as 'alta' | 'media' | 'baixa',
    issues: ddIssues,
  };

  const saldo: ImportSummary['saldo'] = meta.accountBalance != null
    ? { valor: meta.accountBalance, fonte: 'movimento' }
    : meta.footerBalance != null ? { valor: meta.footerBalance, fonte: 'rodape' } : { valor: null, fonte: null };

  return {
    period: { from, to, months, mesesParciais },
    counts: { linhas: valid.length, rendas: rendasProvaveis.length, fixas: fixasProvaveis.length, transferenciasProprias: transferenciasProprias.length, pagamentosFatura: pagamentosFatura.length, variaveis: variableLines.length, ignorados: ignorados.length, duvidosos: duvidosos.length },
    saldo, alertaContaMista,
    rendasProvaveis, fixasProvaveis, transferenciasProprias, pagamentosFatura,
    gastosVariaveis: { total: Math.round(variaveisTotal * 100) / 100, byCategory },
    categoriasTop: byCategory.slice(0, 5),
    ignorados, duvidosos, diaADia,
  };
}
