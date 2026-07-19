import { Title, Movement, BankAccount } from '@/types/financial';

export interface CashflowDetail {
  id: string;
  description: string;
  value: number;
  type: 'entrada' | 'saida';
  origin: 'title' | 'movement';
}

export interface CashflowLine {
  date: string;
  entradas: number;
  saidas: number;
  saldo: number;
  details: CashflowDetail[];
}

export type RiskState = 'saudavel' | 'atencao' | 'critico';

export interface CashflowResult {
  lines: CashflowLine[];
  alertas: string[];
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  hasMissingOpeningDates: boolean;
  minBalance: number;
  minBalanceDate: string | null;
  riskState: RiskState;
  initialBalance: number;
  // FC1 — Pendências vencidas (dueDate < startDateISO, status aberto).
  // NÃO entram na projeção (lines/totalEntradas/totalSaidas/saldoFinal/minBalance):
  // vencido é sinal de risco imediato, não previsão de futuro.
  overdueReceber: number;
  overduePagar: number;
  /** initialBalance + overdueReceber − overduePagar (leitura líquida). */
  caixaAposPendencias: number;
  /** initialBalance − overduePagar. Só obrigação certa; o risco usa este piso. */
  pisoConservador: number;
  hasOverdue: boolean;
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

  const initialBalance = currentBalance;
  const lines: CashflowLine[] = [];
  const start = new Date(startDateISO + 'T12:00:00');
  
  const moveMap = new Map<string, { entradas: number; saidas: number; items: CashflowDetail[] }>();
  
  // Apply future opening balances as inflows/outflows
  for (const account of accounts) {
    const openDate = account.openingBalanceDate || '1970-01-01';
    if (openDate > startDateISO) {
      if (!moveMap.has(openDate)) moveMap.set(openDate, { entradas: 0, saidas: 0, items: [] });
      const curr = moveMap.get(openDate)!;
      if (account.openingBalance > 0) {
        curr.entradas += account.openingBalance;
        curr.items.push({ id: `acc-in-${account.id}`, description: `Saldo Inicial: ${account.name}`, value: account.openingBalance, type: 'entrada', origin: 'movement' });
      } else if (account.openingBalance < 0) {
        curr.saidas += Math.abs(account.openingBalance);
        curr.items.push({ id: `acc-out-${account.id}`, description: `Saldo Inicial Negativo: ${account.name}`, value: Math.abs(account.openingBalance), type: 'saida', origin: 'movement' });
      }
    }
  }

  const titleMap = new Map<string, { entradas: number; saidas: number; items: CashflowDetail[] }>();

  // Realized values come from movements
  for (const m of movements) {
    if (m.paymentDate >= startDateISO) {
      if (!moveMap.has(m.paymentDate)) moveMap.set(m.paymentDate, { entradas: 0, saidas: 0, items: [] });
      const curr = moveMap.get(m.paymentDate)!;
      if (m.type === 'entrada') {
        curr.entradas += m.valuePaid;
        curr.items.push({ id: m.id, description: m.description, value: m.valuePaid, type: 'entrada', origin: 'movement' });
      } else {
        curr.saidas += m.valuePaid;
        curr.items.push({ id: m.id, description: m.description, value: m.valuePaid, type: 'saida', origin: 'movement' });
      }
    }
  }

  // Predicted values come from OPEN titles only
  for (const t of titles) {
    if (t.status === 'previsto' || t.status === 'atrasado') {
      const dDate = t.dueDate;
      if (dDate >= startDateISO) {
        if (!titleMap.has(dDate)) titleMap.set(dDate, { entradas: 0, saidas: 0, items: [] });
        const curr = titleMap.get(dDate)!;
        if (t.side === 'receber') {
          curr.entradas += t.value;
          curr.items.push({ id: t.id, description: t.description, value: t.value, type: 'entrada', origin: 'title' });
        } else {
          curr.saidas += t.value;
          curr.items.push({ id: t.id, description: t.description, value: t.value, type: 'saida', origin: 'title' });
        }
      }
    }
  }

  // FC1 — passada extra sobre os títulos: pendências VENCIDAS.
  // Disjunto da projeção pela fronteira de hoje (projeção usa dueDate >= startDateISO),
  // portanto não há dupla contagem. Ao liquidar, o título vira movimento e sai daqui.
  let overdueReceber = 0;
  let overduePagar = 0;
  for (const t of titles) {
    if (t.status !== 'previsto' && t.status !== 'atrasado') continue;
    if (t.dueDate >= startDateISO) continue;
    if (t.side === 'receber') overdueReceber += t.value;
    else overduePagar += t.value;
  }
  const caixaAposPendencias = initialBalance + overdueReceber - overduePagar;
  const pisoConservador = initialBalance - overduePagar;
  const hasOverdue = overdueReceber > 0 || overduePagar > 0;

  const alertas: string[] = [];
  let minBalance = Infinity;
  let minBalanceDate: string | null = null;

  for (let i = 0; i < rangeDays; i++) {
    const curDate = new Date(start);
    curDate.setDate(curDate.getDate() + i);
    const dateStr = curDate.toISOString().split('T')[0];

    let entradas = 0;
    let saidas = 0;
    const details: CashflowDetail[] = [];

    const moves = moveMap.get(dateStr);
    if (moves) {
      entradas += moves.entradas;
      saidas += moves.saidas;
      details.push(...moves.items);
    }
    const tits = titleMap.get(dateStr);
    if (tits) {
      entradas += tits.entradas;
      saidas += tits.saidas;
      details.push(...tits.items);
    }

    currentBalance += (entradas - saidas);

    if (currentBalance < minBalance) {
      minBalance = currentBalance;
      minBalanceDate = dateStr;
    }

    lines.push({
      date: dateStr,
      entradas,
      saidas,
      saldo: currentBalance,
      details
    });

    if (currentBalance < 0 && !alertas.includes(`Saldo negativo projetado no dia ${dateStr.substring(8, 10)}`)) {
      alertas.push(`Saldo negativo projetado no dia ${dateStr.substring(8, 10)}`);
    }
  }

  if (minBalance === Infinity) minBalance = currentBalance;

  // FC1 — risco pelo PIOR caso entre projeção e piso conservador.
  // O a receber vencido nunca melhora o risco (é incerto): só o pisoConservador entra.
  // A regra dos 50% só tem leitura com initialBalance > 0.
  let riskState: RiskState = 'saudavel';
  if (minBalance < 0 || pisoConservador < 0) {
    riskState = 'critico';
  } else if (
    initialBalance > 0 &&
    (minBalance < initialBalance * 0.5 ||
      (hasOverdue && pisoConservador < initialBalance * 0.5))
  ) {
    riskState = 'atencao';
  }

  const totalEntradas = lines.reduce((acc, l) => acc + l.entradas, 0);
  const totalSaidas = lines.reduce((acc, l) => acc + l.saidas, 0);
  const saldoFinal = currentBalance;

  return {
    lines, alertas, totalEntradas, totalSaidas, saldoFinal, hasMissingOpeningDates,
    minBalance, minBalanceDate, riskState, initialBalance,
    overdueReceber, overduePagar, caixaAposPendencias, pisoConservador, hasOverdue,
  };
}
