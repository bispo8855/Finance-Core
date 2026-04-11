export type PeriodOption = 'current_month' | 'previous_month' | 'last_3_months' | 'all';

export function getPeriodRange(period: PeriodOption): { start: Date | null, end: Date | null } {
  const now = new Date();
  
  if (period === 'current_month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    };
  }
  
  if (period === 'previous_month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    };
  }
  
  if (period === 'last_3_months') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    };
  }
  
  return { start: null, end: null };
}

export function isDateInPeriod(dateStr: string, period: PeriodOption): boolean {
  if (period === 'all') return true;
  
  const { start, end } = getPeriodRange(period);
  if (!start || !end) return true;

  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  return date >= start && date <= end;
}
