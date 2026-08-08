// ============================================================================
// Aurys Personal — Calendário / trajetória diária com o vale destacado.
//
// REGRA DE OURO: nenhum cálculo aqui. Os pontos vêm prontos de `trajetoria[]`
// (DayPoint do motor AP2). A escala dos eixos é do Recharts — não é aritmética
// nossa sobre dinheiro. Só formatação, cor e layout.
// ============================================================================

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  ReferenceLine, ReferenceArea, Tooltip as RechartsTooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { DayPoint, PersonalMonthResult } from '@/domain/personal/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TimelineTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p: DayPoint = payload[0].payload;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs min-w-[200px]">
      <p className="font-semibold mb-1.5">{formatDate(p.date)}</p>
      <p className="flex justify-between gap-4 mb-1">
        <span className="text-muted-foreground">Saldo:</span>
        <span className={cn('font-bold tabular-nums', p.balance < 0 ? 'text-negative' : 'text-foreground')}>
          {formatCurrency(p.balance)}
        </span>
      </p>
      {p.events.length > 0 && (
        <div className="pt-1.5 border-t space-y-0.5">
          {p.events.map((e, i) => (
            <p key={i} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{e.label}</span>
              <span className={cn('tabular-nums', e.amount < 0 ? 'text-negative' : 'text-positive')}>
                {formatCurrency(e.amount)}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function PersonalTimeline({ result }: { result: PersonalMonthResult }) {
  const { trajetoria, menorSaldo } = result;
  const temVale = menorSaldo.value < 0;

  if (trajetoria.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum dia restante no período para projetar.
      </p>
    );
  }

  // Só dias COM evento entram na lista textual (o gráfico mostra a curva completa).
  const diasComEvento = trajetoria.filter((p) => p.events.length > 0);

  // Faixa do vale ancorada às datas EXIBIDAS. O vale pode terminar depois do fim do mês
  // (ex.: 26/07 → 01/08); nesse caso o eixo não conhece a data final e o Recharts não
  // desenharia nada. Destacamos o trecho visível — o período real continua escrito por
  // extenso no herói e no alerta, então nada é escondido. Clamp de renderização, não cálculo.
  const datasExibidas = trajetoria.map((p) => p.date);
  const valeX1 = menorSaldo.valeStart && datasExibidas.includes(menorSaldo.valeStart)
    ? menorSaldo.valeStart
    : datasExibidas[0];
  const valeX2 = menorSaldo.valeEnd && datasExibidas.includes(menorSaldo.valeEnd)
    ? menorSaldo.valeEnd
    : datasExibidas[datasExibidas.length - 1];

  // Extensão VERTICAL do gráfico e da faixa — geometria de layout (pixels do destaque),
  // não um valor financeiro exibido. Inclui o zero para o mês todo-negativo mostrar a linha
  // do zero. A ReferenceArea desta versão do Recharts só desenha o retângulo quando recebe
  // também y1/y2; sem eles (só x1/x2) o retângulo não é criado.
  const saldos = trajetoria.map((p) => p.balance);
  const yTopo = Math.max(0, ...saldos);
  const yBase = Math.min(0, ...saldos);

  return (
    <div className="space-y-4">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trajetoria} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
              dy={8}
            />
            {/* Domínio [yBase, yTopo] inclui o zero — a linha do zero fica visível mesmo num
                mês todo negativo, e a faixa do vale ocupa a altura toda do gráfico. */}
            <YAxis
              domain={[yBase, yTopo]}
              tickFormatter={(v: number) => formatCurrency(v)}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={92}
            />
            <RechartsTooltip content={<TimelineTooltip />} />
            {/* Faixa do vale: só quando o motor diz que há vale */}
            {/* ifOverflow=extendDomain: quando todos os saldos são negativos, a linha do zero
                e a faixa cairiam fora do domínio auto do eixo e o Recharts as descartaria.
                extendDomain estende o eixo Y para incluir o zero (referência honesta do negativo). */}
            {temVale && (
              <ReferenceArea
                x1={valeX1}
                x2={valeX2}
                y1={yBase}
                y2={yTopo}
                fill="hsl(var(--destructive))"
                fillOpacity={0.08}
              />
            )}
            <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {temVale && (
        <p className="text-xs text-amber-700 dark:text-amber-500">
          Faixa destacada: período em que o saldo fica negativo antes da próxima entrada.
        </p>
      )}

      {diasComEvento.length > 0 && (
        <div className="border rounded-lg divide-y">
          {diasComEvento.map((p) => (
            <div key={p.date} className="px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium">{formatDate(p.date)}</span>
                <span className={cn('text-xs font-semibold tabular-nums', p.balance < 0 ? 'text-negative' : 'text-foreground')}>
                  {formatCurrency(p.balance)}
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                {p.events.map((e, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <span>{e.label}</span>
                    <span className={cn('tabular-nums', e.amount < 0 ? 'text-negative' : 'text-positive')}>
                      {formatCurrency(e.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
