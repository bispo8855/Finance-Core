import { Title } from '@/types/financial';

// Projeção do mês — aritmética pura dos lançamentos previstos (SEM heurística).
// É sempre rotulada como PROJEÇÃO, nunca como resultado realizado.

export interface MonthProjection {
  projecao: number;
  aReceberPrevisto: number;
  aPagarPrevisto: number;
}

// Títulos elegíveis: ainda em aberto (previsto/atrasado/vencido). Renegociados,
// pagos, recebidos e cancelados NÃO entram.
const OPEN_STATUS = ['previsto', 'atrasado', 'vencido'];

export function lastDayOfMonthISO(monthISO: string): string {
  const [y, m] = monthISO.split('-').map(Number);
  // new Date(y, m, 0): m é 1-based aqui → dia 0 do mês seguinte = último dia do mês m.
  const day = new Date(y, m, 0).getDate();
  return `${monthISO}-${String(day).padStart(2, '0')}`;
}

export function buildMonthProjection(
  resultadoRealizado: number,
  titles: Title[],
  monthISO: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  todayISO: string
): MonthProjection {
  const lastDay = lastDayOfMonthISO(monthISO);

  const eligible = titles.filter(
    (t) => OPEN_STATUS.includes(t.status) && (t.dueDate || '').slice(0, 10) <= lastDay
  );

  const aReceberPrevisto = eligible
    .filter((t) => t.side === 'receber')
    .reduce((s, t) => s + t.value, 0);

  const aPagarPrevisto = eligible
    .filter((t) => t.side === 'pagar')
    .reduce((s, t) => s + t.value, 0);

  const projecao = resultadoRealizado + aReceberPrevisto - aPagarPrevisto;

  return { projecao, aReceberPrevisto, aPagarPrevisto };
}
