export type PeriodOption = 'current_month' | 'previous_month' | 'last_3_months' | 'all';

export function isDateInPeriod(dateStr: string, period: PeriodOption): boolean {
  if (period === 'all') return true;
  
  // Parse date assuming YYYY-MM-DD
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  if (period === 'current_month') {
    return date >= currentMonthStart && date <= currentMonthEnd;
  }
  
  if (period === 'previous_month') {
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return date >= prevMonthStart && date <= prevMonthEnd;
  }
  
  if (period === 'last_3_months') {
    const threeMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return date >= threeMonthsAgoStart && date <= currentMonthEnd;
  }
  
  return true;
}
