-- ClassBandhu Demo Access Management: protected, time-limited browser-only sessions.
BEGIN;

ALTER TABLE private.website_inquiries
  ADD COLUMN IF NOT EXISTS student_count integer
  CHECK (student_count IS NULL OR student_count BETWEEN 0 AND 10000000);

ALTER TABLE private.website_inquiries
  DROP CONSTRAINT IF EXISTS website_inquiries_status_check;
ALTER TABLE private.website_inquiries
  ADD CONSTRAINT website_inquiries_status_check
  CHECK (status = ANY (ARRAY[
    'new','reviewing','contacted','demo_scheduled','approved','rejected',
    'link_generated','closed'
  ]));

CREATE TABLE IF NOT EXISTS private.website_demo_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES private.website_inquiries(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  link_expires_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 20 CHECK (duration_minutes BETWEEN 5 AND 60),
  activated_at timestamptz,
  session_hash text UNIQUE CHECK (session_hash IS NULL OR session_hash ~ '^[a-f0-9]{64}$'),
  session_expires_at timestamptz,
  extended_at timestamptz,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_demo_access_session_state_check CHECK (
    (activated_at IS NULL AND session_hash IS NULL AND session_expires_at IS NULL AND extended_at IS NULL)
    OR (activated_at IS NOT NULL AND session_hash IS NOT NULL AND session_expires_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_website_demo_access_inquiry_created
  ON private.website_demo_access(inquiry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_demo_access_expiry
  ON private.website_demo_access(session_expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_demo_access_active_session
  ON private.website_demo_access(session_hash) WHERE revoked_at IS NULL AND session_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS private.website_demo_rate_limits (
  scope text NOT NULL CHECK (scope = ANY (ARRAY['activate','validate'])),
  ip_hash text NOT NULL CHECK (ip_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY(scope, ip_hash)
);

CREATE TABLE IF NOT EXISTS private.website_demo_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES private.website_inquiries(id) ON DELETE CASCADE,
  demo_access_id uuid REFERENCES private.website_demo_access(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY[
    'REQUEST_REVIEWING','REQUEST_APPROVED','REQUEST_REJECTED','LINK_ISSUED',
    'SESSION_ACTIVATED','SESSION_EXTENDED','ACCESS_REVOKED'
  ])),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_website_demo_audit_inquiry_created
  ON private.website_demo_audit(inquiry_id, created_at DESC);

ALTER TABLE private.website_demo_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.website_demo_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.website_demo_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.website_demo_access FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.website_demo_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.website_demo_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.consume_website_demo_rate_limit(
  p_scope text, p_ip_hash text, p_limit integer, p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_window timestamptz;
  v_count integer;
BEGIN
  IF p_scope NOT IN ('activate','validate')
    OR p_ip_hash !~ '^[a-f0-9]{64}$'
    OR p_limit NOT BETWEEN 1 AND 500
    OR p_window_seconds NOT BETWEEN 30 AND 3600 THEN
    RAISE EXCEPTION 'Invalid demo rate-limit request.';
  END IF;
  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO private.website_demo_rate_limits(scope,ip_hash,window_start,request_count)
  VALUES (p_scope,p_ip_hash,v_window,1)
  ON CONFLICT(scope,ip_hash) DO UPDATE SET
    window_start = CASE
      WHEN private.website_demo_rate_limits.window_start < EXCLUDED.window_start
      THEN EXCLUDED.window_start ELSE private.website_demo_rate_limits.window_start END,
    request_count = CASE
      WHEN private.website_demo_rate_limits.window_start < EXCLUDED.window_start
      THEN 1 ELSE private.website_demo_rate_limits.request_count + 1 END
  RETURNING request_count INTO v_count;
  RETURN v_count <= p_limit;
END;
$function$;
REVOKE ALL ON FUNCTION private.consume_website_demo_rate_limit(text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.consume_website_demo_rate_limit(text,text,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.website_submit_demo_request(
  p_requester_name text,
  p_institute_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_student_count integer DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_ip_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_reference text;
  v_name text := trim(COALESCE(p_requester_name,''));
  v_institute text := trim(COALESCE(p_institute_name,''));
  v_email text := lower(trim(COALESCE(p_email,'')));
  v_ip_hash text := lower(COALESCE(p_ip_hash,''));
BEGIN
  IF char_length(v_name) NOT BETWEEN 2 AND 100
    OR char_length(v_institute) NOT BETWEEN 2 AND 150
    OR v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    OR char_length(COALESCE(p_phone,'')) > 30
    OR char_length(COALESCE(p_message,'')) > 1200
    OR char_length(COALESCE(p_ip_hash,'')) <> 64
    OR (p_student_count IS NOT NULL AND p_student_count NOT BETWEEN 0 AND 10000000) THEN
    RAISE EXCEPTION 'Please check the demo request details and try again.';
  END IF;
  IF NOT private.consume_website_intake_rate_limit('inquiry',v_ip_hash,5,900) THEN
    RAISE EXCEPTION 'Too many demo requests from this connection. Please try again later.';
  END IF;

  INSERT INTO private.website_inquiries(
    requester_name,institute_name,email,phone,enquiry_type,contact_preference,
    message,student_count
  )
  VALUES (
    v_name,v_institute,v_email,NULLIF(trim(COALESCE(p_phone,'')), ''),
    'Product demo','Email',NULLIF(trim(COALESCE(p_message,'')), ''),p_student_count
  )
  RETURNING id,reference_code INTO v_id,v_reference;

  INSERT INTO private.website_notifications(
    notification_type,related_type,related_id,reference_code,title,message
  )
  VALUES (
    'new_inquiry','inquiry',v_id,v_reference,'New ClassBandhu demo request',
    v_name || ' from ' || v_institute || ' requested a time-limited ERP demo.'
  );

  RETURN jsonb_build_object('success',true,'reference',v_reference,'id',v_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.website_submit_demo_request(text,text,text,text,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_submit_demo_request(text,text,text,text,integer,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_admin_demo_update_request(
  p_inquiry_id uuid, p_status text, p_admin_notes text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_reference text;
  v_access_id uuid;
BEGIN
  PERFORM private.require_platform_admin();
  IF p_status NOT IN ('reviewing','approved','rejected')
    OR char_length(COALESCE(p_admin_notes,'')) > 4000 THEN
    RAISE EXCEPTION 'Invalid demo request update.';
  END IF;

  UPDATE private.website_inquiries
  SET status=p_status, admin_notes=COALESCE(p_admin_notes,''), updated_at=now()
  WHERE id=p_inquiry_id AND enquiry_type='Product demo'
  RETURNING reference_code INTO v_reference;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demo request not found.'; END IF;

  IF p_status='rejected' THEN
    UPDATE private.website_demo_access
    SET revoked_at=COALESCE(revoked_at,now())
    WHERE inquiry_id=p_inquiry_id AND revoked_at IS NULL;
  END IF;

  INSERT INTO private.website_demo_audit(inquiry_id,actor_id,action,details)
  VALUES (
    p_inquiry_id,auth.uid(),
    CASE p_status WHEN 'reviewing' THEN 'REQUEST_REVIEWING'
      WHEN 'approved' THEN 'REQUEST_APPROVED' ELSE 'REQUEST_REJECTED' END,
    jsonb_build_object('status',p_status,'has_internal_note',char_length(COALESCE(p_admin_notes,''))>0)
  );
  INSERT INTO private.website_notifications(
    notification_type,related_type,related_id,reference_code,title,message
  )
  VALUES (
    'inquiry_status_changed','inquiry',p_inquiry_id,v_reference,
    'Demo request updated','Demo request status changed to ' || p_status || '.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_demo_issue_access(p_inquiry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_token text;
  v_access_id uuid;
  v_reference text;
  v_status text;
  v_link_expiry timestamptz;
BEGIN
  PERFORM private.require_platform_admin();
  SELECT reference_code,status INTO v_reference,v_status
  FROM private.website_inquiries
  WHERE id=p_inquiry_id AND enquiry_type='Product demo'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demo request not found.'; END IF;
  IF v_status NOT IN ('approved','link_generated') THEN
    RAISE EXCEPTION 'Approve this demo request before generating access.';
  END IF;

  UPDATE private.website_demo_access
  SET revoked_at=COALESCE(revoked_at,now())
  WHERE inquiry_id=p_inquiry_id AND revoked_at IS NULL;

  v_token := encode(extensions.gen_random_bytes(32),'hex');
  v_link_expiry := now() + interval '48 hours';
  INSERT INTO private.website_demo_access(
    inquiry_id,token_hash,link_expires_at,duration_minutes,created_by
  )
  VALUES (
    p_inquiry_id,encode(extensions.digest(v_token,'sha256'),'hex'),
    v_link_expiry,20,v_actor
  )
  RETURNING id INTO v_access_id;

  UPDATE private.website_inquiries
  SET status='link_generated',updated_at=now()
  WHERE id=p_inquiry_id;

  INSERT INTO private.website_demo_audit(inquiry_id,demo_access_id,actor_id,action,details)
  VALUES (
    p_inquiry_id,v_access_id,v_actor,'LINK_ISSUED',
    jsonb_build_object('link_expires_at',v_link_expiry,'duration_minutes',20)
  );
  INSERT INTO private.website_notifications(
    notification_type,related_type,related_id,reference_code,title,message
  )
  VALUES (
    'inquiry_status_changed','inquiry',p_inquiry_id,v_reference,
    'Demo access link generated','A private demo invitation link was generated.'
  );

  RETURN jsonb_build_object(
    'access_id',v_access_id,'token',v_token,
    'link_expires_at',v_link_expiry,'duration_minutes',20
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_demo_list_requests()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC)
    FROM (
      SELECT
        i.id,i.reference_code,i.requester_name,i.institute_name,i.email,i.phone,
        i.student_count,i.message,i.status,i.admin_notes,i.created_at,i.updated_at,
        a.id AS demo_access_id,a.link_expires_at,a.duration_minutes,a.activated_at,
        a.session_expires_at,a.extended_at,a.revoked_at,
        CASE
          WHEN a.revoked_at IS NOT NULL THEN 'revoked'
          WHEN a.activated_at IS NOT NULL AND a.session_expires_at <= now() THEN 'expired'
          WHEN a.activated_at IS NOT NULL THEN 'active'
          WHEN a.id IS NOT NULL AND a.link_expires_at <= now() THEN 'expired'
          WHEN a.id IS NOT NULL THEN 'link_generated'
          ELSE i.status
        END AS demo_status
      FROM private.website_inquiries i
      LEFT JOIN LATERAL (
        SELECT *
        FROM private.website_demo_access da
        WHERE da.inquiry_id=i.id
        ORDER BY da.created_at DESC
        LIMIT 1
      ) a ON true
      WHERE i.enquiry_type='Product demo'
    ) q
  ),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_demo_list_sessions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC)
    FROM (
      SELECT
        da.id AS demo_access_id,da.inquiry_id,i.reference_code,i.requester_name,
        i.institute_name,i.email,da.link_expires_at,da.duration_minutes,
        da.activated_at,da.session_expires_at,da.extended_at,da.revoked_at,da.created_at,
        CASE
          WHEN da.revoked_at IS NOT NULL THEN 'revoked'
          WHEN da.activated_at IS NOT NULL AND da.session_expires_at <= now() THEN 'expired'
          WHEN da.activated_at IS NOT NULL THEN 'active'
          WHEN da.link_expires_at <= now() THEN 'expired'
          ELSE 'link_generated'
        END AS status
      FROM private.website_demo_access da
      JOIN private.website_inquiries i ON i.id=da.inquiry_id
      ORDER BY da.created_at DESC
      LIMIT 300
    ) q
  ),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_demo_extend(p_demo_access_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_request_id uuid; v_expiry timestamptz;
BEGIN
  PERFORM private.require_platform_admin();
  UPDATE private.website_demo_access
  SET session_expires_at=session_expires_at + interval '10 minutes',
      extended_at=now()
  WHERE id=p_demo_access_id
    AND revoked_at IS NULL
    AND activated_at IS NOT NULL
    AND session_expires_at > now()
    AND extended_at IS NULL
  RETURNING inquiry_id,session_expires_at INTO v_request_id,v_expiry;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This session cannot be extended. It may be inactive, expired, revoked or already extended.';
  END IF;
  INSERT INTO private.website_demo_audit(inquiry_id,demo_access_id,actor_id,action,details)
  VALUES (v_request_id,p_demo_access_id,auth.uid(),'SESSION_EXTENDED',jsonb_build_object('minutes_added',10,'new_expiry',v_expiry));
  RETURN v_expiry;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_demo_revoke(p_demo_access_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_request_id uuid;
BEGIN
  PERFORM private.require_platform_admin();
  UPDATE private.website_demo_access
  SET revoked_at=COALESCE(revoked_at,now())
  WHERE id=p_demo_access_id
  RETURNING inquiry_id INTO v_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demo access record not found.'; END IF;
  INSERT INTO private.website_demo_audit(inquiry_id,demo_access_id,actor_id,action,details)
  VALUES (v_request_id,p_demo_access_id,auth.uid(),'ACCESS_REVOKED','{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.website_demo_activate(p_token_hash text,p_ip_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_access private.website_demo_access%ROWTYPE;
  v_session_token text;
  v_request_id uuid;
BEGIN
  IF NOT private.consume_website_demo_rate_limit('activate',p_ip_hash,5,900) THEN
    RAISE EXCEPTION 'Too many activation attempts. Please try again later.';
  END IF;
  IF p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'This demo invitation is invalid or expired.';
  END IF;

  SELECT * INTO v_access
  FROM private.website_demo_access
  WHERE token_hash=p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_access.revoked_at IS NOT NULL
    OR v_access.activated_at IS NOT NULL OR v_access.link_expires_at <= now() THEN
    RAISE EXCEPTION 'This demo invitation is invalid, expired or already used.';
  END IF;

  v_session_token := encode(extensions.gen_random_bytes(32),'hex');
  UPDATE private.website_demo_access
  SET activated_at=now(),
      session_hash=encode(extensions.digest(v_session_token,'sha256'),'hex'),
      session_expires_at=now() + make_interval(mins=>v_access.duration_minutes)
  WHERE id=v_access.id
  RETURNING inquiry_id INTO v_request_id;

  INSERT INTO private.website_demo_audit(inquiry_id,demo_access_id,action,details)
  VALUES (v_request_id,v_access.id,'SESSION_ACTIVATED',jsonb_build_object('duration_minutes',v_access.duration_minutes));

  RETURN jsonb_build_object(
    'session_token',v_session_token,
    'expires_at',now() + make_interval(mins=>v_access.duration_minutes)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.website_demo_validate(p_session_hash text,p_ip_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_access private.website_demo_access%ROWTYPE;
BEGIN
  IF NOT private.consume_website_demo_rate_limit('validate',p_ip_hash,120,900) THEN
    RAISE EXCEPTION 'Too many demo session validation requests.';
  END IF;
  IF p_session_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN jsonb_build_object('valid',false);
  END IF;

  SELECT * INTO v_access
  FROM private.website_demo_access
  WHERE session_hash=p_session_hash
  LIMIT 1;

  IF NOT FOUND OR v_access.revoked_at IS NOT NULL
    OR v_access.session_expires_at IS NULL OR v_access.session_expires_at <= now() THEN
    RETURN jsonb_build_object('valid',false);
  END IF;

  RETURN jsonb_build_object(
    'valid',true,'expires_at',v_access.session_expires_at,
    'extension_available',v_access.extended_at IS NULL
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_admin_demo_update_request(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_demo_issue_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_demo_list_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_demo_list_sessions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_demo_extend(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_demo_revoke(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_demo_update_request(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_demo_issue_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_demo_list_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_demo_list_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_demo_extend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_demo_revoke(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.website_demo_activate(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.website_demo_validate(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_demo_activate(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.website_demo_validate(text,text) TO service_role;

COMMIT;
