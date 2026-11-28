-- Private preservation archive for audit and billing evidence when Development test institutes are permanently removed.
BEGIN;

CREATE TABLE IF NOT EXISTS private.deleted_institute_audit_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL CHECK (source_table = ANY (ARRAY[
    'financial_audit_logs',
    'institute_legal_declarations',
    'platform_billing_invoices',
    'platform_billing_payments'
  ])),
  original_record_id uuid NOT NULL,
  original_institute_id uuid NOT NULL,
  original_institute_name text NOT NULL,
  record_data jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_reason text NOT NULL DEFAULT 'institute_permanent_deletion'
);

CREATE INDEX IF NOT EXISTS idx_deleted_institute_audit_archive_lookup
  ON private.deleted_institute_audit_archive(original_institute_id, source_table, archived_at DESC);

ALTER TABLE private.deleted_institute_audit_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.deleted_institute_audit_archive FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS deleted_institute_audit_archive_immutable ON private.deleted_institute_audit_archive;
CREATE TRIGGER deleted_institute_audit_archive_immutable
  BEFORE UPDATE OR DELETE ON private.deleted_institute_audit_archive
  FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_mutation();

COMMENT ON TABLE private.deleted_institute_audit_archive IS
  'Private, immutable snapshots of financial audit, legal declaration, and platform billing rows retained when an institute is permanently removed. No client role has table access.';

COMMIT;
