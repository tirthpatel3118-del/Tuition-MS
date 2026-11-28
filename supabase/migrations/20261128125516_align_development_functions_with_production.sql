-- Development-only parity migration: align 21 database functions to the read-only Production snapshot dated 2026-11-28.
-- Table structures, constraints, indexes, RLS policies, triggers and views already matched.

CREATE OR REPLACE FUNCTION private.consume_website_intake_rate_limit(p_scope text, p_ip_hash text, p_limit integer DEFAULT 5, p_window_seconds integer DEFAULT 900)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_window timestamptz; v_count integer;
BEGIN
  IF p_scope NOT IN ('inquiry','access_request') OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid website intake rate-limit key.';
  END IF;
  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO private.website_intake_rate_limits(scope,ip_hash,window_start,request_count)
  VALUES(p_scope,p_ip_hash,v_window,1)
  ON CONFLICT(scope,ip_hash) DO UPDATE SET
    window_start = CASE WHEN private.website_intake_rate_limits.window_start < EXCLUDED.window_start
      THEN EXCLUDED.window_start ELSE private.website_intake_rate_limits.window_start END,
    request_count = CASE WHEN private.website_intake_rate_limits.window_start < EXCLUDED.window_start
      THEN 1 ELSE private.website_intake_rate_limits.request_count + 1 END
  RETURNING request_count INTO v_count;
  RETURN v_count <= p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION private.record_legal_acceptance(p_user_id uuid, p_user_email text, p_document_id uuid, p_method text, p_user_agent text DEFAULT NULL::text, p_scope text DEFAULT 'user'::text, p_institute_id uuid DEFAULT NULL::uuid, p_acceptance_type text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_actor_role text DEFAULT NULL::text, p_action_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_doc record; v_rows integer;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Acceptance actor is required.'; END IF;
  IF p_scope NOT IN('user','institute') OR (p_scope='user' AND p_institute_id IS NOT NULL)
    OR (p_scope='institute' AND p_institute_id IS NULL) THEN RAISE EXCEPTION 'Invalid legal acceptance scope.'; END IF;
  IF p_scope='institute' AND NOT EXISTS(SELECT 1 FROM public.institute_members m
    WHERE m.institute_id=p_institute_id AND m.user_id=p_user_id AND m.role='owner') THEN
    RAISE EXCEPTION 'Only the current Institute Owner may record Institute legal acceptance.';
  END IF;
  SELECT id,slug,title,version,locale,content_sha256 INTO v_doc
  FROM public.legal_documents WHERE id=p_document_id AND status='published';
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'The selected legal document is not currently published.'; END IF;
  INSERT INTO public.user_legal_acceptances(
    user_id,user_email,document_id,document_slug,document_title,document_version,document_locale,
    content_sha256,acceptance_scope,institute_id,acceptance_method,user_agent,acceptance_type,
    acceptance_source,actor_role,action_id,accepted_at
  ) VALUES (
    p_user_id,COALESCE(NULLIF(trim(p_user_email),''),'[email unavailable]'),v_doc.id,v_doc.slug,
    v_doc.title,v_doc.version,v_doc.locale,v_doc.content_sha256,p_scope,p_institute_id,p_method,NULL,
    COALESCE(p_acceptance_type,CASE v_doc.slug WHEN 'terms-of-service' THEN 'terms_acceptance'
      WHEN 'acceptable-use-policy' THEN 'aup_acceptance' WHEN 'privacy-policy' THEN 'privacy_acknowledgement'
      WHEN 'data-processing-agreement' THEN 'dpa_acceptance' ELSE NULL END),
    COALESCE(p_source,CASE p_method WHEN 'signup' THEN 'signup'
      WHEN 'institute_legal_bundle' THEN 'institute_creation' ELSE 'login_gate' END),
    p_actor_role,p_action_id,now()
  ) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows=0 AND NOT EXISTS(SELECT 1 FROM public.user_legal_acceptances a
    WHERE a.user_id=p_user_id AND a.document_id=v_doc.id AND a.acceptance_scope=p_scope
      AND a.institute_id IS NOT DISTINCT FROM p_institute_id AND a.content_sha256=v_doc.content_sha256) THEN
    RAISE EXCEPTION 'Legal acceptance evidence could not be recorded.';
  END IF;
END;$function$;

CREATE OR REPLACE FUNCTION private.sync_legacy_student_batch_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'students' THEN
        IF NEW.batch_id IS NOT NULL THEN
            INSERT INTO public.student_batches (institute_id, student_id, batch_id)
            VALUES (NEW.institute_id, NEW.id, NEW.batch_id)
            ON CONFLICT (institute_id, student_id, batch_id) DO NOTHING;
        ELSE
            UPDATE public.students AS s
               SET batch_id = (
                   SELECT sb.batch_id FROM public.student_batches AS sb
                   WHERE sb.institute_id = NEW.institute_id AND sb.student_id = NEW.id
                   ORDER BY sb.enrolled_at, sb.batch_id LIMIT 1
               )
             WHERE s.institute_id = NEW.institute_id AND s.id = NEW.id
               AND s.batch_id IS DISTINCT FROM (
                   SELECT sb.batch_id FROM public.student_batches AS sb
                   WHERE sb.institute_id = NEW.institute_id AND sb.student_id = NEW.id
                   ORDER BY sb.enrolled_at, sb.batch_id LIMIT 1
               );
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        UPDATE public.students
           SET batch_id = NEW.batch_id
         WHERE institute_id = NEW.institute_id AND id = NEW.student_id
           AND batch_id IS NULL;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.students AS s
           SET batch_id = (
               SELECT sb.batch_id
               FROM public.student_batches AS sb
               WHERE sb.institute_id = OLD.institute_id AND sb.student_id = OLD.student_id
               ORDER BY sb.enrolled_at, sb.batch_id
               LIMIT 1
           )
         WHERE s.institute_id = OLD.institute_id AND s.id = OLD.student_id
           AND s.batch_id = OLD.batch_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_archive_institute(p_institute_id uuid, p_confirm_name text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_name text;
  v_access_status text;
begin
  perform private.require_platform_admin();
  select i.name, coalesce(c.access_status,'active')
    into v_name, v_access_status
  from public.institutes i
  left join private.platform_institute_controls c on c.institute_id=i.id
  where i.id=p_institute_id
  for update of i;

  if v_name is null then raise exception 'Institute not found.'; end if;
  if v_access_status <> 'suspended' then raise exception 'Only suspended institutes can be archived.'; end if;
  if p_confirm_name is distinct from v_name then raise exception 'Institute name confirmation did not match.'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'An archive reason of at least 5 characters is required.'; end if;
  if exists(select 1 from private.platform_institute_controls where institute_id=p_institute_id and archived_at is not null) then
    raise exception 'Institute is already archived.';
  end if;

  insert into private.platform_institute_controls(institute_id, access_status, plan_code, subscription_status, starts_at, archived_at, archived_by, updated_by, updated_at)
  values(p_institute_id, 'suspended', 'trial', 'trial', now(), now(), auth.uid(), auth.uid(), now())
  on conflict(institute_id) do update
    set archived_at=now(), archived_by=auth.uid(), updated_by=auth.uid(), updated_at=now();

  insert into private.platform_admin_audit(actor_id, action, institute_id, details)
  values(auth.uid(), 'INSTITUTE_ARCHIVED', p_institute_id,
    jsonb_build_object('reason', trim(p_reason), 'institute_name', v_name, 'records_retained', true));
end;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_billing_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
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

CREATE OR REPLACE FUNCTION public.platform_admin_create_billing_invoice(p_institute_id uuid, p_billing_cycle text, p_period_start date, p_period_end date, p_due_at date, p_amount_inr numeric, p_description text DEFAULT 'EduLedger platform subscription'::text, p_billing_contact_phone text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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

CREATE OR REPLACE FUNCTION public.platform_admin_create_invitation(p_email text, p_role text, p_institute_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_raw_token text;
  v_token_hash text;
  v_expiry timestamptz;
BEGIN
  PERFORM private.require_platform_admin();

  -- A bracketed literal dot avoids SQL regex backslash-escape ambiguity.
  IF p_email IS NULL
     OR trim(p_email) = ''
     OR p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$'
  THEN
    RAISE EXCEPTION 'Enter a valid invitation email address.';
  END IF;

  IF p_role NOT IN ('owner','teacher','accountant') THEN
    RAISE EXCEPTION 'Unsupported invitation role.';
  END IF;

  IF p_role <> 'owner' AND p_institute_id IS NULL THEN
    RAISE EXCEPTION 'Teacher and accountant invitations require an institute.';
  END IF;

  IF p_institute_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.institutes WHERE id = p_institute_id)
  THEN
    RAISE EXCEPTION 'Selected institute does not exist.';
  END IF;

  UPDATE private.platform_invitations
  SET status = 'Revoked'
  WHERE lower(email) = lower(trim(p_email))
    AND institute_id IS NOT DISTINCT FROM p_institute_id
    AND status = 'Pending';

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_expiry := now() + interval '48 hours';

  INSERT INTO private.platform_invitations(email, role, institute_id, token_hash, invited_by, expires_at)
  VALUES (lower(trim(p_email)), p_role, p_institute_id, v_token_hash, auth.uid(), v_expiry)
  RETURNING id INTO v_id;

  INSERT INTO private.platform_admin_audit(actor_id, action, institute_id, invitation_id, details)
  VALUES (auth.uid(), 'INVITATION_CREATED', p_institute_id, v_id, jsonb_build_object('role', p_role));

  RETURN jsonb_build_object(
    'invitation_id', v_id,
    'email', lower(trim(p_email)),
    'role', p_role,
    'institute_id', p_institute_id,
    'raw_token', v_raw_token,
    'expires_at', v_expiry
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_export_legal_acceptances(p_limit integer DEFAULT 10000)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_limit integer:=LEAST(GREATEST(COALESCE(p_limit,10000),1),10000);
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.accepted_at DESC)
    FROM (
      SELECT a.id,a.document_slug,a.document_title,a.document_version,a.document_locale,a.content_sha256,
        a.acceptance_type,a.acceptance_scope,a.acceptance_method,a.acceptance_source,a.actor_role,
        CASE WHEN a.institute_id IS NULL THEN 'account' ELSE 'institute' END AS acceptance_context,a.accepted_at
      FROM public.user_legal_acceptances a ORDER BY a.accepted_at DESC LIMIT v_limit
    ) r
  ),'[]'::jsonb);
END;$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_legal_audit_logs(p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_limit integer:=LEAST(GREATEST(COALESCE(p_limit,100),1),500);
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
    FROM (
      SELECT l.action,l.details,l.created_at,d.slug AS document_slug,d.title AS document_title,d.version AS document_version
      FROM private.legal_admin_audit_logs l
      LEFT JOIN public.legal_documents d ON d.id=l.document_id
      ORDER BY l.created_at DESC LIMIT v_limit
    ) r
  ),'[]'::jsonb);
