-- Avoid regex escape ambiguity in the one-time bootstrap email constraint.
ALTER TABLE private.platform_admin_bootstrap
  DROP CONSTRAINT IF EXISTS platform_admin_bootstrap_email_check;
ALTER TABLE private.platform_admin_bootstrap
  ADD CONSTRAINT platform_admin_bootstrap_email_check
  CHECK (
    position('@' in email) > 1
    AND position('.' in split_part(email, '@', 2)) > 1
    AND email = lower(email)
  );
