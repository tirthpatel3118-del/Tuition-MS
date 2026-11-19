import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const report = readFileSync(new URL('../src/components/MonthlyAttendanceReport.tsx', import.meta.url), 'utf8');
const admissions = readFileSync(new URL('../src/pages/Admissions.tsx', import.meta.url), 'utf8');
const attendance = readFileSync(new URL('../src/pages/Attendance.tsx', import.meta.url), 'utf8');

// The report must read the real attendance table, scoped to the active tenant,
// selected student, and the inclusive first/last dates of the chosen month.
assert.match(report, /supabase\s*\.from\('attendance_records'\)/);
assert.match(report, /\.eq\('institute_id',\s*instituteId\)/);
assert.match(report, /\.eq\('student_id',\s*studentId\)/);
assert.match(report, /\.gte\('attendance_date',\s*range\.start\)/);
assert.match(report, /\.lte\('attendance_date',\s*range\.end\)/);
assert.match(report, /\.order\('attendance_date'/);
assert.match(report, /\.order\('marked_at'/);

// All four database statuses must contribute to totals. Late is attended,
// Leave is excluded from the denominator, and unrecorded dates aren't absences.
for (const status of ['Present', 'Absent', 'Late', 'Leave']) {
  assert.match(report, new RegExp(status));
}
assert.match(report, /counts\.Present\s*\+\s*counts\.Absent\s*\+\s*counts\.Late/);
assert.match(report, /counts\.Present\s*\+\s*counts\.Late/);
assert.match(report, /Not marked \/ holiday/);

// Admissions owns the report entry point. It is owner-gated and receives the
// exact selected student's identity and active institute context.
assert.match(admissions, /activeMembership\?\.role === 'owner'/);
assert.match(admissions, /<MonthlyAttendanceReport/);
assert.match(admissions, /instituteId=\{activeMembership\.instituteId\}/);
assert.match(admissions, /studentId=\{selectedStudent\.id\}/);
assert.match(admissions, /studentName=\{selectedStudent\.name\}/);
assert.match(admissions, /onClick=\{\(\) => setIsAttendanceReportOpen\(true\)\}/);

// Attendance is kept focused on attendance operations, not student reports.
assert.doesNotMatch(attendance, /MonthlyAttendanceReport/);

// Printing must be an actual browser print action with A4 print rules.
assert.match(report, /window\.print\(\)/);
assert.match(report, /@page\s*\{\s*size:\s*A4 portrait/);

console.log('Attendance report integration checks passed.');
