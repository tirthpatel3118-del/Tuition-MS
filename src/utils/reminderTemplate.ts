export interface ReminderTemplateValues {
  studentName?: string;
  parentName?: string;
  installmentNumber?: number | string;
  amount?: number;
  installmentAmount?: number;
  dueDate?: string;
  remainingFee?: number;
  instituteName?: string;
  currencySymbol?: string;
  isDirect?: boolean;
}

export const DEFAULT_INSTALLMENT_REMINDER_TEMPLATE =
  'Dear {ParentName}, this is a gentle reminder that Installment #{InstallmentNumber} of {Amount} is due on {DueDate} for {StudentName}. Please clear the dues. Thank you, {InstituteName}.';

export const DEFAULT_DIRECT_REMINDER_TEMPLATE =
  'Dear {ParentName}, this is a gentle reminder that an outstanding fee balance of {Amount} is due for {StudentName}. Please clear the dues. Thank you, {InstituteName}.';

const formatAmount = (value: number | undefined, currencySymbol: string) =>
  `${currencySymbol}${(Number.isFinite(value) ? value ?? 0 : 0).toLocaleString('en-IN')}`;

export const renderReminderTemplate = (
  template: string,
  values: ReminderTemplateValues
): string => {
  const currencySymbol = values.currencySymbol || '₹';
  const isDirect = Boolean(
    values.isDirect ||
    values.installmentNumber === undefined ||
    values.installmentNumber === null ||
    values.installmentNumber === ''
  );

  const tokens: Record<string, string> = {
    StudentName: values.studentName || '',
    ParentName: values.parentName || '',
    InstallmentNumber: isDirect ? '' : String(values.installmentNumber ?? ''),
    Amount: formatAmount(values.amount ?? values.installmentAmount ?? values.remainingFee, currencySymbol),
    InstallmentAmount: formatAmount(values.installmentAmount ?? values.amount ?? values.remainingFee, currencySymbol),
    DueDate: isDirect ? '' : (values.dueDate && values.dueDate !== '—' ? values.dueDate : ''),
    RemainingFee: formatAmount(values.remainingFee ?? values.amount ?? values.installmentAmount, currencySymbol),
    InstituteName: values.instituteName || 'EduLedger ERP',
  };

  let rendered = template;

  // If direct reminder or no installment number is present, avoid awkward "Installment #" or "due on [DueDate]"
  if (isDirect) {
    rendered = rendered.replace(
      /Installment\s*(?:#\s*)?(?:\{|\[)InstallmentNumber(?:\}|\])\s*(?:of\s+)?/gi,
      (match) => (/of\s+/i.test(match) ? 'an outstanding fee balance of ' : 'an outstanding fee ')
    );
    rendered = rendered.replace(/\s*(?:is\s*)?due\s+on\s+(?:\{|\[)DueDate(?:\}|\])/gi, ' is due');
  }

  for (const [name, value] of Object.entries(tokens)) {
    rendered = rendered.replace(new RegExp(`\\{${name}\\}|\\[${name}\\]`, 'g'), value);
  }

  // Avoid sending unresolved placeholders when a saved template has an unknown token.
  return rendered.replace(/\{[A-Za-z0-9_]+\}|\[[A-Za-z0-9_]+\]/g, '');
};
