CREATE TABLE IF NOT EXISTS private.website_intake_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  gateway_secret_hash text NOT NULL CHECK (gateway_secret_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.website_intake_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.website_intake_config FROM PUBLIC, anon, authenticated;
-- Provision the gateway hash out-of-band per environment; never commit a usable credential hash.
