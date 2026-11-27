ALTER TABLE private.platform_invitations
  DROP CONSTRAINT IF EXISTS platform_invitations_email_check;

ALTER TABLE private.platform_invitations
  ADD CONSTRAINT platform_invitations_email_check
  CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$'
  );
