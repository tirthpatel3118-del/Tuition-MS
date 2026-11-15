import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationPath = '../supabase/migrations/20261114000000_attendance_v1_1.sql';
const sql = readFileSync(new URL(migrationPath, import.meta.url), 'utf8');
const normalized = sql.replace(/\s+/g, ' ').toLowerCase();
const legacyTrigger = normalized.match(/create or replace function private\.sync_legacy_student_batch_membership\(\)([\s\S]*?)\$\$;/)?.[1];
const tenantAccess = normalized.split('create or replace function private.can_access_attendance_batch')[1]?.split('$$;')[0];
assert.ok(legacyTrigger, 'legacy compatibility trigger function exists');

// Existing assignments are copied without deleting or rewriting source rows.
assert.match(normalized, /insert into public\.student_batches \(institute_id, student_id, batch_id\) select s\.institute_id, s\.id, s\.batch_id from public\.students as s where s\.batch_id is not null/);
assert.match(normalized, /foreign key \(institute_id, student_id\)[\s\S]*?references public\.students \(institute_id, id\)/);
assert.match(normalized, /foreign key \(institute_id, batch_id\)[\s\S]*?references public\.batches \(institute_id, id\)/);
assert.doesNotMatch(normalized, /alter table public\.students drop column[^;]*batch_id/);

// Legacy scalar writes add memberships; NULL does not erase memberships.
assert.match(legacyTrigger, /if new\.batch_id is not null then insert into public\.student_batches/);
assert.doesNotMatch(legacyTrigger, /delete from public\.student_batches/);
assert.match(legacyTrigger, /if new\.batch_id is not null then[\s\S]*?else[\s\S]*?update public\.students as s set batch_id/);
assert.match(legacyTrigger, /select sb\.batch_id from public\.student_batches as sb where sb\.institute_id = new\.institute_id/);
assert.match(normalized, /compatibility rule for older clients[\s\S]*?null never deletes membership/);

// Membership writes update only the scalar default, use a deterministic fallback,
// and nested trigger invocations stop instead of recursing.
assert.match(legacyTrigger, /if pg_trigger_depth\(\) > 1 then/);
assert.match(normalized, /after insert or update of batch_id on public\.students/);
assert.match(normalized, /after insert or delete on public\.student_batches/);
assert.match(legacyTrigger, /and batch_id is null/);
assert.match(legacyTrigger, /order by sb\.enrolled_at, sb\.batch_id limit 1/);
assert.match(legacyTrigger, /tg_op = 'delete'/);

// Attendance remains tenant-scoped, assigned-teacher scoped and reason-audited.
assert.match(normalized, /status in \('present', 'absent', 'late', 'leave'\)/);
assert.match(normalized, /private\.can_access_attendance_batch/);const correctionReadPolicy = normalized.match(/create policy attendance_correction_read[\s\S]*?using \((.*?)\);/);
assert.ok(correctionReadPolicy, 'correction request read policy exists');
assert.match(correctionReadPolicy[1], /private\.is_member_of\(institute_id, array\['owner'\]\)/);
assert.match(correctionReadPolicy[1], /requested_by = auth\.uid\(\) and private\.is_member_of\(institute_id, array\['teacher'\]\)/);
assert.ok(tenantAccess, 'tenant access helper exists');
assert.match(tenantAccess, /a\.institute_id = p_institute_id/);
assert.match(tenantAccess, /a\.batch_id = p_batch_id/);
assert.match(tenantAccess, /a\.teacher_user_id = auth\.uid\(\)/);
assert.match(tenantAccess, /m\.role = 'teacher'/);
assert.match(normalized, /function public\.mark_attendance/);
assert.match(normalized, /function public\.decide_attendance_correction/);
assert.match(normalized, /function public\.owner_edit_attendance/);
assert.match(normalized, /char_length\(trim\(coalesce\(p_reason, ''\)\)\) < 5/);
assert.match(normalized, /create table public\.attendance_audit_logs/);
assert.match(normalized, /security_barrier = true, security_invoker = true/);
assert.match(normalized, /revoke all on public\.academic_students from public, anon, authenticated; grant select on public\.academic_students to authenticated/);

// The filename timestamp feeds Supabase's managed ledger. The application-owned
// tracker is a separate sequence (8 -> 9); never write the managed ledger in SQL.
const priorMigration = readFileSync(new URL('../supabase/migrations/20261104100000_atomic_pending_installment_reconciliation.sql', import.meta.url), 'utf8').toLowerCase();
assert.match(priorMigration, /values \('20261104000008'/);
assert.match(normalized, /values \('20261104000009', 'eduledger v1\.1 tenant-scoped attendance and student-batch memberships'\)/);
assert.doesNotMatch(normalized, /insert into supabase_migrations\.schema_migrations/);

console.log('Attendance migration regression checks passed.');
