-- Platform administration, invitation-only onboarding, and privacy-safe telemetry.
-- This migration is additive and never updates or deletes existing institute records.
BEGIN;

CREATE TABLE IF NOT EXISTS private.platform_admins (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private.platform_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  role text NOT NULL CHECK (role = ANY (ARRAY['owner','teacher','accountant'])),
  institute_id uuid REFERENCES public.institutes(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'Pending' CHECK (status = ANY (ARRAY['Pending','Accepted','Revoked','Expired'])),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT platform_invitation_role_scope_check CHECK (role = 'owner' OR institute_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_platform_invitations_pending_email
  ON private.platform_invitations (lower(email), expires_at) WHERE status = 'Pending';

CREATE TABLE IF NOT EXISTS private.platform_owner_grants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  invitation_id uuid NOT NULL UNIQUE REFERENCES private.platform_invitations(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

CREATE TABLE IF NOT EXISTS private.platform_member_login_daily (
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role = ANY (ARRAY['owner','teacher','accountant'])),
  activity_date date NOT NULL DEFAULT current_date,
  PRIMARY KEY (institute_id, user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_platform_member_login_daily_date
  ON private.platform_member_login_daily (activity_date, institute_id);

CREATE TABLE IF NOT EXISTS private.platform_institute_controls (
  institute_id uuid PRIMARY KEY REFERENCES public.institutes(id) ON DELETE CASCADE,
  access_status text NOT NULL DEFAULT 'active' CHECK (access_status = ANY (ARRAY['active','suspended'])),
  plan_code text NOT NULL DEFAULT 'trial',
  subscription_status text NOT NULL DEFAULT 'trial'
    CHECK (subscription_status = ANY (ARRAY['trial','active','past_due','expired','cancelled'])),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  student_limit integer CHECK (student_limit IS NULL OR student_limit >= 0),
  team_limit integer CHECK (team_limit IS NULL OR team_limit >= 0),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_institute_dates_check CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS private.platform_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  institute_id uuid REFERENCES public.institutes(id) ON DELETE SET NULL,
  invitation_id uuid REFERENCES private.platform_invitations(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_owner_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_member_login_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_institute_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_admin_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON private.platform_admins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.platform_invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.platform_owner_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.platform_member_login_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.platform_institute_controls FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.platform_admin_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM private.platform_admins a WHERE a.user_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION private.require_platform_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied: platform administrator access is required.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION private.is_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.require_platform_admin() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT private.is_platform_admin();
$function$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- The Auth API cannot create arbitrary new identities: email must have a live invite.
-- Existing institute-owner invitations remain valid.
CREATE OR REPLACE FUNCTION private.guard_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.email IS NULL OR NOT (
    EXISTS (
      SELECT 1 FROM public.institute_invitations i
      WHERE lower(i.email) = lower(NEW.email)
        AND i.status = 'Pending' AND i.expires_at > now()
    )
    OR EXISTS (
      SELECT 1 FROM private.platform_invitations i
      WHERE lower(i.email) = lower(NEW.email)
        AND i.status = 'Pending' AND i.expires_at > now()
    )
  ) THEN
    RAISE EXCEPTION 'EduLedger accounts require a valid invitation.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS eduledger_invitation_only_auth_signup ON auth.users;
CREATE TRIGGER eduledger_invitation_only_auth_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.guard_new_auth_user();

-- All existing institute RLS policies call this helper. Suspension/expiry therefore
-- disables tenant data access without giving the platform admin a data-browsing path.
CREATE OR REPLACE FUNCTION private.is_member_of(
  _institute_id uuid,
  _required_roles text[] DEFAULT ARRAY['owner'::text, 'accountant'::text, 'teacher'::text]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.institute_members m
       WHERE m.institute_id = _institute_id
         AND m.user_id = auth.uid()
         AND m.role = ANY(_required_roles)
     )
     AND COALESCE(
       (SELECT c.access_status FROM private.platform_institute_controls c WHERE c.institute_id = _institute_id),
       'active'
     ) = 'active'
     AND COALESCE(
       (SELECT c.subscription_status FROM private.platform_institute_controls c WHERE c.institute_id = _institute_id),
       'trial'
     ) IN ('trial','active','past_due')
     AND COALESCE(
       (SELECT c.starts_at FROM private.platform_institute_controls c WHERE c.institute_id = _institute_id),
       '-infinity'::timestamptz
     ) <= now()
     AND COALESCE(
       (SELECT c.expires_at FROM private.platform_institute_controls c WHERE c.institute_id = _institute_id),
       'infinity'::timestamptz
     ) > now();
$function$;

CREATE OR REPLACE FUNCTION public.get_my_institute_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'institute_id', m.institute_id,
      'institute_name', i.name,
      'role', m.role,
      'access_status', CASE
        WHEN COALESCE(c.access_status,'active') <> 'active' THEN 'suspended'
        WHEN COALESCE(c.subscription_status,'trial') IN ('expired','cancelled')
          OR (c.starts_at IS NOT NULL AND c.starts_at > now())
          OR (c.expires_at IS NOT NULL AND c.expires_at <= now()) THEN 'expired'
        ELSE 'active'
      END
    ) ORDER BY m.created_at, m.institute_id)
    FROM public.institute_members m
    JOIN public.institutes i ON i.id=m.institute_id
    LEFT JOIN private.platform_institute_controls c ON c.institute_id=m.institute_id
    WHERE m.user_id=auth.uid()
  ),'[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_institute_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_institute_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_storage_bytes bigint := 0;
  v_storage_objects bigint := 0;
BEGIN
  PERFORM private.require_platform_admin();
  BEGIN
    SELECT COALESCE(sum(
      CASE WHEN (o.metadata->>'size') ~ '^[0-9]+$'
        THEN (o.metadata->>'size')::bigint ELSE 0 END
    ),0)::bigint, count(*)::bigint
    INTO v_storage_bytes, v_storage_objects
    FROM storage.objects o;
  EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
    v_storage_bytes := 0;
    v_storage_objects := 0;
  END;

  RETURN jsonb_build_object(
    'institute_count',(SELECT count(*) FROM public.institutes),
    'student_count',(SELECT count(*) FROM public.students),
    'team_member_count',(SELECT count(*) FROM public.institute_members),
    'owner_count',(SELECT count(*) FROM public.institute_members WHERE role='owner'),
    'teacher_count',(SELECT count(*) FROM public.institute_members WHERE role='teacher'),
    'accountant_count',(SELECT count(*) FROM public.institute_members WHERE role='accountant'),
    'active_members_30d',(SELECT count(DISTINCT user_id) FROM private.platform_member_login_daily WHERE activity_date >= current_date - 29),
    'active_subscriptions',(SELECT count(*) FROM private.platform_institute_controls WHERE access_status='active' AND subscription_status IN ('trial','active','past_due')),
    'suspended_institutes',(SELECT count(*) FROM private.platform_institute_controls WHERE access_status='suspended'),
    'database_bytes',pg_database_size(current_database()),
    'storage_bytes_project_wide',v_storage_bytes,
    'storage_objects_project_wide',v_storage_objects,
    'per_institute_storage_attribution',false,
    'student_login_tracking_available',false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_list_institutes()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'institute_id',i.id,
      'name',i.name,
      'slug',i.slug,
      'created_at',i.created_at,
      'student_count',(SELECT count(*) FROM public.students s WHERE s.institute_id=i.id),
      'owner_count',(SELECT count(*) FROM public.institute_members m WHERE m.institute_id=i.id AND m.role='owner'),
      'teacher_count',(SELECT count(*) FROM public.institute_members m WHERE m.institute_id=i.id AND m.role='teacher'),
      'accountant_count',(SELECT count(*) FROM public.institute_members m WHERE m.institute_id=i.id AND m.role='accountant'),
      'team_member_count',(SELECT count(*) FROM public.institute_members m WHERE m.institute_id=i.id),
      'active_members_30d',(SELECT count(DISTINCT a.user_id) FROM private.platform_member_login_daily a WHERE a.institute_id=i.id AND a.activity_date >= current_date - 29),
      'active_owners_30d',(SELECT count(DISTINCT a.user_id) FROM private.platform_member_login_daily a WHERE a.institute_id=i.id AND a.role='owner' AND a.activity_date >= current_date - 29),
      'active_teachers_30d',(SELECT count(DISTINCT a.user_id) FROM private.platform_member_login_daily a WHERE a.institute_id=i.id AND a.role='teacher' AND a.activity_date >= current_date - 29),
      'active_accountants_30d',(SELECT count(DISTINCT a.user_id) FROM private.platform_member_login_daily a WHERE a.institute_id=i.id AND a.role='accountant' AND a.activity_date >= current_date - 29),
      'last_active_date',(SELECT max(a.activity_date) FROM private.platform_member_login_daily a WHERE a.institute_id=i.id),
      'access_status',COALESCE(c.access_status,'active'),
      'plan_code',COALESCE(c.plan_code,'trial'),
      'subscription_status',COALESCE(c.subscription_status,'trial'),
      'starts_at',c.starts_at,
      'expires_at',c.expires_at,
      'student_limit',c.student_limit,
      'team_limit',c.team_limit
    ) ORDER BY i.created_at DESC)
    FROM public.institutes i
    LEFT JOIN private.platform_institute_controls c ON c.institute_id=i.id
  ),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_list_invitations()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id',inv.id,'email',inv.email,'role',inv.role,'institute_id',inv.institute_id,
      'institute_name',i.name,
      'status',CASE WHEN inv.status='Pending' AND inv.expires_at<=now() THEN 'Expired' ELSE inv.status END,
      'expires_at',inv.expires_at,'created_at',inv.created_at
    ) ORDER BY inv.created_at DESC)
    FROM private.platform_invitations inv
    LEFT JOIN public.institutes i ON i.id=inv.institute_id
  ),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_create_invitation(p_email text,p_role text,p_institute_id uuid DEFAULT NULL)
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
  IF p_email IS NULL OR trim(p_email)='' OR p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Enter a valid invitation email address.';
  END IF;
  IF p_role NOT IN ('owner','teacher','accountant') THEN RAISE EXCEPTION 'Unsupported invitation role.'; END IF;
  IF p_role<>'owner' AND p_institute_id IS NULL THEN RAISE EXCEPTION 'Teacher and accountant invitations require an institute.'; END IF;
  IF p_institute_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.institutes WHERE id=p_institute_id) THEN
    RAISE EXCEPTION 'Selected institute does not exist.';
  END IF;

  UPDATE private.platform_invitations SET status='Revoked'
  WHERE lower(email)=lower(trim(p_email))
    AND institute_id IS NOT DISTINCT FROM p_institute_id
    AND status='Pending';

  v_raw_token:=encode(extensions.gen_random_bytes(32),'hex');
  v_token_hash:=encode(extensions.digest(v_raw_token,'sha256'),'hex');
  v_expiry:=now()+interval '48 hours';
  INSERT INTO private.platform_invitations(email,role,institute_id,token_hash,invited_by,expires_at)
  VALUES(lower(trim(p_email)),p_role,p_institute_id,v_token_hash,auth.uid(),v_expiry)
  RETURNING id INTO v_id;

  INSERT INTO private.platform_admin_audit(actor_id,action,institute_id,invitation_id,details)
  VALUES(auth.uid(),'INVITATION_CREATED',p_institute_id,v_id,jsonb_build_object('role',p_role));

  RETURN jsonb_build_object('invitation_id',v_id,'email',lower(trim(p_email)),'role',p_role,
    'institute_id',p_institute_id,'raw_token',v_raw_token,'expires_at',v_expiry);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_revoke_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_institute_id uuid;
