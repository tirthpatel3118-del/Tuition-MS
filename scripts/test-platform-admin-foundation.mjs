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

assert.match(migration, /(?:^|\\n)BEGIN;\\s/);
assert.match(migration, /COMMIT;\s*$/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS private\.platform_admins/);
assert.match(migration, /user_id uuid NOT NULL UNIQUE REFERENCES auth\\.users/);
assert.match(migration, /CREATE TRIGGER eduledger_invitation_only_auth_signup/);
assert.match(migration, /EduLedger accounts require a valid invitation/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.accept_platform_invitation/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.platform_admin_list_institutes/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.platform_admin_set_institute_controls/);
assert.match(migration, /now\(\)\+interval '48 hours'/);
assert.match(migration, /platform_owner_grants/);
assert.doesNotMatch(migration, /DELETE FROM public\./i);
assert.doesNotMatch(migration, /DROP TABLE/i);

const instituteSummary = migration.match(/CREATE OR REPLACE FUNCTION public\.platform_admin_list_institutes\(\)([\s\S]*?)\$function\$;/)?.[1] ?? "";
assert.ok(instituteSummary.length > 0, "aggregate institute RPC must exist");
assert.match(instituteSummary, /count\(\*\)/i);
assert.doesNotMatch(instituteSummary, /full_name|parent_name|parent_whatsapp|student_mobile|payment_mode|payment_date|receipt_number|attendance_status/i);

assert.match(edge, /auth\.admin\.generateLink/);
assert.match(edge, /type: "invite"/);
assert.match(edge, /type: "magiclink"/);
assert.match(edge, /is_platform_admin/);
assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(edge, /EDULEDGER_APP_URL/);

assert.match(service, /platform_admin_overview/);
assert.match(service, /platform_admin_list_institutes/);
assert.match(service, /platform-admin-invitation/);
assert.doesNotMatch(service, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);

assert.match(authContext, /accept_platform_invitation/);
assert.match(authContext, /get_my_institute_access/);
assert.match(authContext, /record_member_login_activity/);
assert.match(authContext, /if \(!invitationToken\) throw new Error/);
assert.match(authPages, /invitationToken/);
assert.match(authPages, /Access is provided by invitation/);
assert.doesNotMatch(authPages, /<Link to="\/sign-up"/);
assert.match(invitationPage, /acceptPlatformInvitation/);
assert.match(invitationPage, /Choose a password|Create password/);
assert.match(app, /\/super-admin/);
assert.match(app, /PlatformInvitationAcceptancePage/);
assert.match(dashboard, /student_count/);
assert.match(dashboard, /active_accountants_30d/);
assert.match(dashboard, /storage_bytes_project_wide/);
assert.match(dashboard, /No institute — owner creates one/);
assert.match(dashboard, /student and guardian details, member email addresses, fees, payments, receipts and attendance content are not exposed/);

console.log("Platform Admin foundation source checks passed.");
