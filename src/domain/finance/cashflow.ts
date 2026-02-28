import { Title, Movement, BankAccount } from '@/types/financial';

export interface CashflowLine {
  date: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export interface CashflowResult {
  lines: CashflowLine[];
  alertas: string[];
}

export function calculateCashflow({
  titles,
  movements,
  accounts,
  startDateISO, // Ex: '2026-02-01'
  rangeDays,
  initialBalancesOverride
}: {
  titles: Title[];
  movements: Movement[];
  accounts: BankAccount[];
  startDateISO: string;
  rangeDays: number;
  initialBalancesOverride?: Record<string, number>;
}): CashflowResult {
  let currentBalance = 0;
  if (initialBalancesOverride) {
    currentBalance = Object.values(initialBalancesOverride).reduce((sum, v) => sum + v, 0);
  } else {
    currentBalance = accounts.reduce((acc, a) => acc + a.initialBalance, 0);
    const priorMovements = movements.filter(m => m.paymentDate < startDateISO);
    currentBalance += priorMovements.reduce((acc, m) => acc + (m.type === 'entrada' ? m.valuePaid : -m.valuePaid), 0);
  }

  const lines: CashflowLine[] = [];
  const start = new Date(startDateISO + 'T12:00:00');
  
  const moveMap = new Map<string, { entradas: number; saidas: number }>();
  const titleMap = new Map<string, { entradas: number; saidas: number }>();

  for (const m of movements) {
    if (m.paymentDate >= startDateISO) {
      if (!moveMap.has(m.paymentDate)) moveMap.set(m.paymentDate, { entradas: 0, saidas: 0 });
      const curr = moveMap.get(m.paymentDate)!;
      if (m.type === 'entrada') curr.entradas += m.valuePaid;
      else curr.saidas += m.valuePaid;
    }
  }

  for (const t of titles) {
    if (t.status === 'previsto' || t.status === 'atrasado') {
      let dDate = t.dueDate;
      if (t.status === 'atrasado' && dDate < startDateISO) {
        dDate = startDateISO; // Projetar títulos atrasados para o primeiro dia visível
      }
      if (dDate >= startDateISO) {
        if (!titleMap.has(dDate)) titleMap.set(dDate, { entradas: 0, saidas: 0 });
        const curr = titleMap.get(dDate)!;
        if (t.type === 'receber') curr.entradas += t.value;
        else curr.saidas += t.value;
      }
    }
  }

  const alertas: string[] = [];

  for (let i = 0; i < rangeDays; i++) {
    const curDate = new Date(start);
    curDate.setDate(curDate.getDate() + i);
    const dateStr = curDate.toISOString().split('T')[0];

    let entradas = 0;
    let saidas = 0;

    const moves = moveMap.get(dateStr);
    if (moves) {
      entradas += moves.entradas;
      saidas += moves.saidas;
    }
    const tits = titleMap.get(dateStr);
    if (tits) {
      entradas += tits.entradas;
      saidas += tits.saidas;
    }

    currentBalance += (entradas - saidas);

    lines.push({
      date: dateStr,
      entradas,
      saidas,
      saldo: currentBalance
    });

    if (currentBalance < 0 && !alertas.includes(`Saldo negativo projetado no dia ${dateStr.substring(8, 10)}`)) {
      alertas.push(`Saldo negativo projetado no dia ${dateStr.substring(8, 10)}`);
    }
  }

  return { lines, alertas };
}
