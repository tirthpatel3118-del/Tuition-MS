-- The initial DPA transition grace period was a one-time staging aid.
-- Expire it now so every existing owner must accept the current Institute bundle.
-- No acceptance evidence or institute data is deleted.
UPDATE private.legal_transition_config
SET activated_at = now() - make_interval(days => grace_days) - interval '1 minute',
    updated_at = now()
WHERE singleton = true;
