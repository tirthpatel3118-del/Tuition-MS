-- Defense in depth for private legal transition configuration.
-- The table remains intentionally policy-less and is not granted directly to
-- anon/authenticated; vetted SECURITY DEFINER routines and DB administrators
-- perform the required reads/writes.
ALTER TABLE private.legal_transition_config ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE private.legal_transition_config IS
  'Private legal transition control configuration. RLS is enabled; no client policies are defined. Access is limited to vetted SECURITY DEFINER routines and database administrators.';
