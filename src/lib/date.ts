export function formatLocalDateInput(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addMonthsToDateInput(value: string, months: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const source = new Date(year, month - 1, day);
  const targetMonth = source.getMonth() + months;
  const target = new Date(source.getFullYear(), targetMonth, 1);
  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(source.getDate(), lastDayOfTargetMonth));
  return formatLocalDateInput(target);
}

export function formatDateForDisplay(value: string | null | undefined, format = 'YYYY-MM-DD'): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const valid = monthNumber >= 1 && monthNumber <= 12 && dayNumber >= 1 && dayNumber <= new Date(Number(year), monthNumber, 0).getDate();
  if (!valid) return value;

  switch (format) {
    case 'DD/MM/YYYY': return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
    case 'DD-MMM-YYYY': {
      const monthName = new Date(Number(year), monthNumber - 1, 1).toLocaleString('en', { month: 'short' });
      return `${day}-${monthName}-${year}`;
    }
    default: return value;
  }
}