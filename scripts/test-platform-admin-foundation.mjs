import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20261118170000_platform_admin_and_invite_only_onboarding.sql");
const edge = read("../supabase/functions/platform-admin-invitation/index.ts");
const dashboard = read("../src/pages/SuperAdminDashboard.tsx");
const service = read("../src/services/platformAdminService.ts");
const authContext = read("../src/context/AuthContext.tsx");
const authPages = read("../src/pages/AuthPages.tsx");
const invitationPage = read("../src/pages/PlatformInvitationAcceptancePage.tsx");
const app = read("../src/App.tsx");

assert.ok(migration.includes("\nBEGIN;"), "migration must be wrapped in a transaction");
assert.ok(migration.trimEnd().endsWith("COMMIT;"), "migration must commit");
assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS private.platform_admins"));
assert.ok(migration.includes("user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id)"));
assert.ok(migration.includes("CREATE TRIGGER eduledger_invitation_only_auth_signup"));
assert.ok(migration.includes("EduLedger accounts require a valid invitation."));
assert.ok(migration.includes("CREATE OR REPLACE FUNCTION public.accept_platform_invitation"));
assert.ok(migration.includes("CREATE OR REPLACE FUNCTION public.platform_admin_list_institutes"));
assert.ok(migration.includes("CREATE OR REPLACE FUNCTION public.platform_admin_set_institute_controls"));
assert.ok(migration.includes("now()+interval '48 hours'"));
assert.ok(migration.includes("platform_owner_grants"));
assert.ok(!/DELETE FROM public\./i.test(migration), "migration must not delete existing public data");
assert.ok(!/DROP TABLE/i.test(migration), "migration must not drop tables");

const instituteStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.platform_admin_list_institutes()");
const instituteEnd = migration.indexOf("$function$;", instituteStart);
assert.ok(instituteStart >= 0 && instituteEnd > instituteStart, "aggregate institute RPC must exist");
const instituteSummary = migration.slice(instituteStart, instituteEnd);
assert.ok(instituteSummary.includes("count(*)"), "institute RPC must return aggregate counts");
for (const privateField of ["full_name", "parent_name", "parent_whatsapp", "student_mobile", "payment_mode", "payment_date", "receipt_number", "attendance_status"]) {
  assert.ok(!instituteSummary.includes(privateField), "institute RPC must not expose " + privateField);
}

assert.ok(edge.includes("auth.admin.generateLink"));
assert.ok(edge.includes('type: "invite"'));
assert.ok(edge.includes('type: "magiclink"'));
assert.ok(edge.includes("is_platform_admin"));
assert.ok(edge.includes("SUPABASE_SERVICE_ROLE_KEY"));
assert.ok(edge.includes("EDULEDGER_APP_URL"));

assert.ok(service.includes("platform_admin_overview"));
assert.ok(service.includes("platform_admin_list_institutes"));
assert.ok(service.includes("platform-admin-invitation"));
assert.ok(!service.toLowerCase().includes("service_role"), "service-role key must not be shipped in browser code");

assert.ok(authContext.includes("accept_platform_invitation"));
assert.ok(authContext.includes("get_my_institute_access"));
assert.ok(authContext.includes("record_member_login_activity"));
assert.ok(authContext.includes("if (!invitationToken) throw new Error"));
assert.ok(authPages.includes("invitationToken"));
assert.ok(authPages.includes("Access is provided by invitation"));
assert.ok(!authPages.includes('<Link to="/sign-up"'), "public sign-up link must be removed");
assert.ok(invitationPage.includes("acceptPlatformInvitation"));
assert.ok(invitationPage.includes("Create password"));
assert.ok(app.includes("/super-admin"));
assert.ok(app.includes("PlatformInvitationAcceptancePage"));
assert.ok(dashboard.includes("student_count"));
assert.ok(dashboard.includes("active_accountants_30d"));
assert.ok(dashboard.includes("storage_bytes_project_wide"));
assert.ok(dashboard.includes("No institute — owner creates one"));
assert.ok(dashboard.includes("student and guardian details, member email addresses, fees, payments, receipts and attendance content are not exposed"));

console.log("Platform Admin foundation source checks passed.");
