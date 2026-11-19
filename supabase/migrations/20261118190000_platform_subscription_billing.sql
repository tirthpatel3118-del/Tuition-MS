-- Manual monthly/yearly subscription billing ledger and numbered payment receipts.
-- Private tables are only accessible through platform-admin guarded RPCs.
BEGIN;

CREATE SEQUENCE IF NOT EXISTS private.platform_invoice_number_seq;
CREATE SEQUENCE IF NOT EXISTS private.platform_receipt_number_seq;
REVOKE ALL ON SEQUENCE private.platform_invoice_number_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE private.platform_receipt_number_seq FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.platform_billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE RESTRICT,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','yearly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  issued_at date NOT NULL DEFAULT current_date,
  due_at date NOT NULL,
  amount_inr numeric(12,2) NOT NULL CHECK (amount_inr > 0),
  description text NOT NULL DEFAULT 'EduLedger platform subscription',
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','paid','void')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_billing_invoice_period_check CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS idx_platform_billing_invoices_due ON private.platform_billing_invoices (due_at, institute_id) WHERE status = 'issued';
CREATE INDEX IF NOT EXISTS idx_platform_billing_invoices_institute_period ON private.platform_billing_invoices (institute_id, period_start DESC);

CREATE TABLE IF NOT EXISTS private.platform_billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL UNIQUE REFERENCES private.platform_billing_invoices(id) ON DELETE RESTRICT,
  receipt_number text NOT NULL UNIQUE,
  amount_inr numeric(12,2) NOT NULL CHECK (amount_inr > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('upi','bank_transfer','cash','other')),
  transaction_reference text,
  paid_at date NOT NULL,
  notes text,
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_billing_payments_paid_at ON private.platform_billing_payments (paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_billing_invoices_created_by ON private.platform_billing_invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_platform_billing_payments_recorded_by ON private.platform_billing_payments(recorded_by);
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_billing_active_period ON private.platform_billing_invoices(institute_id,period_start,period_end) WHERE status IN ('issued','paid');
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_billing_transaction_reference ON private.platform_billing_payments(lower(transaction_reference)) WHERE transaction_reference IS NOT NULL AND length(trim(transaction_reference))>0;

ALTER TABLE private.platform_billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_billing_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.platform_billing_invoices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.platform_billing_payments FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.platform_admin_billing_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_month_start date := date_trunc('month', current_date)::date;
BEGIN
  PERFORM private.require_platform_admin();
  RETURN jsonb_build_object(
    'paid_this_month', COALESCE((SELECT sum(p.amount_inr) FROM private.platform_billing_payments p WHERE p.paid_at >= v_month_start AND p.paid_at < (v_month_start + interval '1 month')::date),0),
    'pending_amount', COALESCE((SELECT sum(i.amount_inr) FROM private.platform_billing_invoices i WHERE i.status='issued' AND i.due_at >= current_date),0),
    'overdue_amount', COALESCE((SELECT sum(i.amount_inr) FROM private.platform_billing_invoices i WHERE i.status='issued' AND i.due_at < current_date),0),
    'paid_institutes_this_month', (SELECT count(DISTINCT i.institute_id) FROM private.platform_billing_invoices i JOIN private.platform_billing_payments p ON p.invoice_id=i.id WHERE p.paid_at >= v_month_start AND p.paid_at < (v_month_start + interval '1 month')::date),
    'pending_invoices', (SELECT count(*) FROM private.platform_billing_invoices i WHERE i.status='issued' AND i.due_at >= current_date),
    'overdue_invoices', (SELECT count(*) FROM private.platform_billing_invoices i WHERE i.status='issued' AND i.due_at < current_date)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_list_billing()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'invoice_id',i.id,'invoice_number',i.invoice_number,'institute_id',i.institute_id,'institute_name',inst.name,
      'billing_cycle',i.billing_cycle,'period_start',i.period_start,'period_end',i.period_end,'issued_at',i.issued_at,
      'due_at',i.due_at,'amount_inr',i.amount_inr,'description',i.description,
      'status',CASE WHEN i.status='issued' AND i.due_at < current_date THEN 'overdue' ELSE i.status END,
      'created_at',i.created_at,'payment_id',p.id,'receipt_number',p.receipt_number,'payment_method',p.payment_method,
      'transaction_reference',p.transaction_reference,'paid_at',p.paid_at,'payment_notes',p.notes,'payment_amount_inr',p.amount_inr
    ) ORDER BY i.issued_at DESC,i.created_at DESC)
    FROM private.platform_billing_invoices i
    JOIN public.institutes inst ON inst.id=i.institute_id
    LEFT JOIN private.platform_billing_payments p ON p.invoice_id=i.id
  ),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_create_billing_invoice(
  p_institute_id uuid,p_billing_cycle text,p_period_start date,p_period_end date,p_due_at date,
  p_amount_inr numeric,p_description text DEFAULT 'EduLedger platform subscription'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_invoice_id uuid; v_invoice_number text; v_year text := to_char(current_date,'YYYY');
BEGIN
  PERFORM private.require_platform_admin();
  IF NOT EXISTS(SELECT 1 FROM public.institutes WHERE id=p_institute_id) THEN RAISE EXCEPTION 'Institute not found.'; END IF;
  IF p_billing_cycle NOT IN ('monthly','yearly') THEN RAISE EXCEPTION 'Choose monthly or yearly billing.'; END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end < p_period_start THEN RAISE EXCEPTION 'Billing period dates are invalid.'; END IF;
  IF p_due_at IS NULL THEN RAISE EXCEPTION 'A due date is required.'; END IF;
  IF p_amount_inr IS NULL OR p_amount_inr <= 0 OR p_amount_inr <> round(p_amount_inr,2) THEN RAISE EXCEPTION 'Enter a valid subscription amount in INR.'; END IF;
  IF length(trim(COALESCE(p_description,'')))=0 THEN RAISE EXCEPTION 'Invoice description is required.'; END IF;
  v_invoice_number := 'EDU-INV-'||v_year||'-'||lpad(nextval('private.platform_invoice_number_seq')::text,6,'0');
  INSERT INTO private.platform_billing_invoices(invoice_number,institute_id,billing_cycle,period_start,period_end,due_at,amount_inr,description,created_by)
  VALUES(v_invoice_number,p_institute_id,p_billing_cycle,p_period_start,p_period_end,p_due_at,p_amount_inr,trim(p_description),auth.uid())
  RETURNING id INTO v_invoice_id;
  INSERT INTO private.platform_admin_audit(actor_id,action,institute_id,details)
  VALUES(auth.uid(),'SUBSCRIPTION_INVOICE_CREATED',p_institute_id,jsonb_build_object('invoice_id',v_invoice_id,'invoice_number',v_invoice_number,'billing_cycle',p_billing_cycle,'amount_inr',p_amount_inr,'due_at',p_due_at));
  RETURN jsonb_build_object('invoice_id',v_invoice_id,'invoice_number',v_invoice_number);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_record_billing_payment(
  p_invoice_id uuid,p_payment_method text,p_transaction_reference text DEFAULT NULL,
  p_paid_at date DEFAULT current_date,p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_invoice private.platform_billing_invoices%ROWTYPE; v_receipt_number text; v_payment_id uuid;
BEGIN
  PERFORM private.require_platform_admin();
  SELECT * INTO v_invoice FROM private.platform_billing_invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found.'; END IF;
  IF v_invoice.status <> 'issued' THEN RAISE EXCEPTION 'Only an unpaid invoice can be marked as paid.'; END IF;
  IF p_payment_method NOT IN ('upi','bank_transfer','cash','other') THEN RAISE EXCEPTION 'Choose a valid payment method.'; END IF;
  IF p_paid_at IS NULL OR p_paid_at > current_date THEN RAISE EXCEPTION 'Payment date cannot be in the future.'; END IF;
  IF p_payment_method IN ('upi','bank_transfer') AND length(trim(COALESCE(p_transaction_reference,''))) < 4 THEN
    RAISE EXCEPTION 'Enter the UPI UTR or bank transaction reference for this payment.';
  END IF;
  v_receipt_number := 'EDU-RCP-'||to_char(p_paid_at,'YYYY')||'-'||lpad(nextval('private.platform_receipt_number_seq')::text,6,'0');
  INSERT INTO private.platform_billing_payments(invoice_id,receipt_number,amount_inr,payment_method,transaction_reference,paid_at,notes,recorded_by)
  VALUES(v_invoice.id,v_receipt_number,v_invoice.amount_inr,p_payment_method,NULLIF(trim(p_transaction_reference),''),p_paid_at,NULLIF(trim(p_notes),''),auth.uid())
  RETURNING id INTO v_payment_id;
  UPDATE private.platform_billing_invoices SET status='paid' WHERE id=v_invoice.id;
  INSERT INTO private.platform_admin_audit(actor_id,action,institute_id,details)
  VALUES(auth.uid(),'SUBSCRIPTION_PAYMENT_RECORDED',v_invoice.institute_id,jsonb_build_object('invoice_id',v_invoice.id,'payment_id',v_payment_id,'invoice_number',v_invoice.invoice_number,'receipt_number',v_receipt_number,'amount_inr',v_invoice.amount_inr,'payment_method',p_payment_method));
  RETURN jsonb_build_object('payment_id',v_payment_id,'receipt_number',v_receipt_number,'invoice_number',v_invoice.invoice_number,'amount_inr',v_invoice.amount_inr,'paid_at',p_paid_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_void_billing_invoice(p_invoice_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_invoice private.platform_billing_invoices%ROWTYPE;
BEGIN
  PERFORM private.require_platform_admin();
  SELECT * INTO v_invoice FROM private.platform_billing_invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found.'; END IF;
  IF v_invoice.status <> 'issued' THEN RAISE EXCEPTION 'Only an unpaid invoice can be voided.'; END IF;
  IF length(trim(COALESCE(p_reason,''))) < 5 THEN RAISE EXCEPTION 'Enter a reason of at least five characters.'; END IF;
  UPDATE private.platform_billing_invoices SET status='void' WHERE id=p_invoice_id;
  INSERT INTO private.platform_admin_audit(actor_id,action,institute_id,details)
  VALUES(auth.uid(),'SUBSCRIPTION_INVOICE_VOIDED',v_invoice.institute_id,jsonb_build_object('invoice_id',p_invoice_id,'invoice_number',v_invoice.invoice_number,'reason',trim(p_reason)));
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_admin_billing_overview() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.platform_admin_list_billing() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.platform_admin_create_billing_invoice(uuid,text,date,date,date,numeric,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.platform_admin_record_billing_payment(uuid,text,text,date,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.platform_admin_void_billing_invoice(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_billing_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_list_billing() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_create_billing_invoice(uuid,text,date,date,date,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_record_billing_payment(uuid,text,text,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_void_billing_invoice(uuid,text) TO authenticated;

COMMIT;