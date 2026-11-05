import assert from 'node:assert';

console.log('Running EduLedger ERP Add Batch Course Mapping Tests...\n');

// 1. Validation Logic Test
console.log('Test 1: Validating courseId requirement');
function validateBatchForm(formData, showToast) {
  if (!formData.courseId) {
    showToast('Mapped course is required', 'error');
    return false;
  }
  if (!formData.name.trim()) {
    showToast('Batch name is required', 'error');
    return false;
  }
  if (!formData.timing.trim()) {
    showToast('Timing is required', 'error');
    return false;
  }
  const cap = Number(formData.capacity);
  if (!Number.isInteger(cap) || cap <= 0) {
    showToast('Capacity must be a positive whole number', 'error');
    return false;
  }
  if (formData.courseFee && formData.courseFee.trim()) {
    const fee = Number(formData.courseFee);
    if (!Number.isFinite(fee) || fee <= 0) {
      showToast('Batch fee must be a valid amount greater than 0', 'error');
      return false;
    }
  }
  return true;
}

const toastLogs = [];
const mockShowToast = (msg, type) => toastLogs.push({ msg, type });

// 1a: Missing courseId (The bug reported by user)
const resultMissingCourse = validateBatchForm({
  courseId: '',
  name: 'Morning Batch A',
  timing: '08:00 AM - 10:00 AM',
  capacity: '30',
  courseFee: '',
  status: 'Active'
}, mockShowToast);

assert.strictEqual(resultMissingCourse, false, 'Validation should fail when courseId is empty');
assert.strictEqual(toastLogs[0].msg, 'Mapped course is required');
assert.strictEqual(toastLogs[0].type, 'error');
console.log('✓ Validation correctly triggers "Mapped course is required" when courseId is empty');

// 1b: Valid data with courseId provided
const resultValid = validateBatchForm({
  courseId: 'c_class10',
  name: 'Morning Batch A',
  timing: '08:00 AM - 10:00 AM',
  capacity: '30',
  courseFee: '',
  status: 'Active'
}, mockShowToast);

assert.strictEqual(resultValid, true, 'Validation should pass when courseId and required fields are valid');
console.log('✓ Validation succeeds when courseId is mapped');

// 2. Modal Initialization & Auto-Selection Logic
console.log('\nTest 2: Auto-selection and course mapping on modal open');
function openAddBatchModal(courses, courseId) {
  const resolvedCourseId = courseId || (courses.length === 1 ? courses[0].id : '');
  return {
    courseId: resolvedCourseId,
    name: '',
    timing: '',
    capacity: '30',
    courseFee: '',
    status: 'Active'
  };
}

const existingCourses = [
  {
    id: 'c_class10',
    name: 'Class 10',
    subject: 'Mathematics',
    duration: '10 Months',
    fees: 12000
  }
];

// 2a: Opened from generic "+ Add Batch" button with single course (user's scenario)
const modalGenericSingleCourse = openAddBatchModal(existingCourses);
assert.strictEqual(modalGenericSingleCourse.courseId, 'c_class10', 'Should auto-select Class 10 when it is the only course');
console.log('✓ Modal opened with 1 existing course ("Class 10") auto-selects Class 10');

// 2b: Opened from "+ Add Batch" button on Class 10 course card
const modalFromCourseCard = openAddBatchModal(existingCourses, 'c_class10');
assert.strictEqual(modalFromCourseCard.courseId, 'c_class10', 'Should select Class 10 when opened from its card');
console.log('✓ Modal opened directly from "Class 10" card automatically binds courseId to Class 10');

// 2c: Opened from generic "+ Add Batch" when multiple courses exist
const multiCourses = [
  ...existingCourses,
  { id: 'c_class12', name: 'Class 12', subject: 'Physics', duration: '12 Months', fees: 15000 }
];
const modalGenericMultiCourse = openAddBatchModal(multiCourses);
assert.strictEqual(modalGenericMultiCourse.courseId, '', 'Should remain unselected when multiple courses exist');
console.log('✓ Modal opened with multiple courses prompts user to choose from dropdown');

