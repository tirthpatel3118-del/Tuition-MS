BEGIN;

CREATE INDEX IF NOT EXISTS legal_documents_created_by_idx
  ON public.legal_documents (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS legal_documents_updated_by_idx
  ON public.legal_documents (updated_by) WHERE updated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS legal_documents_published_by_idx
  ON public.legal_documents (published_by) WHERE published_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_legal_acceptances_institute_idx
  ON public.user_legal_acceptances (institute_id) WHERE institute_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS privacy_consent_events_privacy_document_idx
  ON public.privacy_consent_events (privacy_document_id) WHERE privacy_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS legal_admin_audit_logs_actor_idx
  ON private.legal_admin_audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS legal_admin_audit_logs_document_idx
  ON private.legal_admin_audit_logs (document_id) WHERE document_id IS NOT NULL;

COMMIT;