-- Central website enquiry/access intake managed from the ClassBandhu Platform Super Admin.
BEGIN;

CREATE TABLE IF NOT EXISTS private.website_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  requester_name text NOT NULL,
  institute_name text NOT NULL,
  email text NOT NULL,
  phone text,
  city text,
  enquiry_type text NOT NULL,
  contact_preference text NOT NULL DEFAULT 'Email',
  message text,
  status text NOT NULL DEFAULT 'new' CHECK (status = ANY (ARRAY['new','contacted','demo_scheduled','closed'])),
  admin_notes text NOT NULL DEFAULT '',
  notification_status text NOT NULL DEFAULT 'pending_config' CHECK (notification_status = ANY (ARRAY['pending_config','sent','failed','not_configured'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_inquiry_name_check CHECK (char_length(trim(requester_name)) BETWEEN 2 AND 100),
  CONSTRAINT website_inquiry_institute_check CHECK (char_length(trim(institute_name)) BETWEEN 2 AND 150),
  CONSTRAINT website_inquiry_email_check CHECK (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);
CREATE INDEX IF NOT EXISTS idx_website_inquiries_created_at ON private.website_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_inquiries_status_created ON private.website_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_inquiries_email ON private.website_inquiries(lower(email));

CREATE TABLE IF NOT EXISTS private.website_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  requester_name text NOT NULL,
  institute_name text NOT NULL,
  email text NOT NULL,
  phone text,
  city text,
  requested_role text NOT NULL CHECK (requested_role = ANY (ARRAY['owner','teacher','accountant'])),
  message text,
  status text NOT NULL DEFAULT 'new' CHECK (status = ANY (ARRAY['new','reviewing','approved','rejected','closed'])),
  admin_notes text NOT NULL DEFAULT '',
  linked_invitation_id uuid REFERENCES private.platform_invitations(id) ON DELETE SET NULL,
  notification_status text NOT NULL DEFAULT 'pending_config' CHECK (notification_status = ANY (ARRAY['pending_config','sent','failed','not_configured'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_access_request_name_check CHECK (char_length(trim(requester_name)) BETWEEN 2 AND 100),
  CONSTRAINT website_access_request_institute_check CHECK (char_length(trim(institute_name)) BETWEEN 2 AND 150),
  CONSTRAINT website_access_request_email_check CHECK (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);
CREATE INDEX IF NOT EXISTS idx_website_access_requests_created_at ON private.website_access_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_access_requests_status_created ON private.website_access_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_access_requests_email ON private.website_access_requests(lower(email));

CREATE TABLE IF NOT EXISTS private.website_intake_rate_limits (
  scope text NOT NULL,
  ip_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY(scope, ip_hash)
);
CREATE TABLE IF NOT EXISTS private.website_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL CHECK (notification_type = ANY (ARRAY['new_inquiry','new_access_request','inquiry_status_changed','access_request_status_changed'])),
  related_type text NOT NULL CHECK (related_type = ANY (ARRAY['inquiry','access_request'])),
  related_id uuid NOT NULL,
  reference_code text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_website_notifications_created_at ON private.website_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_notifications_unread ON private.website_notifications(created_at DESC) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS private.website_request_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL CHECK (request_type = ANY (ARRAY['inquiry','access_request'])),
  request_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.website_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.website_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.website_intake_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.website_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.website_request_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.website_inquiries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.website_access_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.website_intake_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.website_notifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.website_request_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.consume_website_intake_rate_limit(
  p_scope text, p_ip_hash text, p_limit integer DEFAULT 5, p_window_seconds integer DEFAULT 900
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
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
REVOKE ALL ON FUNCTION private.consume_website_intake_rate_limit(text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.consume_website_intake_rate_limit(text,text,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.website_submit_inquiry(
  p_requester_name text, p_institute_name text, p_email text, p_phone text DEFAULT NULL,
  p_city text DEFAULT NULL, p_enquiry_type text DEFAULT 'General enquiry',
  p_contact_preference text DEFAULT 'Email', p_message text DEFAULT NULL, p_ip_hash text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
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
REVOKE ALL ON FUNCTION public.website_submit_inquiry(text,text,text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_submit_inquiry(text,text,text,text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.website_submit_access_request(
  p_requester_name text, p_institute_name text, p_email text, p_requested_role text,
  p_phone text DEFAULT NULL, p_city text DEFAULT NULL, p_message text DEFAULT NULL, p_ip_hash text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
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
REVOKE ALL ON FUNCTION public.website_submit_access_request(text,text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_submit_access_request(text,text,text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_admin_website_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  PERFORM private.require_platform_admin();
  RETURN jsonb_build_object(
    'total_inquiries',(SELECT count(*) FROM private.website_inquiries),
    'new_inquiries',(SELECT count(*) FROM private.website_inquiries WHERE status='new'),
    'open_inquiries',(SELECT count(*) FROM private.website_inquiries WHERE status IN ('new','contacted','demo_scheduled')),
    'total_access_requests',(SELECT count(*) FROM private.website_access_requests),
    'new_access_requests',(SELECT count(*) FROM private.website_access_requests WHERE status='new'),
    'unread_notifications',(SELECT count(*) FROM private.website_notifications WHERE read_at IS NULL)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_website_list_inquiries(
  p_search text DEFAULT NULL, p_status text DEFAULT NULL, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
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

CREATE OR REPLACE FUNCTION public.platform_admin_website_list_access_requests(
  p_search text DEFAULT NULL, p_status text DEFAULT NULL, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
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

CREATE OR REPLACE FUNCTION public.platform_admin_website_update_inquiry(p_inquiry_id uuid,p_status text,p_admin_notes text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_reference text;
BEGIN
  PERFORM private.require_platform_admin();
  IF p_status NOT IN ('new','contacted','demo_scheduled','closed') THEN RAISE EXCEPTION 'Invalid enquiry status.'; END IF;
  IF char_length(COALESCE(p_admin_notes,'')) > 4000 THEN RAISE EXCEPTION 'Internal notes are too long.'; END IF;
  UPDATE private.website_inquiries SET status=p_status,admin_notes=COALESCE(p_admin_notes,''),updated_at=now()
  WHERE id=p_inquiry_id RETURNING reference_code INTO v_reference;
  IF NOT FOUND THEN RAISE EXCEPTION 'Website enquiry not found.'; END IF;
  INSERT INTO private.website_request_audit(request_type,request_id,actor_id,action,details)
  VALUES('inquiry',p_inquiry_id,auth.uid(),'INQUIRY_UPDATED',jsonb_build_object('status',p_status));
  INSERT INTO private.website_notifications(notification_type,related_type,related_id,reference_code,title,message)
  VALUES('inquiry_status_changed','inquiry',p_inquiry_id,v_reference,'Website enquiry updated','Status changed to '||p_status||'.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_website_update_access_request(
  p_request_id uuid,p_status text,p_admin_notes text DEFAULT '',p_invitation_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_reference text;
BEGIN
  PERFORM private.require_platform_admin();
  IF p_status NOT IN ('new','reviewing','approved','rejected','closed') THEN RAISE EXCEPTION 'Invalid access request status.'; END IF;
  IF char_length(COALESCE(p_admin_notes,'')) > 4000 THEN RAISE EXCEPTION 'Internal notes are too long.'; END IF;
  IF p_status='approved' AND p_invitation_id IS NULL THEN RAISE EXCEPTION 'Create a platform invitation before approving this access request.'; END IF;
  UPDATE private.website_access_requests
  SET status=p_status,admin_notes=COALESCE(p_admin_notes,''),linked_invitation_id=COALESCE(p_invitation_id,linked_invitation_id),updated_at=now()
  WHERE id=p_request_id RETURNING reference_code INTO v_reference;
  IF NOT FOUND THEN RAISE EXCEPTION 'Website access request not found.'; END IF;
  INSERT INTO private.website_request_audit(request_type,request_id,actor_id,action,details)
  VALUES('access_request',p_request_id,auth.uid(),'ACCESS_REQUEST_UPDATED',jsonb_build_object('status',p_status,'invitation_id',p_invitation_id));
  INSERT INTO private.website_notifications(notification_type,related_type,related_id,reference_code,title,message)
  VALUES('access_request_status_changed','access_request',p_request_id,v_reference,'Website access request updated','Status changed to '||p_status||'.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_website_list_notifications(p_unread_only boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC) FROM (
    SELECT id,notification_type,related_type,related_id,reference_code,title,message,read_at,created_at
    FROM private.website_notifications WHERE NOT p_unread_only OR read_at IS NULL
    ORDER BY created_at DESC LIMIT 200
  ) q),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_website_mark_notification_read(p_notification_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  PERFORM private.require_platform_admin();
  UPDATE private.website_notifications SET read_at=COALESCE(read_at,now()) WHERE id=p_notification_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Website notification not found.'; END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_admin_website_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_website_list_inquiries(text,text,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_website_list_access_requests(text,text,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_website_update_inquiry(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_website_update_access_request(uuid,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_website_list_notifications(boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_website_mark_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_website_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_website_list_inquiries(text,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_website_list_access_requests(text,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_website_update_inquiry(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_website_update_access_request(uuid,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_website_list_notifications(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_website_mark_notification_read(uuid) TO authenticated;

COMMIT;
