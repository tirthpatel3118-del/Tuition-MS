import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../supabase/migrations/20261126174500_legal_compliance_acceptance.sql");
const seed = read("../supabase/migrations/20261126174600_seed_legal_document_drafts.sql");
const capture = read("../supabase/migrations/20261126180000_legal_acceptance_capture_hardening.sql");
const exportMigration = read("../supabase/migrations/20261126181000_legal_acceptance_export.sql");
const auditMigration = read("../supabase/migrations/20261126182000_legal_locale_and_admin_audit.sql");
const authPages = read("../src/pages/AuthPages.tsx");
const authContext = read("../src/context/AuthContext.tsx");
const legalPages = read("../src/pages/LegalPages.tsx");
const legalService = read("../src/services/legalService.ts");
const adminPanel = read("../src/components/LegalCompliancePanel.tsx");
const app = read("../src/App.tsx");
const adminDashboard = read("../src/pages/SuperAdminDashboard.tsx");

for (const [name, migration] of [["schema", schema], ["seed", seed], ["capture", capture], ["export", exportMigration], ["audit", auditMigration]]) {
  assert.ok(migration.trim().length > 100, name + " migration should not be empty");
}

for (const table of ["legal_documents", "user_legal_acceptances", "privacy_consent_events"]) {
  assert.match(schema, new RegExp("CREATE TABLE IF NOT EXISTS public\\." + table));
}
assert.match(schema, /CREATE TABLE IF NOT EXISTS private\.legal_admin_audit_logs/);
assert.match(schema, /ALTER TABLE public\.legal_documents ENABLE ROW LEVEL SECURITY/);
assert.match(schema, /ALTER TABLE public\.user_legal_acceptances ENABLE ROW LEVEL SECURITY/);
assert.match(schema, /Published legal documents are public/);
assert.match(schema, /Users can view their own legal acceptance history/);
assert.match(schema, /Users can view their own privacy consent history/);
assert.match(schema, /prevent_legal_history_mutation/);
assert.match(schema, /content_sha256/);
assert.match(schema, /platform_admin_publish_legal_document/);
assert.match(seed, /privacy-policy/);
assert.match(seed, /terms-of-service/);
assert.match(seed, /data-processing-agreement/);
assert.match(seed, /'draft',is_required,is_test_only/);
assert.match(capture, /legal_terms_document_id/);
assert.match(capture, /legal_privacy_document_id/);
assert.match(capture, /privacy_consent_events/);
assert.match(capture, /DEVELOPMENT DRAFT/);
assert.match(capture, /unresolved placeholders/);
assert.match(exportMigration, /platform_admin_export_legal_acceptances/);
assert.match(exportMigration, /private\.require_platform_admin\(\)/);
assert.doesNotMatch(schema + capture + exportMigration, /DROP TABLE/i);

assert.match(authPages, /getPublishedRequiredLegalDocuments/);
assert.match(authPages, /I agree to the/);
assert.match(authPages, /Optional: Send me ClassBandhu product news/);
assert.match(authPages, /legalDocuments.length < 2/);
assert.match(authContext, /legal_terms_accepted: true/);
assert.match(authContext, /legal_terms_document_id: legalAcceptance\.termsDocumentId/);
assert.match(authContext, /legal_privacy_document_id: legalAcceptance\.privacyDocumentId/);

assert.match(legalPages, /LegalAcceptanceGate/);
assert.match(legalPages, /acceptCurrentLegalDocuments/);
assert.match(legalPages, /DEVELOPMENT TEST COPY/);
assert.match(legalPages, /setMyProductUpdateConsent/);
assert.match(legalPages, /acceptInstituteDpa/);
assert.match(legalPages, /listMyLegalAcceptances/);
assert.match(legalPages, /Export my records/);
assert.match(legalService, /get_my_legal_status/);
assert.match(legalService, /set_privacy_consent/);
assert.match(legalService, /platform_admin_export_legal_acceptances/);
assert.match(legalService, /platform_admin_legal_audit_logs/);

assert.match(app, /get_my_legal_status/);
assert.match(app, /LegalAcceptanceGate/);
assert.match(app, /PrivacyPreferencesPage/);
assert.match(app, /location\.pathname === '\/dpa'/);
assert.match(adminDashboard, /LegalCompliancePanel/);
assert.match(legalService, /platform_admin_list_legal_documents/);
assert.match(adminPanel, /Export audit CSV/);
assert.match(adminPanel, /Policy administration audit trail/);
assert.match(adminPanel, /TEST ONLY/);
assert.match(adminPanel, /No student information is included/);

console.log("PASS: legal versioning, invitation signup acceptance, reacceptance gate, privacy preferences, DPA and audit export checks");