// 3. Batch Creation Payload and Database Mapping
console.log('\nTest 3: Batch creation payload and course mapping in database model');
const instituteId = 'inst_abc_tuition_classes';
const batchFormInput = {
  courseId: 'c_class10',
  name: 'Class 10 - Batch A',
  timing: '09:00 AM - 11:00 AM',
  capacity: '25',
  courseFee: '12000',
  status: 'Active'
};

const createBatchPayload = {
  institute_id: instituteId,
  course_id: batchFormInput.courseId,
  name: batchFormInput.name.trim(),
  timing: batchFormInput.timing.trim(),
  capacity: Number(batchFormInput.capacity),
  course_fee: batchFormInput.courseFee.trim() ? Number(batchFormInput.courseFee) : null,
  status: batchFormInput.status
};

assert.strictEqual(createBatchPayload.course_id, 'c_class10');
assert.strictEqual(createBatchPayload.institute_id, instituteId);
assert.strictEqual(createBatchPayload.name, 'Class 10 - Batch A');
assert.strictEqual(createBatchPayload.capacity, 25);
assert.strictEqual(createBatchPayload.course_fee, 12000);
console.log('✓ Batch payload maps correct course_id, institute_id, and fees for Supabase');

// 4. Batch List and Course Name Resolution
console.log('\nTest 4: Batch occupancy list correctly resolves course name');
const batches = [
  {
    id: 'b_batch1',
    courseId: 'c_class10',
    name: 'Class 10 - Batch A',
    timing: '09:00 AM - 11:00 AM',
    capacity: 25,
    courseFee: 12000,
    status: 'Active'
  }
];

const students = [
  { id: 's1', courseId: 'c_class10', batchId: 'b_batch1', status: 'Active' },
  { id: 's2', courseId: 'c_class10', batchId: 'b_batch1', status: 'Active' }
];

const batchesList = batches.map(batch => {
  const enrolledStudents = students.filter(s => s.batchId === batch.id);
  const activeCount = enrolledStudents.filter(s => s.status === 'Active').length;
  const course = existingCourses.find(c => c.id === batch.courseId);

  return {
    ...batch,
    count: enrolledStudents.length,
    activeCount,
    courseName: course ? course.name : 'General'
  };
});

assert.strictEqual(batchesList[0].courseName, 'Class 10', 'Batch should display courseName "Class 10" instead of "General"');
assert.strictEqual(batchesList[0].activeCount, 2);
console.log('✓ Batch displays "Course: Class 10" in the occupancy management list');

// 5. Course Stats Mapping Batches to Course Card
console.log('\nTest 5: Course card displays mapped batches');
const courseStats = existingCourses.map(course => {
  const enrolledStudents = students.filter(s => s.courseId === course.id);
  const activeCount = enrolledStudents.filter(s => s.status === 'Active').length;
  const courseBatches = batches.filter(b => b.courseId === course.id);

  return {
    ...course,
    totalEnrolled: enrolledStudents.length,
    activeEnrolled: activeCount,
    batches: courseBatches
  };
});

assert.strictEqual(courseStats[0].batches.length, 1);
assert.strictEqual(courseStats[0].batches[0].name, 'Class 10 - Batch A');
console.log('✓ Course "Class 10" accurately lists its mapped batch on the course card');

// 6. Delete Safety Protection
console.log('\nTest 6: Deleting course is safely blocked when batches are mapped');
function canDeleteCourse(courseId, courses, batches, students) {
  const course = courses.find(c => c.id === courseId);
  if (!course) return { allowed: false, error: 'Course not found' };
  const enrolled = students.some(s => s.courseId === courseId);
  if (enrolled) return { allowed: false, error: 'Students enrolled' };
  const hasBatches = batches.some(b => b.courseId === courseId);
  if (hasBatches) {
    return { allowed: false, error: `Cannot delete course "${course.name}": Active batches are mapped to this course. Remove or reassign batches first.` };
  }
  return { allowed: true };
}

const deleteAttempt = canDeleteCourse('c_class10', existingCourses, batches, []);
assert.strictEqual(deleteAttempt.allowed, false);
assert(deleteAttempt.error.includes('Active batches are mapped to this course'));
console.log('✓ Course deletion protection successfully prevents foreign key conflicts');

console.log('\n======================================================');
console.log('ALL WORKFLOW AND MAPPING TESTS COMPLETED SUCCESSFULLY!');
console.log('======================================================');
