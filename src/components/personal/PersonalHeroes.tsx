// ============================================================================
// Aurys Personal — Herói duplo + Disponível prudente.
//
// REGRA DE OURO: este componente NÃO calcula. Todo número vem pronto do
// PersonalMonthResult (motor AP2). Aqui só existe: formatação, cor por sinal e layout.
// ============================================================================

import { ShieldCheck, TrendingDown, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Confidence, PersonalMonthResult } from '@/domain/personal/types';

const CONFIDENCE_UI: Record<Confidence, { dot: string; label: string }> = {
  alta: { dot: 'bg-emerald-500', label: 'Confiança alta' },
  media: { dot: 'bg-amber-500', label: 'Confiança média — estimativa' },
  baixa: { dot: 'bg-red-500', label: 'Confiança baixa — a confirmar' },
};

/** Ponto discreto de confiança (AP1 §4.3: nunca banner, nunca porcentagem). */
export function ConfidenceDot({ confidence }: { confidence: Confidence }) {
  const ui = CONFIDENCE_UI[confidence];
  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', ui.dot)}
      title={ui.label}
      aria-label={ui.label}
    />
  );
}

export function PersonalHeroes({ result }: { result: PersonalMonthResult }) {
  const { saldoProjetado, menorSaldo, saldoAtual, disponivelPrudente } = result;
  const temVale = menorSaldo.value < 0;
  const semFolga = disponivelPrudente.value <= 0;

  // AP3.1 — quando o disponível já é zero PORQUE o saldo projetado fecha negativo, listar as
  // deduções integrais (incl. patrimoniais futuros travados) confunde: parece que havia folga
  // sendo consumida. Neste caso, trocamos por uma leitura EM CAMADAS. Não é número novo — são
  // explicações exibidas/ocultadas com base em campos que já vêm do motor.
  const zeradoPorSaldoNegativo = disponivelPrudente.value === 0 && saldoProjetado.range[0] < 0;
  const temReembolsoPendente = result.foraDaRotina.reembolsaveis.some((r) => r.status !== 'recebido');
  const camadasZerado = [
    'Seu saldo projetado ainda fecha negativo.',
    ...(temVale ? ['Existe um vale de caixa antes da próxima entrada.'] : []),
    ...(temReembolsoPendente ? ['Reembolsos ainda não recebidos podem apertar o mês.'] : []),
  ];

  return (
    <div className="space-y-4">
      {/* HERÓI DUPLO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Herói 1 — saldo projetado em FAIXA (nunca valor único) */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Saldo projetado no fim do mês
            </p>
            <ConfidenceDot confidence={saldoProjetado.confidence} />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            <span className={cn(saldoProjetado.range[0] < 0 ? 'text-negative' : 'text-foreground')}>
              {formatCurrency(saldoProjetado.range[0])}
            </span>
            <span className="mx-2 text-base font-normal text-muted-foreground">a</span>
            <span className={cn(saldoProjetado.range[1] < 0 ? 'text-negative' : 'text-foreground')}>
              {formatCurrency(saldoProjetado.range[1])}
            </span>
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Projeção prudente — não é dinheiro livre.
          </p>
          <p className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            Saldo hoje:{' '}
            <span className={cn('font-semibold tabular-nums', saldoAtual.value < 0 ? 'text-negative' : 'text-foreground')}>
              {formatCurrency(saldoAtual.value)}
            </span>
          </p>
        </div>

        {/* Herói 2 — menor saldo antes da próxima renda */}
        <div className={cn(
          'rounded-xl border p-5',
          temVale ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10' : 'bg-card',
        )}>
          <div className="flex items-center gap-2">
            {temVale
              ? <TrendingDown className="w-4 h-4 text-amber-600 flex-shrink-0" />
              : <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Menor saldo antes da próxima renda
            </p>
            <ConfidenceDot confidence={menorSaldo.confidence} />
          </div>
          <p className={cn('mt-2 text-2xl font-bold tabular-nums', menorSaldo.value < 0 ? 'text-negative' : 'text-foreground')}>
            {formatCurrency(menorSaldo.value)}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {temVale && menorSaldo.valeStart && menorSaldo.valeEnd
              ? <>Negativo de {formatDate(menorSaldo.valeStart)} a {formatDate(menorSaldo.valeEnd)}</>
              : <>Menor ponto em {formatDate(menorSaldo.date)}</>}
          </p>
        </div>
      </div>

      {/* DISPONÍVEL PRUDENTE — o ÚNICO número apresentável como "para gastar" */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Disponível prudente para gastar
          </p>
          <ConfidenceDot confidence={disponivelPrudente.confidence} />
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
          {formatCurrency(disponivelPrudente.value)}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Disponível para gastar já desconta colchão, reserva e compromissos.
        </p>

        {semFolga && (
          <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-500">
            Sem folga prudente este mês.
          </p>
        )}

        {zeradoPorSaldoNegativo ? (
          <div className="mt-3 pt-3 border-t space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Por que está zerado
            </p>
            {camadasZerado.map((linha) => (
              <p key={linha} className="text-xs text-muted-foreground">{linha}</p>
            ))}
          </div>
        ) : disponivelPrudente.deducoes.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Por que não é dinheiro livre
            </p>
            {disponivelPrudente.deducoes.map((d) => (
              <div key={d.label} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-medium tabular-nums text-foreground">{formatCurrency(d.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
