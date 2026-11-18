export type SubscriptionCycle = "monthly" | "yearly";

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatLocalDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetMonth = date.getMonth() + months;
  const firstOfTarget = new Date(date.getFullYear(), targetMonth, 1);
  const lastDay = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
  return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(date.getDate(), lastDay));
}

export function calculateSubscriptionDates(startDate: string, cycle: SubscriptionCycle) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("Choose a valid period start date.");
  const start = parseLocalDate(startDate);
  if (Number.isNaN(start.getTime()) || formatLocalDate(start) !== startDate) throw new Error("Choose a valid period start date.");
  const endExclusive = addMonthsClamped(start, cycle === "monthly" ? 1 : 12);
  endExclusive.setDate(endExclusive.getDate() - 1);
  return {
    periodStart: startDate,
    periodEnd: formatLocalDate(endExclusive),
    dueAt: startDate,
  };
}

export function classifyBillingDueDate(dueDate: string, today: string) {
  if (dueDate < today) return "overdue" as const;
  if (dueDate === today) return "due_today" as const;
  return "upcoming" as const;
}

export function daysOverdue(dueDate: string, today: string) {
  const difference = parseLocalDate(today).getTime() - parseLocalDate(dueDate).getTime();
  return Math.max(0, Math.floor(difference / 86_400_000));
}

export function toWhatsAppPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function buildSubscriptionReminderMessage(input: {
  instituteName: string;
  invoiceNumber: string;
  billingCycle: SubscriptionCycle;
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  amountInr: number;
  overdueDays?: number;
}) {
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(input.amountInr);
  const due = new Date(input.dueAt + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const status = input.overdueDays && input.overdueDays > 0
    ? `This payment is overdue by ${input.overdueDays} day(s).`
    : "This payment is due today.";
  return [
    `Hello ${input.instituteName},`,
    "",
    `A friendly reminder for your EduLedger ${input.billingCycle} subscription.`,
    `Invoice: ${input.invoiceNumber}`,
    `Billing period: ${input.periodStart} to ${input.periodEnd}`,
    `Amount due: ${money}`,
    `Due date: ${due}`,
    status,
    "",
    "Please let us know once the payment is completed. Thank you for choosing EduLedger.",
  ].join("\n");
}
