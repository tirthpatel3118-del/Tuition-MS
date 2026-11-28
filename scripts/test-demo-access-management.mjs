import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../supabase/migrations/20261128165000_classbandhu_demo_access_management.sql');
const auditMigration = read('../supabase/migrations/20261128170500_classbandhu_demo_activity_history.sql');
const accessFn = read('../supabase/functions/demo-access/index.ts');
const intakeFn = read('../supabase/functions/website-intake/index.ts');
const supabase = read('../src/lib/supabase.ts');
const app = read('../src/App.tsx');
const client = read('../src/services/demoAccessClient.ts');
const guard = read('../src/components/DemoSessionGuard.tsx');
const adminService = read('../src/services/websiteAdminService.ts');
const adminPanel = read('../src/components/WebsiteManagementPanel.tsx');
const requestPage = read('../src/pages/RequestDemoPage.tsx');

assert.ok(migration.includes('private.website_demo_access'));
assert.ok(migration.includes('token_hash text NOT NULL UNIQUE'));
assert.ok(migration.includes('session_hash text UNIQUE'));
assert.ok(migration.includes("v_link_expiry := now() + interval '48 hours'"));
assert.ok(migration.includes('duration_minutes,created_by'));
assert.ok(migration.includes("make_interval(mins=>v_access.duration_minutes)"));
assert.ok(migration.includes("session_expires_at=session_expires_at + interval '10 minutes'"));
assert.ok(migration.includes('extended_at IS NULL'));
assert.ok(migration.includes('revoked_at'));
assert.ok(migration.includes("consume_website_demo_rate_limit('activate'"));
assert.ok(migration.includes("consume_website_demo_rate_limit('validate'"));
assert.ok(migration.includes('PERFORM private.require_platform_admin()'));
assert.ok(migration.includes('ALTER TABLE private.website_demo_access ENABLE ROW LEVEL SECURITY'));
assert.ok(migration.includes('REVOKE ALL ON private.website_demo_access FROM PUBLIC, anon, authenticated'));
assert.ok(migration.includes('REVOKE ALL ON FUNCTION public.website_demo_activate(text,text) FROM PUBLIC, anon, authenticated'));
assert.ok(auditMigration.includes('platform_admin_demo_list_activity'));

assert.ok(accessFn.includes('allowedOrigin'));
assert.ok(accessFn.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(accessFn.includes('website_demo_activate'));
assert.ok(accessFn.includes('website_demo_validate'));
assert.ok(accessFn.includes('Cache-Control'));
assert.ok(!accessFn.includes('console.log'));

assert.ok(intakeFn.includes('body.type === "demo_request"'));
assert.ok(intakeFn.includes('website_submit_demo_request'));
assert.ok(intakeFn.includes('p_student_count'));
assert.ok(supabase.includes("export const isDemoMode = storedDemoSession"));
assert.ok(supabase.includes("isDemoMode ? 'http://127.0.0.1:54321'"));
assert.ok(!supabase.includes("get('demo') === '1'"));
assert.ok(app.includes("location.pathname === '/demo-access'"));
assert.ok(app.includes("location.pathname === '/demo-expired'"));
assert.ok(app.includes('<DemoSessionGuard>'));
assert.ok(!requestPage.includes('href="/?demo=1"'));

assert.ok(client.includes('/functions/v1/demo-access'));
assert.ok(client.includes("action: 'activate'"));
assert.ok(client.includes("action: 'validate'"));
assert.ok(client.includes("localStorage.setItem(SESSION_KEY"));
assert.ok(guard.includes('validateDemoSession'));
assert.ok(guard.includes('window.setInterval(tick, 1000)'));
assert.ok(guard.includes('window.setInterval(() => { void verify(); }, 25_000)'));
assert.ok(adminService.includes('platform_admin_demo_issue_access'));
assert.ok(adminService.includes('platform_admin_demo_extend'));
assert.ok(adminService.includes('platform_admin_demo_revoke'));
assert.ok(adminService.includes('platform_admin_demo_list_activity'));
assert.ok(adminPanel.includes('Generate / reissue link'));
assert.ok(adminPanel.includes('Open Gmail draft'));
assert.ok(adminPanel.includes('Activity history'));
assert.ok(adminPanel.includes('Revoke access'));

console.log('ClassBandhu demo access management regression checks passed.');
