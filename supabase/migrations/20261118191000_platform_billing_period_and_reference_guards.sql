-- Keep the live development ledger aligned with the checked-in schema:
-- allow replacement invoices after voiding, retain UTR uniqueness, and index audit actors.
BEGIN;
ALTER TABLE private.platform_billing_invoices
  DROP CONSTRAINT IF EXISTS platform_billing_invoice_unique_period;
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_billing_active_period
  ON private.platform_billing_invoices(institute_id,period_start,period_end)
  WHERE status IN ('issued','paid');
CREATE INDEX IF NOT EXISTS idx_platform_billing_invoices_created_by
  ON private.platform_billing_invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_platform_billing_payments_recorded_by
  ON private.platform_billing_payments(recorded_by);
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_billing_transaction_reference
  ON private.platform_billing_payments(lower(transaction_reference))
  WHERE transaction_reference IS NOT NULL AND length(trim(transaction_reference))>0;

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
COMMIT;