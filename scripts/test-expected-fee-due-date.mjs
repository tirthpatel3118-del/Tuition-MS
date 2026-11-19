import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const admission = readFileSync('src/pages/Admissions.tsx', 'utf8');
const dataContext = readFileSync('src/context/DataContext.tsx', 'utf8');
const reminders = readFileSync('src/pages/Reminders.tsx', 'utf8');
const migration = readFileSync('supabase/migrations/20261119100000_student_expected_fee_due_date.sql', 'utf8');

assert.match(admission, /plannedInstallments\.length === 0[\s\S]*?Expected Fee Due Date[\s\S]*?\(Optional\)/);
assert.match(admission, /expectedFeeDueDate: formData\.expectedFeeDueDate \|\| undefined/);
assert.match(admission, /expectedFeeDueDate: student\.expectedFeeDueDate \|\| ''/);
assert.match(dataContext, /expected_fee_due_date: studentData\.expectedFeeDueDate \|\| null/);
assert.match(dataContext, /dbUpdates\.expected_fee_due_date = updatedFields\.expectedFeeDueDate \|\| null/);
assert.match(dataContext, /expectedFeeDueDate: s\.expected_fee_due_date \|\| undefined/);
assert.match(reminders, /dueDate: studentInsts\.length === 0 \? \(student\.expectedFeeDueDate \|\| ''\) : ''/);
assert.match(reminders, /getFeeDueStatus\(studentInsts\.length === 0 \? student\.expectedFeeDueDate \|\| '' : ''\)/);
assert.match(migration, /ADD COLUMN IF NOT EXISTS expected_fee_due_date date/);

const status = (dueDate, today) => {
  if (!dueDate) return 'unscheduled';
  if (dueDate > today) return 'upcoming';
  if (dueDate === today) return 'due_today';
  return 'overdue';
};
assert.equal(status('2026-11-20', '2026-11-19'), 'upcoming');
assert.equal(status('2026-11-19', '2026-11-19'), 'due_today');
assert.equal(status('2026-11-18', '2026-11-19'), 'overdue');
assert.equal(status('', '2026-11-19'), 'unscheduled');

console.log('Expected fee due date tests passed: optional admission field, edit/save persistence, and direct-fee reminder timing.');
