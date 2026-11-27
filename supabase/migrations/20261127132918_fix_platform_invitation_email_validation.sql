CREATE OR REPLACE FUNCTION public.platform_admin_create_invitation(
  p_email text,
  p_role text,
  p_institute_id uuid DEFAULT NULL::uuid
)
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
