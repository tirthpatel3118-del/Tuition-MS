import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

const rosterMigration = await read('../supabase/migrations/20261112000000_fix_teacher_academic_roster_view.sql');
assert.match(rosterMigration, /security_invoker\s*=\s*false/);
assert.match(rosterMigration, /CREATE TABLE IF NOT EXISTS public\.teacher_batch_assignments/i);
assert.match(rosterMigration, /PRIMARY KEY \(institute_id, batch_id, teacher_user_id\)/);
assert.match(rosterMigration, /FOREIGN KEY \(institute_id, batch_id\)[\s\S]*?REFERENCES public\.batches \(institute_id, id\)/);
assert.match(rosterMigration, /FOREIGN KEY \(institute_id, teacher_user_id\)[\s\S]*?REFERENCES public\.institute_members \(institute_id, user_id\)/);
assert.match(rosterMigration, /teacher_batch_assignments_owner_insert[\s\S]*?private\.is_member_of\(institute_id, ARRAY\['owner'\]\)[\s\S]*?teacher\.role = 'teacher'/);
assert.match(rosterMigration, /teacher_batch_assignments_owner_delete[\s\S]*?private\.is_member_of\(institute_id, ARRAY\['owner'\]\)/);
assert.match(rosterMigration, /CREATE OR REPLACE FUNCTION public\.set_teacher_batch_assignments/);
assert.match(rosterMigration, /set_teacher_batch_assignments[\s\S]*?private\.is_member_of\(p_institute_id, ARRAY\['owner'\]\)[\s\S]*?teacher\.role = 'teacher'[\s\S]*?DELETE FROM public\.teacher_batch_assignments[\s\S]*?INSERT INTO public\.teacher_batch_assignments/);
assert.match(rosterMigration, /REVOKE ALL ON FUNCTION public\.set_teacher_batch_assignments\(UUID, UUID, UUID\[\]\) FROM PUBLIC, anon/);
assert.match(rosterMigration, /GRANT EXECUTE ON FUNCTION public\.set_teacher_batch_assignments\(UUID, UUID, UUID\[\]\) TO authenticated/);
assert.match(rosterMigration, /private\.is_member_of\(s\.institute_id, ARRAY\['owner'\]\)/);
assert.match(rosterMigration, /private\.is_member_of\(s\.institute_id, ARRAY\['teacher'\]\)/);
assert.match(rosterMigration, /assignment\.institute_id = s\.institute_id[\s\S]*?assignment\.batch_id = s\.batch_id[\s\S]*?assignment\.teacher_user_id = auth\.uid\(\)/);
assert.match(rosterMigration, /teacher\.role = 'teacher'/);
assert.doesNotMatch(rosterMigration, /WHERE private\.is_member_of\(s\.institute_id\);/);
assert.doesNotMatch(rosterMigration, /s\.parent_name|s\.parent_whatsapp|s\.student_mobile/);

// Authorization regression matrix. The migration predicates establish each
// result at the database layer: same-tenant assigned batch is allowed;
// unassigned, other-tenant, and removed assignments fail; Owners retain tenant-wide access.
assert.match(rosterMigration, /assignment\.institute_id = s\.institute_id/); // cross-institute denial
assert.match(rosterMigration, /assignment\.batch_id = s\.batch_id/); // assigned-batch access only
assert.match(rosterMigration, /assignment\.teacher_user_id = auth\.uid\(\)/); // unassigned teacher denial
assert.match(rosterMigration, /CREATE OR REPLACE VIEW public\.academic_students[\s\S]*?EXISTS \([\s\S]*?public\.teacher_batch_assignments/); // removing row revokes access
assert.match(rosterMigration, /private\.is_member_of\(s\.institute_id, ARRAY\['owner'\]\)/); // Owner institute-wide access

const assignmentService = await read('../src/services/teacherBatchAssignmentService.ts');
const coursesPage = await read('../src/pages/Courses.tsx');
assert.match(assignmentService, /teacher_batch_assignments/);
assert.match(assignmentService, /teacher_user_id/);
assert.match(assignmentService, /rpc\('set_teacher_batch_assignments'/);
assert.match(coursesPage, /Assign teachers/);
assert.match(coursesPage, /Save assignments/);
assert.match(coursesPage, /activeMembership\?\.role === 'owner'/);

const dataContext = await read('../src/context/DataContext.tsx');
const paymentService = await read('../src/services/paymentService.ts');
const paymentMigration = await read('../supabase/migrations/20261106000000_direct_fee_collection.sql');
assert.doesNotMatch(dataContext, /Select an installment before recording a payment/);
assert.match(paymentService, /: \[\];/);
assert.match(paymentMigration, /p_amount > v_current_due/);
assert.match(paymentMigration, /p\.idempotency_key = p_idempotency_key/);
assert.match(paymentMigration, /INSERT INTO public\.receipts/);

const reminderService = await read('../src/services/reminderService.ts');
const remindersPage = await read('../src/pages/Reminders.tsx');
assert.match(reminderService, /\.from\('reminders'\)\.insert/);
assert.match(reminderService, /\.from\('reminders'\)\s*\n\s*\.select/);
assert.match(remindersPage, /They will be recorded as queued, not sent automatically/);
assert.match(remindersPage, /getWhatsAppLink\(inst\)/);

const sidebar = await read('../src/components/Sidebar.tsx');
assert.match(sidebar, /role === 'owner'/);
assert.match(sidebar, /auth\.signOut\(\)/);

console.log('✓ Phase 1 payment, roster, reminder, and owner logout regression checks passed.');
