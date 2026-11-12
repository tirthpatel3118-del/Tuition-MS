import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

const rosterMigration = await read('../supabase/migrations/20261112000000_fix_teacher_academic_roster_view.sql');
assert.match(rosterMigration, /security_invoker\s*=\s*false/);
assert.match(rosterMigration, /WHERE private\.is_member_of\(s\.institute_id\)/);
assert.doesNotMatch(rosterMigration, /s\.parent_name|s\.parent_whatsapp|s\.student_mobile/);

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
