-- Add a private billing contact for manual WhatsApp reminders and expose it only through admin billing RPC.
BEGIN;
ALTER TABLE private.platform_billing_invoices
  ADD COLUMN IF NOT EXISTS billing_contact_phone text;

DROP FUNCTION IF EXISTS public.platform_admin_create_billing_invoice(uuid,text,date,date,date,numeric,text);

CREATE OR REPLACE FUNCTION public.platform_admin_create_billing_invoice(
  p_institute_id uuid,
  p_billing_cycle text,
  p_period_start date,
  p_period_end date,
  p_due_at date,
  p_amount_inr numeric,
  p_description text DEFAULT 'EduLedger platform subscription',
  p_billing_contact_phone text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_invoice_id uuid;
  v_invoice_number text;
  v_year text := to_char(current_date,'YYYY');
  v_phone text := NULLIF(trim(COALESCE(p_billing_contact_phone,'')),'');
  v_phone_digits text;
BEGIN
  PERFORM private.require_platform_admin();
  IF NOT EXISTS(SELECT 1 FROM public.institutes WHERE id=p_institute_id) THEN RAISE EXCEPTION 'Institute not found.'; END IF;
  IF p_billing_cycle NOT IN ('monthly','yearly') THEN RAISE EXCEPTION 'Choose monthly or yearly billing.'; END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end < p_period_start THEN RAISE EXCEPTION 'Billing period dates are invalid.'; END IF;
  IF p_due_at IS NULL THEN RAISE EXCEPTION 'A due date is required.'; END IF;
  IF p_amount_inr IS NULL OR p_amount_inr <= 0 OR p_amount_inr <> round(p_amount_inr,2) THEN RAISE EXCEPTION 'Enter a valid subscription amount in INR.'; END IF;
  IF length(trim(COALESCE(p_description,'')))=0 THEN RAISE EXCEPTION 'Invoice description is required.'; END IF;
  IF v_phone IS NOT NULL THEN
    v_phone_digits := regexp_replace(v_phone,'\D','','g');
    IF length(v_phone_digits) < 10 OR length(v_phone_digits) > 15 THEN
      RAISE EXCEPTION 'Enter a valid WhatsApp phone number with country code if outside India.';
    END IF;
    v_phone := v_phone_digits;
  END IF;
  v_invoice_number := 'EDU-INV-'||v_year||'-'||lpad(nextval('private.platform_invoice_number_seq')::text,6,'0');
  INSERT INTO private.platform_billing_invoices(
    invoice_number,institute_id,billing_cycle,period_start,period_end,due_at,amount_inr,description,created_by,billing_contact_phone
  ) VALUES(
    v_invoice_number,p_institute_id,p_billing_cycle,p_period_start,p_period_end,p_due_at,p_amount_inr,trim(p_description),auth.uid(),v_phone
  ) RETURNING id INTO v_invoice_id;
  INSERT INTO private.platform_admin_audit(actor_id,action,institute_id,details)
  VALUES(auth.uid(),'SUBSCRIPTION_INVOICE_CREATED',p_institute_id,
    jsonb_build_object('invoice_id',v_invoice_id,'invoice_number',v_invoice_number,'billing_cycle',p_billing_cycle,'amount_inr',p_amount_inr,'due_at',p_due_at,'whatsapp_contact_saved',v_phone IS NOT NULL));
  RETURN jsonb_build_object('invoice_id',v_invoice_id,'invoice_number',v_invoice_number);
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
      'due_at',i.due_at,'amount_inr',i.amount_inr,'description',i.description,'billing_contact_phone',i.billing_contact_phone,
      'status',CASE WHEN i.status='issued' AND i.due_at < current_date THEN 'overdue' ELSE i.status END,
      'created_at',i.created_at,'payment_id',p.id,'receipt_number',p.receipt_number,'payment_method',p.payment_method,
      'transaction_reference',p.transaction_reference,'paid_at',p.paid_at,'payment_notes',p.notes,'payment_amount_inr',p.amount_inr
    ) ORDER BY i.due_at ASC,i.created_at DESC)
    FROM private.platform_billing_invoices i
    JOIN public.institutes inst ON inst.id=i.institute_id
    LEFT JOIN private.platform_billing_payments p ON p.invoice_id=i.id
  ),'[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_admin_create_billing_invoice(uuid,text,date,date,date,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_create_billing_invoice(uuid,text,date,date,date,numeric,text,text) TO authenticated;
COMMIT;