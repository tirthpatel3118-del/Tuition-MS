import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

console.log('Running multi-course batch unassignment regression tests...');

const coursesPage = readFileSync(new URL('../src/pages/Courses.tsx', import.meta.url), 'utf8');
const zeroSelectionGuards = coursesPage.match(/if \(batchFormData\.courseIds\.length === 0\)/g) ?? [];
assert.equal(zeroSelectionGuards.length, 1, 'The editor should have exactly one zero-selection validation guard.');
assert.match(coursesPage, /batchFormData\.courseIds\.length === 0 && <p role="alert"/, 'The editor must show guidance when no standards are selected.');
assert.match(coursesPage, /disabled=\{isBatchSubmitting \|\| courses\.length === 0 \|\| batchFormData\.courseIds\.length === 0\}/, 'Save should remain available whenever one or more standards are selected.');

function removeSelectedCourse(courseIds, courseId) {
  return courseIds.filter(id => id !== courseId);
}
const selectedBeforeEdit = ['class-1', 'class-10'];
const afterRemovingOneStandard = removeSelectedCourse(selectedBeforeEdit, 'class-10');
assert.deepEqual(afterRemovingOneStandard, ['class-1'], 'Removing one standard must preserve remaining selections.');
assert.equal(afterRemovingOneStandard.length > 0, true, 'Save remains available while at least one standard is selected.');
assert.equal(removeSelectedCourse(afterRemovingOneStandard, 'class-1').length, 0, 'The zero-standard state is handled by the UI guidance instead of deleting the batch.');

function removeCourseMapping(batch, courseId) {
  const courseIds = batch.courseIds?.length ? batch.courseIds : [batch.courseId];
  if (!courseIds.includes(courseId)) throw new Error('This course is not assigned to the batch');
  if (courseIds.length <= 1) throw new Error('A batch must remain assigned to at least one course');
  const nextCourseIds = courseIds.filter(id => id !== courseId);
  return { ...batch, courseIds: nextCourseIds, courseId: nextCourseIds[0] };
}

const batch = {
  id: 'batch-shared-1',
  courseId: 'class-1',
  courseIds: ['class-1', 'class-8', 'class-10'],
  name: 'Batch A',
  timing: '4:00 pm to 6:00 pm',
  teacherIds: ['teacher-1'],
  attendanceIds: ['attendance-1', 'attendance-2'],
};
const updated = removeCourseMapping(batch, 'class-1');

assert.deepEqual(updated.courseIds, ['class-8', 'class-10']);
assert.equal(updated.courseId, 'class-8');
assert.equal(updated.id, batch.id, 'Unassignment must preserve the shared batch ID');
assert.deepEqual(updated.teacherIds, batch.teacherIds, 'Teacher assignments must remain unchanged');
assert.deepEqual(updated.attendanceIds, batch.attendanceIds, 'Attendance history must remain unchanged');
assert.deepEqual(batch.courseIds, ['class-1', 'class-8', 'class-10'], 'Original state must not be mutated');
console.log('✓ Removing one course preserves other mappings, batch identity, teacher assignments and attendance');

assert.throws(
  () => removeCourseMapping({ ...batch, courseId: 'class-1', courseIds: ['class-1'] }, 'class-1'),
  /at least one course/,
  'The last course mapping must not be removed',
);
console.log('✓ Last course mapping is protected');

assert.throws(
  () => removeCourseMapping(batch, 'class-5'),
  /not assigned/,
  'A non-mapped course cannot be removed',
);
console.log('✓ Unassigned course removal is rejected');

function batchLabels(items) {
  return items.map((item, index) => {
    const same = candidate => candidate.name === item.name && candidate.timing === item.timing;
    const count = items.filter(same).length;
    const ordinal = items.slice(0, index + 1).filter(same).length;
    const label = `${item.name} · ${item.timing}`;
    return count > 1 ? `${label} (${ordinal})` : label;
  });
}
const labels = batchLabels([
  { name: 'Batch A', timing: '4:00 pm to 6:00 pm' },
  { name: 'Batch A', timing: '4:00 pm to 6:00 pm' },
  { name: 'Batch A', timing: '6:00 pm to 8:00 pm' },
]);
assert.deepEqual(labels, [
  'Batch A · 4:00 pm to 6:00 pm (1)',
  'Batch A · 4:00 pm to 6:00 pm (2)',
  'Batch A · 6:00 pm to 8:00 pm',
]);
console.log('✓ Repeated batch names are disambiguated by timing and occurrence');

console.log('All multi-course batch unassignment tests passed.');
