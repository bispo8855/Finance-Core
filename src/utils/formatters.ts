// Utilities for formatting currencies and dates

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateString: string | Date): string {
  if (!dateString) return '';

  let date: Date;
  // Strings 'YYYY-MM-DD' (sem hora) devem ser interpretadas como data LOCAL.
  // new Date('2026-06-01') parseia como meia-noite UTC e, em fusos negativos (ex.: BRT),
  // exibiria o dia anterior. Strings com hora e objetos Date mantêm o comportamento padrão.
  if (typeof dateString === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    date = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(dateString);
  } else {
    date = new Date(dateString);
  }

  if (isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}
