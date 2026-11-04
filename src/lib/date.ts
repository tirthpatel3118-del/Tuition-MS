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
