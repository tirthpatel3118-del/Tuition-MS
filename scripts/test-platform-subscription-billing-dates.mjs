import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/utils/platformBillingDates.ts", import.meta.url), "utf8");
const js = ts.transpile(source, { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 });
const helpers = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const monthly = helpers.calculateSubscriptionDates("2026-11-18", "monthly");
assert.deepEqual(monthly, { periodStart: "2026-11-18", periodEnd: "2026-12-17", dueAt: "2026-11-18" });
const yearly = helpers.calculateSubscriptionDates("2026-11-18", "yearly");
assert.deepEqual(yearly, { periodStart: "2026-11-18", periodEnd: "2027-11-17", dueAt: "2026-11-18" });
assert.equal(helpers.calculateSubscriptionDates("2026-01-31", "monthly").periodEnd, "2026-02-27");
assert.equal(helpers.calculateSubscriptionDates("2024-02-29", "yearly").periodEnd, "2025-02-27");
assert.equal(helpers.classifyBillingDueDate("2026-11-18", "2026-11-18"), "due_today");
assert.equal(helpers.classifyBillingDueDate("2026-11-19", "2026-11-18"), "upcoming");
assert.equal(helpers.classifyBillingDueDate("2026-11-17", "2026-11-18"), "overdue");
assert.equal(helpers.daysOverdue("2026-11-17", "2026-11-18"), 1);
assert.equal(helpers.daysOverdue("2026-11-18", "2026-11-18"), 0);
assert.equal(helpers.toWhatsAppPhone("98765 43210"), "919876543210");
assert.equal(helpers.toWhatsAppPhone("+1 (415) 555-0134"), "14155550134");
assert.equal(helpers.toWhatsAppPhone("123"), null);
const reminder = helpers.buildSubscriptionReminderMessage({
  instituteName: "Sample Tuition", invoiceNumber: "EDU-INV-2026-000001", billingCycle: "monthly",
  periodStart: "2026-11-18", periodEnd: "2026-12-17", dueAt: "2026-11-18", amountInr: 999,
});
assert.match(reminder, /due today/i);
assert.match(helpers.buildSubscriptionReminderMessage({
  instituteName: "Sample", invoiceNumber: "INV", billingCycle: "yearly",
  periodStart: "2026-11-18", periodEnd: "2027-11-17", dueAt: "2026-11-17", amountInr: 999, overdueDays: 1,
}), /overdue by 1 day/i);

const dashboard = readFileSync(new URL("../src/pages/SuperAdminDashboard.tsx", import.meta.url), "utf8");
const service = readFileSync(new URL("../src/services/platformBillingService.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261118192000_platform_billing_whatsapp_reminders.sql", import.meta.url), "utf8");
assert.ok(dashboard.includes("Due today") && dashboard.includes("Upcoming") && dashboard.includes("Overdue"));
assert.ok(dashboard.includes("window.open(\"https://wa.me/\""), "WhatsApp must open as a user-initiated manual action");
assert.ok(dashboard.includes("updateBillingStart") && dashboard.includes("updateBillingCycle"));
assert.ok(dashboard.includes("billingContactPhone"));
assert.ok(service.includes("p_billing_contact_phone"));
assert.ok(service.includes("platform_admin_update_billing_contact"));
assert.ok(dashboard.includes("Add WhatsApp number"));
assert.ok(migration.includes("billing_contact_phone text"));
assert.ok(migration.includes("private.require_platform_admin()"));
console.log("Platform subscription billing date and WhatsApp reminder tests passed.");
