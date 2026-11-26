BEGIN;

ALTER TABLE public.institute_members
  ADD COLUMN IF NOT EXISTS owner_appointed_at timestamptz;

UPDATE public.institute_members
SET owner_appointed_at = created_at
WHERE role = 'owner' AND owner_appointed_at IS NULL;

UPDATE public.institute_members
SET owner_appointed_at = now()
WHERE role <> 'owner' AND owner_appointed_at IS NULL;

ALTER TABLE public.institute_members
  ALTER COLUMN owner_appointed_at SET DEFAULT now(),
  ALTER COLUMN owner_appointed_at SET NOT NULL;

CREATE OR REPLACE FUNCTION private.track_owner_appointment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.role = 'owner' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'owner') THEN
    NEW.owner_appointed_at := now();
  ELSIF TG_OP = 'INSERT' THEN
    NEW.owner_appointed_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS institute_owner_appointment_clock ON public.institute_members;
CREATE TRIGGER institute_owner_appointment_clock
BEFORE INSERT OR UPDATE OF role ON public.institute_members
FOR EACH ROW EXECUTE FUNCTION private.track_owner_appointment();

CREATE OR REPLACE FUNCTION private.is_member_of(
  _institute_id uuid,
  _required_roles text[] DEFAULT ARRAY['owner','accountant','teacher']::text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.institute_members m
      CROSS JOIN private.legal_transition_config c
      WHERE m.institute_id = _institute_id
        AND m.user_id = auth.uid()
        AND m.role = ANY(_required_roles)
        AND c.singleton = true
        AND private.has_current_account_legal_acceptance(auth.uid())
        AND (
          m.role <> 'owner'
          OR private.has_current_institute_legal_acceptance(auth.uid(), _institute_id)
          OR (
            m.owner_appointed_at < c.activated_at
            AND now() < c.activated_at + make_interval(days => c.grace_days)
          )
        )
    )
    AND COALESCE((SELECT c.access_status FROM private.platform_institute_controls c WHERE c.institute_id = _institute_id), 'active') = 'active'
    AND COALESCE((SELECT c.subscription_status FROM private.platform_institute_controls c WHERE c.institute_id = _institute_id), 'trial') IN ('trial','active','past_due')
    AND COALESCE((SELECT c.starts_at FROM private.platform_institute_controls c WHERE c.institute_id = _institute_id), '-infinity'::timestamptz) <= now()
    AND COALESCE((SELECT c.expires_at FROM private.platform_institute_controls c WHERE c.institute_id = _institute_id), 'infinity'::timestamptz) > now();
$function$;

ALTER FUNCTION public.get_my_dpa_requirements() RENAME TO get_my_dpa_requirements_v04_base;
REVOKE ALL ON FUNCTION public.get_my_dpa_requirements_v04_base() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_dpa_requirements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_deadline timestamptz;
  v_grace_days integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  v_result := public.get_my_dpa_requirements_v04_base();

  SELECT grace_days INTO v_grace_days
  FROM private.legal_transition_config
  WHERE singleton = true;

  SELECT min(
    CASE
      WHEN m.owner_appointed_at < c.activated_at
        THEN c.activated_at + make_interval(days => c.grace_days)
      ELSE now()
    END
  )
  INTO v_deadline
  FROM public.institute_members m
  CROSS JOIN private.legal_transition_config c
  WHERE m.user_id = v_user_id
    AND m.role = 'owner'
    AND c.singleton = true
    AND NOT private.has_current_institute_legal_acceptance(v_user_id, m.institute_id);

  v_result := jsonb_set(
    v_result,
    '{transition_deadline_at}',
    COALESCE(to_jsonb(v_deadline), 'null'::jsonb),
    true
  );
  v_result := jsonb_set(
    v_result,
    '{transition_days}',
    COALESCE(to_jsonb(v_grace_days), '14'::jsonb),
    true
  );
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_dpa_requirements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_dpa_requirements() TO authenticated;

CREATE OR REPLACE FUNCTION private.prevent_institute_declaration_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'Institute legal declarations are append-only and cannot be edited or deleted through the application.';
END;
$function$;

DROP TRIGGER IF EXISTS institute_legal_declarations_immutable ON public.institute_legal_declarations;
CREATE TRIGGER institute_legal_declarations_immutable
BEFORE UPDATE OR DELETE ON public.institute_legal_declarations
FOR EACH ROW EXECUTE FUNCTION private.prevent_institute_declaration_mutation();

COMMIT;
