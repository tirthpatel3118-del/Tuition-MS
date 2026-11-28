-- Expand the private deletion archive to retain all append-only financial/legal rows.
BEGIN;

ALTER TABLE private.deleted_institute_audit_archive
  DROP CONSTRAINT IF EXISTS deleted_institute_audit_archive_source_table_check;

ALTER TABLE private.deleted_institute_audit_archive
  ADD CONSTRAINT deleted_institute_audit_archive_source_table_check
  CHECK (source_table = ANY (ARRAY[
    'financial_audit_logs',
    'institute_legal_declarations',
    'platform_billing_invoices',
    'platform_billing_payments',
    'payment_allocations',
    'payment_reversals',
    'payments',
    'receipts',
    'user_legal_acceptances'
  ]));

COMMENT ON TABLE private.deleted_institute_audit_archive IS
  'Private immutable snapshots of financial audit, payment, receipt, legal acceptance/declaration, and platform billing rows retained when a Development test institute is permanently removed. No client role has table access.';

COMMIT;
