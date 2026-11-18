import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20261118190000_platform_subscription_billing.sql");
const service = read("../src/services/platformBillingService.ts");
const dashboard = read("../src/pages/SuperAdminDashboard.tsx");
const setup = read("../supabase/PLATFORM_ADMIN_SETUP.md");

assert.ok(migration.startsWith("-- Manual monthly/yearly"), "billing migration should be clearly documented");
assert.ok(migration.includes("BEGIN;") && migration.trimEnd().endsWith("COMMIT;"), "migration must be transactional");
assert.ok(migration.includes("private.platform_billing_invoices"), "invoice ledger must use private schema");
assert.ok(migration.includes("private.platform_billing_payments"), "payment ledger must use private schema");
assert.ok(migration.includes("ENABLE ROW LEVEL SECURITY"), "billing tables must enable RLS");
assert.ok(migration.includes("REVOKE ALL ON private.platform_billing_invoices FROM PUBLIC, anon, authenticated"));
assert.ok(migration.includes("REVOKE ALL ON private.platform_billing_payments FROM PUBLIC, anon, authenticated"));
assert.ok(migration.includes("private.require_platform_admin()"), "billing RPCs must enforce platform-admin authorization");
assert.ok(migration.includes("billing_cycle IN ('monthly','yearly')"), "monthly and yearly billing must be supported");
assert.ok(migration.includes("uq_platform_billing_active_period"), "duplicate active billing periods must be blocked");
assert.ok(migration.includes("uq_platform_billing_transaction_reference"), "duplicate payment references must be blocked");
assert.ok(migration.includes("EDU-INV-") && migration.includes("EDU-RCP-"), "invoice and receipt numbers must be generated");
assert.ok(migration.includes("Only an unpaid invoice can be marked as paid."), "paid invoices cannot be paid twice");
assert.ok(migration.includes("Only an unpaid invoice can be voided."), "paid invoices cannot be voided");
assert.ok(migration.includes("SUBSCRIPTION_PAYMENT_RECORDED"), "payments must be audited");
assert.ok(!/DELETE FROM private\.platform_billing_(invoices|payments)/i.test(migration), "migration must not delete billing history");

for (const rpc of ["platform_admin_billing_overview","platform_admin_list_billing","platform_admin_create_billing_invoice","platform_admin_record_billing_payment","platform_admin_void_billing_invoice"]) {
  assert.ok(service.includes(rpc), "service must call " + rpc);
}
assert.ok(!service.toLowerCase().includes("service_role"), "service-role key must not ship to browser");
assert.ok(dashboard.includes("Subscription billing"));
assert.ok(dashboard.includes("Create invoice"));
assert.ok(dashboard.includes("Record payment"));
assert.ok(dashboard.includes("Print / Save PDF"));
assert.ok(dashboard.includes("payment is received"));
assert.ok(dashboard.includes("billingOverview.overdue_amount"));
assert.ok(setup.includes("Platform subscription billing"));
assert.ok(setup.includes("not GST tax invoices"));

console.log("Platform subscription billing source checks passed.");
