// ============================================================================
// Aurys Personal — Alertas (determinísticos, no máximo 3).
// PURO: função do PersonalMonthResult. A UI apenas renderiza mensagem + tom.
//
// V1: o alerta de "fatura pesada" foi CORTADO (decisão do orquestrador) — dependeria
// de `rendaDoMes`, que o motor AP2 não expõe. Sem dado, não se inventa alerta.
// ============================================================================

import { PersonalMonthResult } from './types';

export type PersonalAlertTone = 'amber' | 'info';

export interface PersonalAlert {
  id: string;
  tone: PersonalAlertTone;
  message: string;
}

const MAX_ALERTAS = 3;

function brl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function dia(dateISO: string): string {
  return String(Number(dateISO.slice(8, 10)));
}

/** Mesma regra da leitura: dd/mm quando o vale cruza a virada do mês (senão "26 e 1" confunde). */
function janelaVale(startISO: string, endISO: string): string {
  const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return startISO.slice(0, 7) === endISO.slice(0, 7)
    ? `os dias ${dia(startISO)} e ${dia(endISO)}`
    : `${ddmm(startISO)} e ${ddmm(endISO)}`;
}

/**
 * Alertas em ordem de PRIORIDADE (os 3 primeiros aplicáveis vencem):
 *   1. descasamento     (âmbar) — o vale de calendário
 *   2. reembolso_risco  (âmbar) — dinheiro de terceiro ainda não devolvido
 *   3. confianca_baixa  (info)  — projeção sustentada por premissa fraca
 *   4. fora_da_rotina   (info)  — evento pontual segregado
 */
export function buildPersonalAlerts(result: PersonalMonthResult): PersonalAlert[] {
  const alertas: PersonalAlert[] = [];

  // 1) Descasamento de calendário
  if (result.menorSaldo.value < 0) {
    const { valeStart, valeEnd, date, value } = result.menorSaldo;
    const janela = valeStart && valeEnd && valeStart !== valeEnd
      ? `Entre ${janelaVale(valeStart, valeEnd)}`
      : `No dia ${dia(valeStart ?? date)}`;
    alertas.push({
      id: 'descasamento',
      tone: 'amber',
      // brl(Math.abs): "negativo (-R$ 4.493,68)" seria duplamente negativo.
      message: `${janela} seu saldo fica negativo (${brl(Math.abs(value))}) antes da próxima entrada.`,
    });
  }

  // 2) Reembolsos ainda não recebidos (R5 — risco de timing, não renda)
  const pendentes = result.foraDaRotina.reembolsaveis.filter((r) => r.status !== 'recebido');
  if (pendentes.length > 0) {
    const soma = pendentes.reduce((s, r) => s + Math.abs(r.amount), 0);
    const plural = pendentes.length === 1 ? 'reembolso' : 'reembolsos';
    alertas.push({
      id: 'reembolso_risco',
      tone: 'amber',
      message: `${pendentes.length} ${plural} de ${brl(soma)} ainda não recebidos — se atrasarem, o mês aperta.`,
    });
  }

  // 3) Confiança baixa em número-herói
  if (result.saldoProjetado.confidence === 'baixa' || result.disponivelPrudente.confidence === 'baixa') {
    alertas.push({
      id: 'confianca_baixa',
      tone: 'info',
      message: 'Alguns números têm baixa confiança. Confirme datas e valores para melhorar a projeção.',
    });
  }

  // 4) Fora da rotina
  const fora = [...result.foraDaRotina.patrimoniais, ...result.foraDaRotina.extraordinarios];
  if (fora.length > 0) {
    const soma = fora.reduce((s, e) => s + e.amount, 0);
    alertas.push({
      id: 'fora_da_rotina',
      tone: 'info',
      message: `${brl(soma)} são eventos pontuais e estão separados da sua rotina.`,
    });
  }

  return alertas.slice(0, MAX_ALERTAS);
}
