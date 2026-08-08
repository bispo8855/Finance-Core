// ============================================================================
// Aurys Personal — Leitura do mês (frases determinísticas, tom consultor).
// PURO: função do PersonalMonthResult. A UI apenas renderiza as strings.
//
// Decisão de formatação (AP3 §1): o DOMÍNIO formata a moeda internamente, por
// helper próprio, e devolve a frase pronta. Motivo: uma frase é uma unidade de
// sentido — quebrá-la em template + valores obrigaria a UI a remontar texto,
// que é exatamente o que a regra de ouro proíbe.
//
// PROIBIDO nas frases: "sobra real" (nome comercial, nunca rótulo de número).
// ============================================================================

import { PersonalMonthResult } from './types';

const MAX_FRASES = 4;

/** Materialidade da divergência estrutural × caixa: 10% da maior das duas. */
const LIMIAR_DIVERGENCIA = 0.1;

function brl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Dia do mês, sem zero à esquerda ('2026-07-16' → '16'). */
function dia(dateISO: string): string {
  return String(Number(dateISO.slice(8, 10)));
}

/**
 * Janela do vale por extenso. Quando início e fim caem no MESMO mês, usa "os dias X e Y"
 * (texto do desenho). Quando o vale cruza a virada do mês, "entre os dias 26 e 1" seria
 * ambíguo — então usa dd/mm, que é a mesma informação sem ler ao contrário.
 */
function janelaVale(startISO: string, endISO: string): string {
  const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return startISO.slice(0, 7) === endISO.slice(0, 7)
    ? `os dias ${dia(startISO)} e ${dia(endISO)}`
    : `${ddmm(startISO)} e ${ddmm(endISO)}`;
}

export function buildPersonalReading(result: PersonalMonthResult): string[] {
  const frases: string[] = [];

  // 1) Veredito de calendário — a tese do produto. Só quando existe o vale.
  if (result.menorSaldo.value < 0) {
    const { valeStart, valeEnd, date } = result.menorSaldo;
    if (valeStart && valeEnd && valeStart !== valeEnd) {
      frases.push(
        `Você tem sobra, mas ela está presa no calendário: entre ${janelaVale(valeStart, valeEnd)} ` +
        `seu saldo fica negativo antes da próxima entrada.`,
      );
    } else {
      frases.push(
        `Você tem sobra, mas ela está presa no calendário: no dia ${dia(valeStart ?? date)} ` +
        `seu saldo fica negativo antes da próxima entrada.`,
      );
    }
  }

  // 2) Saldo × comprometido.
  //    Guarda de honestidade: o texto do desenho ("parte disso já está comprometida") pressupõe
  //    saldo POSITIVO — com saldo negativo não existe "parte comprometida", e a frase mentiria.
  //    Saldo negativo com rotina positiva é o caso T6 (buraco acumulado, não falta de renda).
  const saldo = result.saldoAtual.value;
  if (saldo >= 0) {
    frases.push(
      `Seu saldo hoje é ${brl(saldo)}, mas parte disso já está comprometida ` +
      `com faturas e contas do mês.`,
    );
  } else if (result.sobraEstrutural.values.provavel > 0) {
    frases.push(
      `Seu saldo hoje está negativo em ${brl(Math.abs(saldo))} — isso é buraco acumulado, ` +
      `não falta de renda: a sua rotina do mês fecha positiva.`,
    );
  } else {
    frases.push(
      `Seu saldo hoje está negativo em ${brl(Math.abs(saldo))} e a sua rotina do mês ` +
      `também não está fechando positiva.`,
    );
  }

  // 3) Estrutural × caixa — só quando a divergência é MATERIAL e a direção sustenta a frase.
  //    Guarda de honestidade: "sua rotina cabe na renda" exige estrutural > 0, e "o caixa está
  //    mais apertado" exige caixa < estrutural. Fora disso a frase mentiria, então não sai.
  const est = result.sobraEstrutural.values.provavel;
  const cx = result.sobraCaixa.values.provavel;
  const maior = Math.max(Math.abs(est), Math.abs(cx));
  const material = maior > 0 && Math.abs(est - cx) > maior * LIMIAR_DIVERGENCIA;
  if (est > 0 && cx < est && material) {
    frases.push(
      `Sua rotina cabe na renda (${brl(est)}), mas o caixa do mês está mais apertado ` +
      `(${brl(cx)}) porque você paga faturas formadas antes.`,
    );
  }

  // 4) Fora da rotina — só se houver evento pontual.
  const foraSoma = [
    ...result.foraDaRotina.extraordinarios,
    ...result.foraDaRotina.patrimoniais,
  ].reduce((s, e) => s + e.amount, 0);
  if (foraSoma > 0) {
    frases.push(
      `No horizonte analisado, ${brl(foraSoma)} aparecem como eventos pontuais e não ` +
      `fazem parte da sua rotina mensal.`,
    );
  }

  return frases.slice(0, MAX_FRASES);
}
