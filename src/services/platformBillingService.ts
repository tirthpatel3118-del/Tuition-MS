import { supabase } from "../lib/supabase";

export interface BillingOverview {
  paid_this_month: number;
  pending_amount: number;
  overdue_amount: number;
  paid_institutes_this_month: number;
  pending_invoices: number;
  overdue_invoices: number;
}

export interface PlatformBillingInvoice {
  invoice_id: string;
  invoice_number: string;
  institute_id: string;
  institute_name: string;\n  billing_contact_phone: string | null;
  billing_cycle: "monthly" | "yearly";
  period_start: string;
  period_end: string;
  issued_at: string;
  due_at: string;
  amount_inr: number;
  description: string;
  status: "issued" | "paid" | "overdue" | "void";
  created_at: string;
  payment_id: string | null;
  receipt_number: string | null;
  payment_method: "upi" | "bank_transfer" | "cash" | "other" | null;
  transaction_reference: string | null;
  paid_at: string | null;
  payment_notes: string | null;
  payment_amount_inr: number | null;
}

async function billingRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const getPlatformBillingOverview = () =>
  billingRpc<BillingOverview>("platform_admin_billing_overview");

export const listPlatformBilling = () =>
  billingRpc<PlatformBillingInvoice[]>("platform_admin_list_billing");

export async function createPlatformBillingInvoice(input: {
  instituteId: string;
  billingCycle: "monthly" | "yearly";
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  amountInr: number;
  description: string;
}) {
  return billingRpc<{ invoice_id: string; invoice_number: string }>(
    "platform_admin_create_billing_invoice",
    {
      p_institute_id: input.instituteId,
      p_billing_cycle: input.billingCycle,
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
      p_due_at: input.dueAt,
      p_amount_inr: input.amountInr,
      p_description: input.description,\n      p_billing_contact_phone: input.billingContactPhone || null,
    },
  );
}

export async function recordPlatformBillingPayment(input: {
  invoiceId: string;
  paymentMethod: "upi" | "bank_transfer" | "cash" | "other";
  transactionReference: string;
  paidAt: string;
  notes: string;
}) {
  return billingRpc<{
    payment_id: string;
    receipt_number: string;
    invoice_number: string;
    amount_inr: number;
    paid_at: string;
  }>("platform_admin_record_billing_payment", {
    p_invoice_id: input.invoiceId,
    p_payment_method: input.paymentMethod,
    p_transaction_reference: input.transactionReference || null,
    p_paid_at: input.paidAt,
    p_notes: input.notes || null,
  });
}

export const voidPlatformBillingInvoice = (invoiceId: string, reason: string) =>
  billingRpc<void>("platform_admin_void_billing_invoice", {
    p_invoice_id: invoiceId,
    p_reason: reason,
  });
