import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const dataContext = read('../src/context/DataContext.tsx');
const attendance = read('../src/pages/Attendance.tsx');
const teacherWorkspace = read('../src/pages/TeacherWorkspace.tsx');
const teamSettings = read('../src/components/TeamSettings.tsx');
const invitationPage = read('../src/pages/InvitationAcceptancePage.tsx');
const paymentMigration = read('../supabase/migrations/20261118000000_payment_retry_and_reversal_guards.sql');
const attendanceMigration = read('../supabase/migrations/20261114000000_attendance_v1_1.sql');

// Payment retry identity must include all fields used by the SQL fingerprint,
// and survive a closed tab while a request's outcome is uncertain.
assert.match(dataContext, /const requestKey = JSON\.stringify\(/);
for (const field of ['paymentData.studentId', 'paymentData.paymentMethod', 'paymentDate', 'paymentRemarks', 'installmentId']) {
  assert.ok(dataContext.includes(field), `payment retry key must include ${field}`);
}
assert.match(dataContext, /localStorage\.getItem\(storageKey\)/);
assert.match(dataContext, /localStorage\.setItem\(storageKey, idempotencyKey\)/);
assert.match(dataContext, /localStorage\.removeItem\(storageKey\)/);
assert.doesNotMatch(dataContext, /sessionStorage\.(getItem|setItem|removeItem)\(storageKey\)/);

// Multi-batch roster rows are keyed by student + batch in both responsive layouts.
assert.match(teacherWorkspace, /key=\{\x60\$\{student\.batch_id \?\? "unassigned"\}:\$\{student\.id\}\x60\}/);
assert.equal((teacherWorkspace.match(/key=\{\x60\$\{student\.batch_id/g) ?? []).length, 2);
assert.match(attendance, /groups\.get\(student\.batch_id\)/);
assert.match(attendance, /\$\{batch\.id\}:\$\{student\.id\}/);
assert.match(attendanceMigration, /JOIN public\.student_batches sb/);
assert.match(attendanceMigration, /UNION ALL/);

// New invitation URLs use fragments. The acceptance page accepts legacy query
// links for compatibility, but scrubs token-bearing URL data immediately.
assert.match(teamSettings, /accept-invitation#token=/);
assert.match(invitationPage, /fragmentParams\.get\('token'\)/);
assert.match(invitationPage, /url\.searchParams\.get\('token'\)/);
assert.match(invitationPage, /window\.history\.replaceState/);
assert.match(invitationPage, /url\.searchParams\.delete\('token'\)/);

// Idempotent retries return the existing payment before mutable student checks;
// reversal RPC accepts only original PAYMENT ledger rows.
const existingLookup = paymentMigration.indexOf('SELECT p.id, r.receipt_number, p.idempotency_fingerprint');
const inactiveGuard = paymentMigration.indexOf("IF v_student_status = 'Inactive'");
const existingReturn = paymentMigration.indexOf("'status', 'EXISTING'");
assert.ok(existingLookup >= 0 && existingReturn > existingLookup && inactiveGuard > existingReturn,
  'existing payment lookup/return must precede inactive-student validation');
assert.match(paymentMigration, /payment_type IS DISTINCT FROM 'PAYMENT'/);
assert.match(paymentMigration, /GRANT EXECUTE ON FUNCTION public\.void_payment_atomic\(UUID, UUID, TEXT\) TO authenticated/);

console.log('PASS: payment retry, multi-batch attendance, invitation-token, and reversal regression checks');
