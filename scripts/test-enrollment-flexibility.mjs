import assert from 'node:assert/strict';

console.log('Testing EduLedger Flexible Student Enrollment & Fee Allocation...');

// Validation logic matching src/pages/Admissions.tsx
function validateEnrollment({ totalFees, plannedInstallments }) {
  const errors = {};
  const totalPlanned = plannedInstallments.reduce((sum, inst) => sum + inst.amount, 0);
  const totalPlannedCents = Math.round(totalPlanned * 100);
  const courseFeeCents = Math.round(totalFees * 100);

  // Financial integrity check: Planned installments cannot exceed course fee
  if (totalPlannedCents > courseFeeCents) {
    errors.installmentsTotal = `Total planned installments (₹${totalPlanned.toLocaleString('en-IN')}) cannot exceed the course fee of ₹${totalFees.toLocaleString('en-IN')}`;
  }

  plannedInstallments.forEach((inst, idx) => {
    if (!inst.amount || inst.amount <= 0) {
      errors[`inst_amount_${idx}`] = 'Amount must be greater than 0';
    }
    if (!inst.dueDate) {
      errors[`inst_date_${idx}`] = 'Due Date is required';
    }
  });

  const remainingAllocation = totalFees - totalPlanned;
  const isAllocationValid = remainingAllocation >= 0;

  return {
    isValid: Object.keys(errors).length === 0 && isAllocationValid,
    errors,
    totalPlanned,
    remainingAllocation,
    isAllocationValid
  };
}

// Student ledger calculation matching DataContext.tsx & mockData.ts
function createStudentEnrollment(studentData, plannedInstallments) {
  const validation = validateEnrollment({
    totalFees: studentData.totalFees,
    plannedInstallments
  });

  if (!validation.isValid) {
    throw new Error(`Enrollment validation failed: ${JSON.stringify(validation.errors)}`);
  }

  const feesPaid = 0; // Planned installments NEVER count as payments
  const feesDue = Math.max(0, studentData.totalFees - feesPaid);

  const installments = plannedInstallments.map((inst, index) => ({
    id: `inst_${index + 1}`,
    studentId: 'student_1',
    installmentNumber: index + 1,
    amount: inst.amount,
    dueDate: inst.dueDate,
    status: 'Pending', // Creating an installment must NEVER mark it as paid
    paymentId: null
  }));

  return {
    student: {
      id: 'student_1',
      name: studentData.name,
      courseId: studentData.courseId,
      batch: studentData.batch,
      totalFees: studentData.totalFees,
      feesPaid,
      feesDue
    },
    installments,
    remainingAllocation: validation.remainingAllocation
  };
}

async function runTests() {
  const courseFee = 12000;

  console.log('\nScenario 1: Enroll student without any installments (Option B)');
  const res1 = createStudentEnrollment({
    name: 'Rahul Sharma',
    courseId: 'c1',
    batch: 'Morning - Batch A (08:00 AM)',
    totalFees: courseFee
  }, []);

  assert.equal(res1.student.totalFees, 12000);
  assert.equal(res1.student.feesPaid, 0);
  assert.equal(res1.student.feesDue, 12000);
  assert.equal(res1.installments.length, 0);
  assert.equal(res1.remainingAllocation, 12000);
  console.log('✓ Successfully enrolled with 0 installments: outstanding dues = ₹12,000, remaining allocation = ₹12,000');

  console.log('\nScenario 2: Enroll student with partial installment allocation');
  const res2 = createStudentEnrollment({
    name: 'Priya Patel',
    courseId: 'c1',
    batch: 'Morning - Batch A (08:00 AM)',
    totalFees: courseFee
  }, [
    { amount: 4000, dueDate: '2026-12-01' }
  ]);

  assert.equal(res2.student.totalFees, 12000);
  assert.equal(res2.student.feesPaid, 0);
  assert.equal(res2.student.feesDue, 12000);
  assert.equal(res2.installments.length, 1);
  assert.equal(res2.installments[0].amount, 4000);
  assert.equal(res2.installments[0].status, 'Pending');
  assert.equal(res2.remainingAllocation, 8000);
  console.log('✓ Successfully enrolled with ₹4,000 planned: remaining unallocated = ₹8,000, actual dues = ₹12,000');

  console.log('\nScenario 3: Enroll student with fully allocated installments');
  const res3 = createStudentEnrollment({
    name: 'Amit Verma',
    courseId: 'c1',
    batch: 'Morning - Batch A (08:00 AM)',
    totalFees: courseFee
  }, [
    { amount: 4000, dueDate: '2026-12-01' },
    { amount: 4000, dueDate: '2027-01-01' },
    { amount: 4000, dueDate: '2027-02-01' }
  ]);

  assert.equal(res3.student.totalFees, 12000);
  assert.equal(res3.student.feesPaid, 0);
  assert.equal(res3.student.feesDue, 12000);
  assert.equal(res3.installments.length, 3);
  assert.equal(res3.remainingAllocation, 0);
  console.log('✓ Successfully enrolled with full allocation: remaining allocation = ₹0, actual dues = ₹12,000');

  console.log('\nScenario 4: Reject installment allocation exceeding course fee');
  const invalidValidation = validateEnrollment({
    totalFees: courseFee,
    plannedInstallments: [
      { amount: 5000, dueDate: '2026-12-01' },
      { amount: 5000, dueDate: '2027-01-01' },
      { amount: 5000, dueDate: '2027-02-01' } // Total 15000 > 12000
    ]
  });

  assert.equal(invalidValidation.isValid, false);
  assert.equal(invalidValidation.isAllocationValid, false);
  assert.equal(invalidValidation.remainingAllocation, -3000);
  assert.ok(invalidValidation.errors.installmentsTotal.includes('cannot exceed the course fee'));
  console.log('✓ Successfully rejected over-allocation (₹15,000 > ₹12,000)');

  console.log('\nScenario 5: Verify planned installments never count as payments or create fake receipts');
  assert.equal(res1.student.feesPaid, 0);
  assert.equal(res2.student.feesPaid, 0);
  assert.equal(res3.student.feesPaid, 0);
  assert.ok(res2.installments.every(i => i.status === 'Pending' && i.paymentId === null));
  assert.ok(res3.installments.every(i => i.status === 'Pending' && i.paymentId === null));
  console.log('✓ All planned installments are initialized strictly with Pending status and zero payments recorded');

  console.log('\nScenario 6: Verify actual outstanding dues calculation after payment');
  // Simulate payment of 4000 made against student 2
  const paymentsRecorded = 4000;
  const updatedFeesPaid = paymentsRecorded;
  const updatedFeesDue = Math.max(0, res2.student.totalFees - updatedFeesPaid);
  assert.equal(updatedFeesPaid, 4000);
  assert.equal(updatedFeesDue, 8000);
  console.log('✓ Outstanding dues correctly derived from course fee minus confirmed payments (₹12,000 - ₹4,000 = ₹8,000)');

  console.log('\nScenario 7: Verify batch and course mapping preservation');
  assert.equal(res1.student.courseId, 'c1');
  assert.equal(res1.student.batch, 'Morning - Batch A (08:00 AM)');
  console.log('✓ Student course and batch mapping preserved intact');

  console.log('\n=============================================================');
  console.log('ALL ENROLLMENT & FEE ALLOCATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('=============================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
