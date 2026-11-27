CREATE TABLE IF NOT EXISTS private.website_intake_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  gateway_secret_hash text NOT NULL CHECK (gateway_secret_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.website_intake_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.website_intake_config FROM PUBLIC, anon, authenticated;
INSERT INTO private.website_intake_config(singleton,gateway_secret_hash)
VALUES(true,'910fc1b1b891a23983e6ec17ede9c812393ec1488500ea34106c218ab17e021b')
ON CONFLICT(singleton) DO UPDATE
SET gateway_secret_hash=EXCLUDED.gateway_secret_hash,updated_at=now();
