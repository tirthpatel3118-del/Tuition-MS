-- One-time, database-owner-controlled bootstrap for the first platform administrator.
-- The bootstrap path is dormant unless explicitly populated in this private table,
-- and automatically closes as soon as a platform admin row exists.
BEGIN;

CREATE TABLE IF NOT EXISTS private.platform_admin_bootstrap (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  email text NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
  expires_at timestamptz NOT NULL
);
ALTER TABLE private.platform_admin_bootstrap ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.platform_admin_bootstrap FROM PUBLIC, anon, authenticated;

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
    OR (
      NOT EXISTS (SELECT 1 FROM private.platform_admins)
      AND EXISTS (
        SELECT 1 FROM private.platform_admin_bootstrap b
        WHERE b.singleton = true
          AND lower(b.email) = lower(NEW.email)
          AND b.expires_at > now()
      )
    )
  ) THEN
    RAISE EXCEPTION 'EduLedger accounts require a valid invitation.';
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