END;$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_list_billing()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
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

CREATE OR REPLACE FUNCTION public.platform_admin_list_institutes()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.require_platform_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'institute_id', i.id,
      'name', i.name,
      'slug', i.slug,
      'created_at', i.created_at,
      'student_count', (select count(*) from public.students s where s.institute_id=i.id),
      'owner_count', (select count(*) from public.institute_members m where m.institute_id=i.id and m.role='owner'),
      'teacher_count', (select count(*) from public.institute_members m where m.institute_id=i.id and m.role='teacher'),
      'accountant_count', (select count(*) from public.institute_members m where m.institute_id=i.id and m.role='accountant'),
      'team_member_count', (select count(*) from public.institute_members m where m.institute_id=i.id),
      'active_members_30d', (select count(distinct a.user_id) from private.platform_member_login_daily a where a.institute_id=i.id and a.activity_date >= current_date - 29),
      'active_owners_30d', (select count(distinct a.user_id) from private.platform_member_login_daily a where a.institute_id=i.id and a.role='owner' and a.activity_date >= current_date - 29),
      'active_teachers_30d', (select count(distinct a.user_id) from private.platform_member_login_daily a where a.institute_id=i.id and a.role='teacher' and a.activity_date >= current_date - 29),
      'active_accountants_30d', (select count(distinct a.user_id) from private.platform_member_login_daily a where a.institute_id=i.id and a.role='accountant' and a.activity_date >= current_date - 29),
      'last_active_date', (select max(a.activity_date) from private.platform_member_login_daily a where a.institute_id=i.id),
      'estimated_database_row_bytes', private.platform_institute_estimated_bytes(i.id),
      'access_status', coalesce(c.access_status,'active'),
      'plan_code', coalesce(c.plan_code,'trial'),
      'subscription_status', coalesce(c.subscription_status,'trial'),
      'starts_at', c.starts_at,
      'expires_at', c.expires_at,
      'student_limit', c.student_limit,
      'team_limit', c.team_limit,
      'archived_at', c.archived_at,
      'archived_by', c.archived_by
    ) order by (c.archived_at is not null), i.created_at desc)
    from public.institutes i
    left join private.platform_institute_controls c on c.institute_id=i.id
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_record_billing_payment(p_invoice_id uuid, p_payment_method text, p_transaction_reference text DEFAULT NULL::text, p_paid_at date DEFAULT CURRENT_DATE, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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

CREATE OR REPLACE FUNCTION public.platform_admin_restore_institute(p_institute_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_name text;
begin
  perform private.require_platform_admin();
  select i.name into v_name
  from public.institutes i
  join private.platform_institute_controls c on c.institute_id=i.id
  where i.id=p_institute_id and c.archived_at is not null
  for update of i;
  if v_name is null then raise exception 'Archived institute not found.'; end if;

  update private.platform_institute_controls
  set archived_at=null, archived_by=null, updated_by=auth.uid(), updated_at=now()
  where institute_id=p_institute_id;

  insert into private.platform_admin_audit(actor_id, action, institute_id, details)
  values(auth.uid(), 'INSTITUTE_RESTORED', p_institute_id,
    jsonb_build_object('institute_name', v_name, 'access_status_remains_suspended', true));
end;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_set_institute_controls(p_institute_id uuid, p_access_status text, p_plan_code text, p_subscription_status text, p_starts_at timestamp with time zone DEFAULT now(), p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_student_limit integer DEFAULT NULL::integer, p_team_limit integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.require_platform_admin();
  if not exists(select 1 from public.institutes where id=p_institute_id) then
    raise exception 'Institute not found.';
  end if;
  if exists(select 1 from private.platform_institute_controls where institute_id=p_institute_id and archived_at is not null)
     and p_access_status <> 'suspended' then
    raise exception 'Restore the archived institute before changing its access status.';
  end if;
  if p_access_status not in ('active','suspended') then raise exception 'Invalid institute access status.'; end if;
  if p_subscription_status not in ('trial','active','past_due','expired','cancelled') then raise exception 'Invalid subscription status.'; end if;
  if p_plan_code is null or trim(p_plan_code)='' then raise exception 'A plan code is required.'; end if;
  if p_student_limit is not null and p_student_limit<0 then raise exception 'Student limit cannot be negative.'; end if;
  if p_team_limit is not null and p_team_limit<0 then raise exception 'Team limit cannot be negative.'; end if;
  if p_expires_at is not null and p_starts_at is not null and p_expires_at<=p_starts_at then
    raise exception 'Expiry must be later than start.';
  end if;

  insert into private.platform_institute_controls(institute_id,access_status,plan_code,subscription_status,starts_at,expires_at,student_limit,team_limit,updated_by,updated_at)
  values(p_institute_id,p_access_status,trim(p_plan_code),p_subscription_status,coalesce(p_starts_at,now()),p_expires_at,p_student_limit,p_team_limit,auth.uid(),now())
  on conflict(institute_id) do update set
    access_status=excluded.access_status,plan_code=excluded.plan_code,subscription_status=excluded.subscription_status,
    starts_at=excluded.starts_at,expires_at=excluded.expires_at,student_limit=excluded.student_limit,
    team_limit=excluded.team_limit,updated_by=excluded.updated_by,updated_at=now();

  insert into private.platform_admin_audit(actor_id,action,institute_id,details)
  values(auth.uid(),'INSTITUTE_CONTROLS_UPDATED',p_institute_id,
    jsonb_build_object('access_status',p_access_status,'plan_code',p_plan_code,'subscription_status',p_subscription_status));
end;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_update_billing_contact(p_invoice_id uuid, p_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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

CREATE OR REPLACE FUNCTION public.platform_admin_void_billing_invoice(p_invoice_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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

CREATE OR REPLACE FUNCTION public.platform_admin_website_list_access_requests(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_search text := NULLIF(trim(COALESCE(p_search,'')),'');
BEGIN
  PERFORM private.require_platform_admin();
  IF p_status IS NOT NULL AND p_status NOT IN ('all','new','reviewing','approved','rejected','closed') THEN RAISE EXCEPTION 'Invalid access request status.'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC) FROM (
    SELECT id,reference_code,requester_name,institute_name,email,phone,city,requested_role,message,status,admin_notes,linked_invitation_id,notification_status,created_at,updated_at
    FROM private.website_access_requests
    WHERE (p_status IS NULL OR p_status='all' OR status=p_status)
      AND (v_search IS NULL OR requester_name ILIKE '%'||v_search||'%' OR institute_name ILIKE '%'||v_search||'%' OR email ILIKE '%'||v_search||'%' OR city ILIKE '%'||v_search||'%' OR reference_code ILIKE '%'||v_search||'%')
    ORDER BY created_at DESC LIMIT greatest(1,least(COALESCE(p_limit,100),200)) OFFSET greatest(COALESCE(p_offset,0),0)
  ) q),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_website_list_inquiries(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_search text := NULLIF(trim(COALESCE(p_search,'')),'');
BEGIN
  PERFORM private.require_platform_admin();
  IF p_status IS NOT NULL AND p_status NOT IN ('all','new','contacted','demo_scheduled','closed') THEN RAISE EXCEPTION 'Invalid website enquiry status.'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC) FROM (
    SELECT id,reference_code,requester_name,institute_name,email,phone,city,enquiry_type,contact_preference,message,status,admin_notes,notification_status,created_at,updated_at
    FROM private.website_inquiries
    WHERE (p_status IS NULL OR p_status='all' OR status=p_status)
      AND (v_search IS NULL OR requester_name ILIKE '%'||v_search||'%' OR institute_name ILIKE '%'||v_search||'%' OR email ILIKE '%'||v_search||'%' OR city ILIKE '%'||v_search||'%' OR reference_code ILIKE '%'||v_search||'%')
    ORDER BY created_at DESC LIMIT greatest(1,least(COALESCE(p_limit,100),200)) OFFSET greatest(COALESCE(p_offset,0),0)
  ) q),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_website_list_notifications(p_unread_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC) FROM (
    SELECT id,notification_type,related_type,related_id,reference_code,title,message,read_at,created_at
    FROM private.website_notifications WHERE NOT p_unread_only OR read_at IS NULL
    ORDER BY created_at DESC LIMIT 200
  ) q),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.website_submit_access_request(p_requester_name text, p_institute_name text, p_email text, p_requested_role text, p_phone text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_ip_hash text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid; v_reference text; v_name text := trim(COALESCE(p_requester_name,''));
  v_institute text := trim(COALESCE(p_institute_name,'')); v_email text := lower(trim(COALESCE(p_email,'')));
  v_ip_hash text := lower(COALESCE(p_ip_hash,''));
BEGIN
  IF char_length(v_name) NOT BETWEEN 2 AND 100 OR char_length(v_institute) NOT BETWEEN 2 AND 150
    OR v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    OR p_requested_role NOT IN ('owner','teacher','accountant')
    OR char_length(COALESCE(p_message,'')) > 1200 OR char_length(COALESCE(p_phone,'')) > 30
    OR char_length(COALESCE(p_city,'')) > 80 THEN
    RAISE EXCEPTION 'Please check the access request details and try again.';
  END IF;
  IF NOT private.consume_website_intake_rate_limit('access_request',v_ip_hash,3,900) THEN
    RAISE EXCEPTION 'Too many access requests from this connection. Please try again later.';
  END IF;
  INSERT INTO private.website_access_requests(requester_name,institute_name,email,phone,city,requested_role,message)
  VALUES(v_name,v_institute,v_email,NULLIF(trim(COALESCE(p_phone,'')),''),NULLIF(trim(COALESCE(p_city,'')),''),p_requested_role,NULLIF(trim(COALESCE(p_message,'')),''))
  RETURNING id,reference_code INTO v_id,v_reference;
  INSERT INTO private.website_notifications(notification_type,related_type,related_id,reference_code,title,message)
  VALUES('new_access_request','access_request',v_id,v_reference,'New website access request',v_name || ' requested ' || p_requested_role || ' access for ' || v_institute || '.');
  RETURN jsonb_build_object('success',true,'reference',v_reference,'id',v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.website_submit_inquiry(p_requester_name text, p_institute_name text, p_email text, p_phone text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_enquiry_type text DEFAULT 'General enquiry'::text, p_contact_preference text DEFAULT 'Email'::text, p_message text DEFAULT NULL::text, p_ip_hash text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid; v_reference text; v_name text := trim(COALESCE(p_requester_name,''));
  v_institute text := trim(COALESCE(p_institute_name,'')); v_email text := lower(trim(COALESCE(p_email,'')));
  v_ip_hash text := lower(COALESCE(p_ip_hash,''));
BEGIN
  IF char_length(v_name) NOT BETWEEN 2 AND 100 OR char_length(v_institute) NOT BETWEEN 2 AND 150
    OR v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    OR p_enquiry_type NOT IN ('Product demo','Pricing and plans','Receipt branding customisation','New feature request','General enquiry')
    OR p_contact_preference NOT IN ('Email','Phone','WhatsApp')
    OR char_length(COALESCE(p_message,'')) > 1200 OR char_length(COALESCE(p_phone,'')) > 30
    OR char_length(COALESCE(p_city,'')) > 80 THEN
    RAISE EXCEPTION 'Please check the enquiry details and try again.';
  END IF;
  IF NOT private.consume_website_intake_rate_limit('inquiry',v_ip_hash,5,900) THEN
    RAISE EXCEPTION 'Too many enquiries from this connection. Please try again later.';
  END IF;
  INSERT INTO private.website_inquiries(requester_name,institute_name,email,phone,city,enquiry_type,contact_preference,message)
  VALUES(v_name,v_institute,v_email,NULLIF(trim(COALESCE(p_phone,'')),''),NULLIF(trim(COALESCE(p_city,'')),''),p_enquiry_type,p_contact_preference,NULLIF(trim(COALESCE(p_message,'')),''))
  RETURNING id,reference_code INTO v_id,v_reference;
  INSERT INTO private.website_notifications(notification_type,related_type,related_id,reference_code,title,message)
  VALUES('new_inquiry','inquiry',v_id,v_reference,'New website enquiry',v_name || ' from ' || v_institute || ' submitted ' || p_enquiry_type || '.');
  RETURN jsonb_build_object('success',true,'reference',v_reference,'id',v_id);
END;
$function$;
