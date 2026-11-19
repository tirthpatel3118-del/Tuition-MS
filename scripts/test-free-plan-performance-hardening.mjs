import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20261118160000_free_plan_performance_hardening.sql', import.meta.url),
  'utf8',
);

const expectedIndexes = [
  'attendance_audit_logs (actor_id)',
  'attendance_correction_requests (decided_by)',
  'attendance_correction_requests (requested_by)',
  'attendance_records (marked_by)',
  'financial_audit_logs (actor_id)',
  'institute_invitations (invited_by)',
  'institute_members (user_id)',
  'payment_reversals (reverted_by)',
  'payments (created_by)',
  'payment_allocations (reversal_of_id)',
];

for (const index of expectedIndexes) {
  assert.ok(
    migration.includes(`ON public.${index.split(' (')[0]} (${index.split(' (')[1]}`),
    `missing foreign-key index: ${index}`,
  );
}

assert.equal((migration.match(/CREATE INDEX IF NOT EXISTS/g) ?? []).length, 10);
assert.equal((migration.match(/ALTER POLICY/g) ?? []).length, 3);
assert.equal((migration.match(/\(SELECT auth\.uid\(\)\)/g) ?? []).length, 3);
assert.match(migration, /attendance_correction_read[\s\S]*requested_by = \(SELECT auth\.uid\(\)\)/);
assert.match(migration, /attendance_correction_teacher_insert[\s\S]*decision = 'Pending'/);
assert.match(migration, /teacher_batch_assignments_member_select[\s\S]*teacher_user_id = \(SELECT auth\.uid\(\)\)/);
assert.match(migration, /BEGIN;[\s\S]*COMMIT;/);

console.log('PASS: free-plan FK indexes and RLS initplan optimization migration checks');
