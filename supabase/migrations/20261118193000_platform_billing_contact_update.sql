CREATE OR REPLACE FUNCTION public.platform_admin_update_billing_contact(p_invoice_id uuid,p_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_invoice private.platform_billing_invoices%ROWTYPE; v_phone text := NULLIF(trim(COALESCE(p_phone,'')),''); v_digits text;
BEGIN
  PERFORM private.require_platform_admin();
  SELECT * INTO v_invoice FROM private.platform_billing_invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found.'; END IF;
  IF v_invoice.status <> 'issued' THEN RAISE EXCEPTION 'Only unpaid invoices can have reminder contacts changed.'; END IF;
  IF v_phone IS NOT NULL THEN
    v_digits := regexp_replace(v_phone,'\D','','g');
    IF length(v_digits)<10 OR length(v_digits)>15 THEN RAISE EXCEPTION 'Enter a valid WhatsApp phone number.'; END IF;
    v_phone := v_digits;
  END IF;
  UPDATE private.platform_billing_invoices SET billing_contact_phone=v_phone WHERE id=p_invoice_id;
  INSERT INTO private.platform_admin_audit(actor_id,action,institute_id,details)
  VALUES(auth.uid(),'SUBSCRIPTION_BILLING_CONTACT_UPDATED',v_invoice.institute_id,
    jsonb_build_object('invoice_id',p_invoice_id,'invoice_number',v_invoice.invoice_number,'contact_saved',v_phone IS NOT NULL));
END;
$function$;
REVOKE ALL ON FUNCTION public.platform_admin_update_billing_contact(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_update_billing_contact(uuid,text) TO authenticated;