BEGIN
  PERFORM private.require_platform_admin();
  UPDATE private.platform_invitations SET status='Revoked'
  WHERE id=p_invitation_id AND status='Pending'
  RETURNING institute_id INTO v_institute_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending invitation not found.'; END IF;
  INSERT INTO private.platform_admin_audit(actor_id,action,institute_id,invitation_id)
  VALUES(auth.uid(),'INVITATION_REVOKED',v_institute_id,p_invitation_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_set_institute_controls(
  p_institute_id uuid,p_access_status text,p_plan_code text,p_subscription_status text,
  p_starts_at timestamptz DEFAULT now(),p_expires_at timestamptz DEFAULT NULL,
  p_student_limit integer DEFAULT NULL,p_team_limit integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.require_platform_admin();
  IF NOT EXISTS(SELECT 1 FROM public.institutes WHERE id=p_institute_id) THEN RAISE EXCEPTION 'Institute not found.'; END IF;
  IF p_access_status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Invalid institute access status.'; END IF;
  IF p_subscription_status NOT IN ('trial','active','past_due','expired','cancelled') THEN RAISE EXCEPTION 'Invalid subscription status.'; END IF;
  IF p_plan_code IS NULL OR trim(p_plan_code)='' THEN RAISE EXCEPTION 'A plan code is required.'; END IF;
  IF p_student_limit IS NOT NULL AND p_student_limit<0 THEN RAISE EXCEPTION 'Student limit cannot be negative.'; END IF;
  IF p_team_limit IS NOT NULL AND p_team_limit<0 THEN RAISE EXCEPTION 'Team limit cannot be negative.'; END IF;
  IF p_expires_at IS NOT NULL AND p_starts_at IS NOT NULL AND p_expires_at<=p_starts_at THEN RAISE EXCEPTION 'Expiry must be later than start.'; END IF;

  INSERT INTO private.platform_institute_controls(institute_id,access_status,plan_code,subscription_status,starts_at,expires_at,student_limit,team_limit,updated_by,updated_at)
  VALUES(p_institute_id,p_access_status,trim(p_plan_code),p_subscription_status,COALESCE(p_starts_at,now()),p_expires_at,p_student_limit,p_team_limit,auth.uid(),now())
  ON CONFLICT(institute_id) DO UPDATE SET
    access_status=EXCLUDED.access_status,plan_code=EXCLUDED.plan_code,subscription_status=EXCLUDED.subscription_status,
    starts_at=EXCLUDED.starts_at,expires_at=EXCLUDED.expires_at,student_limit=EXCLUDED.student_limit,
    team_limit=EXCLUDED.team_limit,updated_by=EXCLUDED.updated_by,updated_at=now();

  INSERT INTO private.platform_admin_audit(actor_id,action,institute_id,details)
  VALUES(auth.uid(),'INSTITUTE_CONTROLS_UPDATED',p_institute_id,
    jsonb_build_object('access_status',p_access_status,'plan_code',p_plan_code,'subscription_status',p_subscription_status));
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_member_login_activity(p_institute_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT m.role INTO v_role FROM public.institute_members m
  WHERE m.institute_id=p_institute_id AND m.user_id=auth.uid();
  IF NOT FOUND OR NOT private.is_member_of(p_institute_id,ARRAY['owner','teacher','accountant']) THEN
    RAISE EXCEPTION 'Active institute membership required.';
  END IF;
  INSERT INTO private.platform_member_login_daily(institute_id,user_id,role,activity_date)
  VALUES(p_institute_id,auth.uid(),v_role,current_date)
  ON CONFLICT(institute_id,user_id,activity_date) DO UPDATE SET role=EXCLUDED.role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_platform_invitation(p_raw_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email text;
  v_inv record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to accept this invitation.'; END IF;
  IF p_raw_token IS NULL OR length(p_raw_token)<32 THEN RAISE EXCEPTION 'Invalid invitation token.'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=auth.uid();
  IF v_email IS NULL THEN RAISE EXCEPTION 'Authenticated email address is required.'; END IF;

  SELECT * INTO v_inv FROM private.platform_invitations
  WHERE token_hash=encode(extensions.digest(p_raw_token,'sha256'),'hex') FOR UPDATE;

  IF NOT FOUND OR v_inv.status<>'Pending' OR v_inv.expires_at<=now() THEN
    RAISE EXCEPTION 'Invitation expired, revoked, or not found.';
  END IF;
  IF lower(v_inv.email)<>v_email THEN RAISE EXCEPTION 'This invitation was issued to a different email address.'; END IF;

  IF v_inv.institute_id IS NULL THEN
    IF v_inv.role<>'owner' THEN RAISE EXCEPTION 'A new institute invitation must use the owner role.'; END IF;
    INSERT INTO private.platform_owner_grants(user_id,invitation_id)
    VALUES(auth.uid(),v_inv.id)
    ON CONFLICT(user_id) DO UPDATE SET invitation_id=EXCLUDED.invitation_id,created_at=now(),consumed_at=NULL;
  ELSE
    IF EXISTS(SELECT 1 FROM public.institute_members WHERE institute_id=v_inv.institute_id AND user_id=auth.uid()) THEN
      RAISE EXCEPTION 'This account is already a member of the selected institute.';
    END IF;
    INSERT INTO public.institute_members(institute_id,user_id,role)
    VALUES(v_inv.institute_id,auth.uid(),v_inv.role);
  END IF;

  UPDATE private.platform_invitations SET status='Accepted',accepted_at=now() WHERE id=v_inv.id;
  INSERT INTO private.platform_admin_audit(actor_id,action,institute_id,invitation_id,details)
  VALUES(auth.uid(),'INVITATION_ACCEPTED',v_inv.institute_id,v_inv.id,jsonb_build_object('role',v_inv.role));

  RETURN jsonb_build_object('status','SUCCESS','role',v_inv.role,'institute_id',v_inv.institute_id,
    'needs_institute_setup',v_inv.institute_id IS NULL);
END;
$function$;

-- Only a user holding a valid platform-issued owner grant can create their first institute.
-- Existing institute owners preserve their ability to add another institute.
CREATE OR REPLACE FUNCTION public.create_institute_atomic(
  p_name text,p_slug text,p_currency_symbol text DEFAULT '₹'::text,p_receipt_prefix text DEFAULT 'REC'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_new_inst_id uuid;
  v_user_id uuid:=auth.uid();
  v_owner_grant_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication Required: Caller must be authenticated.'; END IF;
  IF length(trim(COALESCE(p_name,'')))<2 OR trim(COALESCE(p_slug,'')) !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Enter a valid institute name and workspace address.';
  END IF;

  SELECT invitation_id INTO v_owner_grant_id FROM private.platform_owner_grants
  WHERE user_id=v_user_id AND consumed_at IS NULL FOR UPDATE;
  IF v_owner_grant_id IS NULL THEN
    RAISE EXCEPTION 'An active EduLedger owner invitation is required before creating an institute.';
  END IF;

  INSERT INTO public.institutes(name,slug,currency_symbol,receipt_prefix)
  VALUES(trim(p_name),lower(trim(p_slug)),p_currency_symbol,p_receipt_prefix)
  RETURNING id INTO v_new_inst_id;
  INSERT INTO public.institute_members(institute_id,user_id,role) VALUES(v_new_inst_id,v_user_id,'owner');
  INSERT INTO public.institute_receipt_counters(institute_id,year,prefix,last_number)
  VALUES(v_new_inst_id,to_char(now(),'YYYY'),p_receipt_prefix,0);
  INSERT INTO public.institute_settings(institute_id,key,value)
  VALUES(v_new_inst_id,'app_settings',jsonb_build_object(
    'instituteName',trim(p_name),'currencySymbol',p_currency_symbol,'receiptPrefix',p_receipt_prefix,
    'dateFormat','YYYY-MM-DD','timeZone','Asia/Kolkata'
  ));
  IF v_owner_grant_id IS NOT NULL THEN
    UPDATE private.platform_owner_grants SET consumed_at=now() WHERE user_id=v_user_id;
  END IF;
  RETURN v_new_inst_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_admin_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_list_institutes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_list_invitations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_create_invitation(text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_revoke_invitation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_set_institute_controls(uuid,text,text,text,timestamptz,timestamptz,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_member_login_activity(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_platform_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_list_institutes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_list_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_create_invitation(text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_revoke_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_set_institute_controls(uuid,text,text,text,timestamptz,timestamptz,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_member_login_activity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_platform_invitation(text) TO authenticated;

COMMIT;
