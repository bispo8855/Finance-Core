// ============================================================================
// Aurys Personal — primeira tela (DEMO, rota /personal/demo).
//
// REGRA DE OURO (AP3): a tela NÃO inventa cálculo e NÃO monta frases.
//   - números  → buildPersonalMonth (motor AP2)
//   - frases   → buildPersonalReading / buildPersonalAlerts (domínio)
//   - aqui só  → formatação, cor por sinal, ordenação e layout.
// Fixture fictícia e `today` fixo: a tela é determinística.
// ============================================================================

import { useMemo } from 'react';
import { AlertTriangle, Info, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { buildPersonalMonth } from '@/domain/personal/personalMonth';
import { buildPersonalReading } from '@/domain/personal/personalReading';
import { buildPersonalAlerts } from '@/domain/personal/personalAlerts';
import { addMonthsISO } from '@/domain/personal/cardCycles';
import { Confidence, PersonalMonthResult, ScenarioTriple } from '@/domain/personal/types';
import { PersonalHeroes, ConfidenceDot } from '@/components/personal/PersonalHeroes';
import { PersonalTimeline } from '@/components/personal/PersonalTimeline';
import {
  PERSONAL_DEMO_INPUTS, PERSONAL_DEMO_TODAY, PERSONAL_DEMO_MONTH,
} from '@/data/personalDemoFixture';

const MESES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const rotuloMes = (monthISO: string) =>
  `${MESES[Number(monthISO.slice(5, 7))]}/${monthISO.slice(0, 4)}`;

/** Bloco de uma das duas sobras. Elas NUNCA são somadas nem totalizadas. */
function SobraCard({
  titulo, explicacao, values, confidence,
}: { titulo: string; explicacao: string; values: ScenarioTriple; confidence: Confidence }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{titulo}</p>
        <ConfidenceDot confidence={confidence} />
      </div>
      <p className={cn('mt-2 text-xl font-bold tabular-nums', values.provavel < 0 ? 'text-negative' : 'text-foreground')}>
        {formatCurrency(values.provavel)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
        {formatCurrency(values.conservador)} a {formatCurrency(values.otimista)}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{explicacao}</p>
    </div>
  );
}

export default function PersonalOverview() {
  const result: PersonalMonthResult = useMemo(
    () => buildPersonalMonth(PERSONAL_DEMO_INPUTS, PERSONAL_DEMO_MONTH, PERSONAL_DEMO_TODAY),
    [],
  );
  const leitura = useMemo(() => buildPersonalReading(result), [result]);
  const alertas = useMemo(() => buildPersonalAlerts(result), [result]);

  // Próximos 3 meses: consumo do motor (mês, +1, +2) — nada é derivado aqui.
  const proximosMeses = useMemo(() => {
    const meses = [
      PERSONAL_DEMO_MONTH,
      addMonthsISO(PERSONAL_DEMO_MONTH, 1),
      addMonthsISO(PERSONAL_DEMO_MONTH, 2),
    ];
    return meses.map((m) => ({
      monthISO: m,
      r: buildPersonalMonth(PERSONAL_DEMO_INPUTS, m, PERSONAL_DEMO_TODAY),
    }));
  }, []);

  const { foraDaRotina, jaOcorreuNoMes } = result;
  const temForaDaRotina =
    foraDaRotina.patrimoniais.length > 0 ||
    foraDaRotina.extraordinarios.length > 0 ||
    foraDaRotina.reembolsaveis.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 pb-20">

        {/* SELO DE DEMONSTRAÇÃO (obrigatório) */}
        <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Demonstração com dados fictícios — ainda não conectado às suas contas.
        </div>

        {/* CABEÇALHO */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
            <span>Aurys</span>
            <span className="text-muted-foreground/30">|</span>
            <span>Personal</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Sua visão do mês</h1>
            <Badge variant="outline" className="text-[10px] font-medium">
              {rotuloMes(result.meta.monthISO)}
            </Badge>
          </div>
        </div>

        {/* 1+2 — HERÓI DUPLO e DISPONÍVEL PRUDENTE */}
        <PersonalHeroes result={result} />

        {/* 3 — DUAS SOBRAS lado a lado (NUNCA somadas) */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SobraCard
              titulo="Sobra estrutural"
              explicacao="A sua rotina do mês cabe na sua renda?"
              values={result.sobraEstrutural.values}
              confidence={result.sobraEstrutural.confidence}
            />
            <SobraCard
              titulo="Sobra de caixa"
              explicacao="O que entra menos o que sai da conta neste mês."
              values={result.sobraCaixa.values}
              confidence={result.sobraCaixa.confidence}
            />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Sobra estrutural e sobra de caixa explicam coisas diferentes.
          </p>
        </div>

        {/* 4 — LEITURA DO MÊS (frases vêm prontas do domínio) */}
        {leitura.length > 0 && (
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-base">Leitura do mês</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              {leitura.map((frase, i) => (
                <p key={i} className="text-sm leading-relaxed text-foreground">{frase}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 5 — CALENDÁRIO */}
        <Card>
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              Calendário do caixa
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              De {formatDate(result.meta.asOfDate)} até o fim do mês.
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <PersonalTimeline result={result} />
          </CardContent>
        </Card>

        {/* 6 — PRÓXIMOS 3 MESES */}
        <Card>
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-base">Próximos meses</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Mês</th>
                    <th className="text-right px-4 py-2 font-medium">Saldo projetado (faixa)</th>
                    <th className="text-right px-4 py-2 font-medium">Sobra estrutural</th>
                    <th className="text-right px-4 py-2 font-medium">Sobra de caixa</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {proximosMeses.map(({ monthISO, r }) => (
                    <tr key={monthISO}>
                      <td className="px-4 py-2.5 font-medium capitalize">{rotuloMes(monthISO)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        <span className={cn(r.saldoProjetado.range[0] < 0 && 'text-negative')}>
                          {formatCurrency(r.saldoProjetado.range[0])}
                        </span>
                        {' a '}
                        <span className={cn(r.saldoProjetado.range[1] < 0 && 'text-negative')}>
                          {formatCurrency(r.saldoProjetado.range[1])}
                        </span>
                      </td>
                      <td className={cn('px-4 py-2.5 text-right tabular-nums',
                        r.sobraEstrutural.values.provavel < 0 ? 'text-negative' : 'text-foreground')}>
                        {formatCurrency(r.sobraEstrutural.values.provavel)}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right tabular-nums',
                        r.sobraCaixa.values.provavel < 0 ? 'text-negative' : 'text-foreground')}>
                        {formatCurrency(r.sobraCaixa.values.provavel)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 7 — FORA DA ROTINA (some quando vazio) */}
        {temForaDaRotina && (
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-base">Fora da rotina</CardTitle>
              <p className="text-xs text-muted-foreground">
                Eventos pontuais, separados da sua rotina mensal.
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {[
                { titulo: 'Patrimoniais', itens: foraDaRotina.patrimoniais },
                { titulo: 'Extraordinários', itens: foraDaRotina.extraordinarios },
              ].filter((g) => g.itens.length > 0).map((g) => (
                <div key={g.titulo}>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                    {g.titulo}
                  </p>
                  <div className="space-y-1">
                    {g.itens.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{e.label}</span>
                          <Badge variant="outline" className="text-[10px] font-normal flex-shrink-0">
                            {e.destination}
                          </Badge>
                        </span>
                        <span className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                          <span className="font-medium tabular-nums">{formatCurrency(e.amount)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {foraDaRotina.reembolsaveis.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                    Reembolsáveis
                  </p>
                  <div className="space-y-1">
                    {foraDaRotina.reembolsaveis.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{r.who}</span>
                          <Badge variant="outline" className="text-[10px] font-normal flex-shrink-0">
                            {r.status}
                          </Badge>
                        </span>
                        <span className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">{formatDate(r.expectedDate)}</span>
                          <span className="font-medium tabular-nums">{formatCurrency(r.amount)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 8 — JÁ ACONTECEU NESTE MÊS (contexto R9, nunca projeção) */}
        {jaOcorreuNoMes.length > 0 && (
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-base">Já aconteceu neste mês</CardTitle>
              <p className="text-xs text-muted-foreground">
                Estes lançamentos já estão no seu saldo de hoje — não entram de novo na projeção.
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-1">
                {jaOcorreuNoMes.map((o, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{o.label}</span>
                    <span className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{formatDate(o.date)}</span>
                      <span className={cn('font-medium tabular-nums', o.amount < 0 ? 'text-negative' : 'text-positive')}>
                        {formatCurrency(o.amount)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 9 — ALERTAS (mensagens vêm prontas do domínio) */}
        {alertas.length > 0 && (
          <div className="space-y-2">
            {alertas.map((a) => (
              <div
                key={a.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-sm',
                  a.tone === 'amber'
                    ? 'border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300'
                    : 'border-border bg-muted/40 text-muted-foreground',
                )}
              >
                {a.tone === 'amber'
                  ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  : <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
