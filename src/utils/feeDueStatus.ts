export type FeeDueStatus = 'upcoming' | 'due_today' | 'overdue' | 'unscheduled';

const toLocalDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const getFeeDueStatus = (dueDate: string | null | undefined, now = new Date()) => {
  if (!dueDate) return { status: 'unscheduled' as const, daysLate: 0, label: 'No due date' };
  const today = toLocalDateKey(now);
  if (dueDate > today) return { status: 'upcoming' as const, daysLate: 0, label: 'Upcoming' };
  if (dueDate === today) return { status: 'due_today' as const, daysLate: 0, label: 'Due today' };

  const [year, month, day] = dueDate.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLate = Math.max(1, Math.round((current.getTime() - due.getTime()) / 86400000));
  return { status: 'overdue' as const, daysLate, label: `${daysLate} day${daysLate === 1 ? '' : 's'} late` };
};

export const isActionableFeeDue = (dueDate: string | null | undefined, now = new Date()) => {
  const status = getFeeDueStatus(dueDate, now).status;
  return status === 'due_today' || status === 'overdue' || status === 'unscheduled';
};
