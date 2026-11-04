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
}

const formatAmount = (value: number | undefined, currencySymbol: string) =>
  `${currencySymbol}${(Number.isFinite(value) ? value ?? 0 : 0).toLocaleString('en-IN')}`;

export const renderReminderTemplate = (
  template: string,
  values: ReminderTemplateValues
): string => {
  const currencySymbol = values.currencySymbol || '₹';
  const tokens: Record<string, string> = {
    StudentName: values.studentName || '',
    ParentName: values.parentName || '',
    InstallmentNumber: String(values.installmentNumber ?? ''),
    Amount: formatAmount(values.amount ?? values.installmentAmount ?? values.remainingFee, currencySymbol),
    InstallmentAmount: formatAmount(values.installmentAmount ?? values.amount ?? values.remainingFee, currencySymbol),
    DueDate: values.dueDate || '',
    RemainingFee: formatAmount(values.remainingFee ?? values.amount ?? values.installmentAmount, currencySymbol),
    InstituteName: values.instituteName || 'EduLedger ERP',
  };

  let rendered = template;
  for (const [name, value] of Object.entries(tokens)) {
    rendered = rendered.replace(new RegExp(`\\\\{${name}\\\\}|\\\\[${name}\\\\]`, 'g'), value);
  }

  // Avoid sending unresolved placeholders when a saved template has an unknown token.
  return rendered.replace(/\\{[A-Za-z0-9_]+\\}|\\[[A-Za-z0-9_]+\\]/g, '');
};
