-- Allow the explicitly bootstrapped first platform administrator to be invited.
-- The bootstrap row is short-lived and email-scoped; normal users still require
-- an institute or platform invitation. Remove the bootstrap row after provisioning.
BEGIN;

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
    OR EXISTS (
      SELECT 1 FROM private.platform_admin_bootstrap b
      WHERE b.singleton = true
        AND lower(b.email) = lower(NEW.email)
        AND b.expires_at > now()
    )
  ) THEN
    RAISE EXCEPTION 'EduLedger accounts require a valid invitation.';
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
