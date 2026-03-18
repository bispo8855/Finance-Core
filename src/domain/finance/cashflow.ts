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
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  hasMissingOpeningDates: boolean;
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
  let hasMissingOpeningDates = false;

  if (initialBalancesOverride) {
    currentBalance = Object.values(initialBalancesOverride).reduce((sum, v) => sum + v, 0);
  } else {
    for (const account of accounts) {
      if (!account.openingBalanceDate) hasMissingOpeningDates = true;
      const openDate = account.openingBalanceDate || '1970-01-01';
      
      if (openDate <= startDateISO) {
        currentBalance += account.openingBalance;
        
        const accountPriorMovements = movements.filter(m => 
          m.accountId === account.id && 
          m.paymentDate >= openDate && 
          m.paymentDate < startDateISO
        );
        
        const movementsSum = accountPriorMovements.reduce((sum, m) => 
          sum + (m.type === 'entrada' ? m.valuePaid : -m.valuePaid), 0
        );
        currentBalance += movementsSum;
      }
    }
  }

  const lines: CashflowLine[] = [];
  const start = new Date(startDateISO + 'T12:00:00');
  
  const moveMap = new Map<string, { entradas: number; saidas: number }>();
  
  // Apply future opening balances as inflows/outflows
  for (const account of accounts) {
    const openDate = account.openingBalanceDate || '1970-01-01';
    if (openDate > startDateISO) {
      if (!moveMap.has(openDate)) moveMap.set(openDate, { entradas: 0, saidas: 0 });
      const curr = moveMap.get(openDate)!;
      if (account.openingBalance > 0) curr.entradas += account.openingBalance;
      else if (account.openingBalance < 0) curr.saidas += Math.abs(account.openingBalance);
    }
  }
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
    if (t.status === 'previsto') {
      const dDate = t.dueDate;
      if (dDate >= startDateISO) {
        if (!titleMap.has(dDate)) titleMap.set(dDate, { entradas: 0, saidas: 0 });
        const curr = titleMap.get(dDate)!;
        if (t.side === 'receber') curr.entradas += t.value;
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

  const totalEntradas = lines.reduce((acc, l) => acc + l.entradas, 0);
  const totalSaidas = lines.reduce((acc, l) => acc + l.saidas, 0);
  const saldoFinal = currentBalance;

  return { lines, alertas, totalEntradas, totalSaidas, saldoFinal, hasMissingOpeningDates };
}
