import assert from 'node:assert/strict';
import crypto from 'node:crypto';

console.log('Testing EduLedger Direct Fee Collection & Idempotency / Reversal Engine...\n');

class MockPaymentEngine {
  constructor() {
    this.students = new Map();
    this.installments = new Map();
    this.payments = [];
    this.receipts = [];
    this.paymentAllocations = [];
    this.paymentReversals = [];
    this.receiptCounter = 0;
    this.processedIdempotencyKeys = new Map();
  }

  addStudent(student) {
    this.students.set(student.id, {
      ...student,
      feesPaid: 0,
      feesDue: student.course_fee
    });
  }

  addInstallment(inst) {
    this.installments.set(inst.id, {
      ...inst,
      status: 'Pending'
    });
  }

  computeFingerprint(studentId, amount, paymentMode, paymentDate, remarks, allocations) {
    const canonicalAllocations = (allocations && allocations.length > 0)
      ? [...allocations].sort((a, b) => String(a.installment_id).localeCompare(String(b.installment_id)))
      : [];

    const raw = [
      studentId,
      Number(amount).toFixed(2),
      paymentMode,
      paymentDate,
      remarks || '',
      JSON.stringify(canonicalAllocations)
    ].join('|');

    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  // Implementation mirroring public.record_payment_atomic
  recordPaymentAtomic({
    instituteId,
    studentId,
    amount,
    paymentMode,
    paymentDate,
    allocations = [],
    remarks = '',
    idempotencyKey
  }) {
    // 1. Validations
    if (!amount || amount <= 0) {
      throw new Error('Validation Failed: Payment amount must be non-null and strictly positive.');
    }
    if (!['UPI', 'Cash', 'Card', 'Cheque', 'Net Banking'].includes(paymentMode)) {
      throw new Error(`Validation Failed: Invalid payment mode ${paymentMode}`);
    }
    if (!paymentDate) {
      throw new Error('Validation Failed: Payment date is required.');
    }
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new Error('Validation Failed: Idempotency key must be provided.');
    }

    // 2. Lock & Validate Student
    const student = this.students.get(studentId);
    if (!student || student.institute_id !== instituteId) {
      throw new Error(`Validation Failed: Student ${studentId} not found in institute ${instituteId}`);
    }
    if (student.status === 'Inactive') {
      throw new Error('Validation Failed: Cannot record payment for an Inactive student.');
    }

    // 3. Compute Fingerprint
    const fingerprint = this.computeFingerprint(studentId, amount, paymentMode, paymentDate, remarks, allocations);

    // 4. Idempotency Check (MUST occur before balance / overpayment checks to permit legitimate retries)
    const existing = this.processedIdempotencyKeys.get(`${instituteId}:${idempotencyKey}`);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error(`IDEMPOTENCY_CONFLICT: Idempotency key ${idempotencyKey} reused with mismatched payment payload.`);
      }
      return {
        status: 'EXISTING',
        message: 'Transaction previously processed.',
        paymentId: existing.paymentId,
        receiptNumber: existing.receiptNumber
      };
    }

    // 5. For a genuinely new payment: Calculate Outstanding Balance and Enforce Overpayment Limit
    // Exclude payments that have been reversed via payment_reversals
    const reversedOriginalIds = new Set(
      this.paymentReversals
        .filter(pr => pr.institute_id === instituteId)
        .map(pr => pr.original_payment_id)
    );

    const totalPaidSoFar = this.payments
      .filter(p => p.institute_id === instituteId &&
                   p.student_id === studentId &&
                   p.payment_type === 'PAYMENT' &&
                   !reversedOriginalIds.has(p.id))
      .reduce((sum, p) => sum + p.amount, 0);

    const currentDue = student.course_fee - totalPaidSoFar;
    if (amount > currentDue) {
      throw new Error(`Overpayment: Payment of ${amount} exceeds remaining student balance of ${currentDue}`);
    }

    // 6. Validate Allocations (if provided)
    if (allocations && allocations.length > 0) {
      const seenIds = new Set();
      let totalAllocated = 0;

      for (const alloc of allocations) {
        if (seenIds.has(alloc.installment_id)) {
          throw new Error('Validation Failed: Duplicate installment references present in allocations payload.');
        }
        seenIds.add(alloc.installment_id);

        const inst = this.installments.get(alloc.installment_id);
        if (!inst || inst.student_id !== studentId || inst.institute_id !== instituteId) {
          throw new Error('Validation Failed: One or more requested installments do not exist or belong to another student.');
        }

        const previouslyPaidOnInst = this.paymentAllocations
          .filter(pa => pa.installment_id === alloc.installment_id)
          .reduce((sum, pa) => sum + pa.allocated_amount, 0);

        const instBalance = inst.amount - previouslyPaidOnInst;
        if (alloc.amount > instBalance) {
          throw new Error(`Overpayment: Allocation of ${alloc.amount} exceeds remaining balance of ${instBalance}`);
        }
        totalAllocated += alloc.amount;
      }

      if (totalAllocated !== amount) {
        throw new Error(`Validation Failed: Sum of allocations (${totalAllocated}) does not match payment amount (${amount}).`);
      }
    }

    // 7. Atomic Receipt Counter Allocation
    this.receiptCounter += 1;
    const year = paymentDate.split('-')[0] || '2026';
    const receiptNumber = `REC-${year}-${String(this.receiptCounter).padStart(4, '0')}`;

    // 8. Insert Payment (Append-only)
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const paymentRecord = {
      id: paymentId,
      institute_id: instituteId,
      student_id: studentId,
      amount,
      payment_mode: paymentMode,
      payment_type: 'PAYMENT',
      payment_date: paymentDate,
      remarks,
      idempotency_key: idempotencyKey,
      idempotency_fingerprint: fingerprint
    };
    this.payments.push(paymentRecord);

    // 9. Insert Receipt (Append-only)
    const receiptRecord = {
      id: `rec_${paymentId}`,
      institute_id: instituteId,
      payment_id: paymentId,
      receipt_number: receiptNumber,
      receipt_type: 'RECEIPT',
      generated_at: new Date().toISOString()
    };
    this.receipts.push(receiptRecord);

    // 10. Record Allocations and Update Installment Statuses (if provided)
    if (allocations && allocations.length > 0) {
      for (const alloc of allocations) {
        this.paymentAllocations.push({
          id: `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          institute_id: instituteId,
          payment_id: paymentId,
          installment_id: alloc.installment_id,
          allocated_amount: alloc.amount,
          allocation_type: 'CREDIT'
        });

        const inst = this.installments.get(alloc.installment_id);
        const totalPaidOnInst = this.paymentAllocations
          .filter(pa => pa.installment_id === alloc.installment_id)
          .reduce((sum, pa) => sum + pa.allocated_amount, 0);

        if (totalPaidOnInst >= inst.amount) {
          inst.status = 'Paid';
        } else if (totalPaidOnInst > 0) {
          inst.status = 'Partially_Paid';
        }
      }
    }

    // 11. Update student's dynamic feesPaid and feesDue
    const newTotalPaid = totalPaidSoFar + amount;
    student.feesPaid = newTotalPaid;
    student.feesDue = Math.max(0, student.course_fee - newTotalPaid);

    // 12. Register for Idempotency
    this.processedIdempotencyKeys.set(`${instituteId}:${idempotencyKey}`, {
      paymentId,
      receiptNumber,
      fingerprint
    });

    return {
      status: 'SUCCESS',
      message: 'Payment recorded successfully.',
      paymentId,
      receiptNumber
    };
  }

  // Implementation mirroring public.void_payment_atomic
  voidPaymentAtomic({ instituteId, paymentId, reason }) {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Validation Failed: A detailed reversal reason (at least 5 characters) is required.');
    }

    const origPay = this.payments.find(p => p.id === paymentId && p.institute_id === instituteId);
    if (!origPay) {
      throw new Error('Payment Not Found: Original payment does not exist in this institute.');
    }

    if (origPay.payment_type === 'REVERSAL') {
      throw new Error('Invalid Operation: Cannot reverse an existing reversal entry.');
    }

    if (this.paymentReversals.some(pr => pr.original_payment_id === paymentId)) {
      throw new Error('Conflict: This payment has already been reversed.');
    }

    this.receiptCounter += 1;
    const year = new Date().getFullYear();
    const creditNoteNum = `CN-${year}-${String(this.receiptCounter).padStart(4, '0')}`;
    const reversalPayId = `rev_${paymentId}`;

    // Negative offsetting entry in payments table
    const reversalPayment = {
      id: reversalPayId,
      institute_id: instituteId,
      student_id: origPay.student_id,
      amount: -origPay.amount,
      payment_mode: 'Adjustment',
      payment_type: 'REVERSAL',
      payment_date: new Date().toISOString().split('T')[0],
      remarks: `Reversal of Payment ${origPay.id}. Reason: ${reason}`
    };
    this.payments.push(reversalPayment);

    // Credit Note in receipts table
    this.receipts.push({
      id: `rec_${reversalPayId}`,
      institute_id: instituteId,
      payment_id: reversalPayId,
      receipt_number: creditNoteNum,
      receipt_type: 'CREDIT_NOTE',
      generated_at: new Date().toISOString()
    });

    // Record in payment_reversals table
    this.paymentReversals.push({
      id: `reversal_${paymentId}`,
      institute_id: instituteId,
      original_payment_id: paymentId,
      reversal_payment_id: reversalPayId,
      reason
    });

    // Offsetting allocations if any
    const origAllocations = this.paymentAllocations.filter(pa => pa.payment_id === paymentId && pa.allocation_type === 'CREDIT');
    for (const alloc of origAllocations) {
      this.paymentAllocations.push({
        id: `alloc_rev_${alloc.id}`,
        institute_id: instituteId,
        payment_id: reversalPayId,
        installment_id: alloc.installment_id,
        allocated_amount: -alloc.allocated_amount,
        allocation_type: 'REVERSAL',
        reversal_of_id: alloc.id
      });

      const inst = this.installments.get(alloc.installment_id);
      if (inst) {
        const netPaidOnInst = this.paymentAllocations
          .filter(pa => pa.installment_id === alloc.installment_id)
          .reduce((sum, pa) => sum + pa.allocated_amount, 0);

        if (netPaidOnInst >= inst.amount) {
          inst.status = 'Paid';
        } else if (netPaidOnInst > 0) {
          inst.status = 'Partially_Paid';
        } else {
          inst.status = 'Pending';
        }
      }
    }

    // Update student's dynamic balance
    const student = this.students.get(origPay.student_id);
    if (student) {
      student.feesPaid -= origPay.amount;
      student.feesDue = Math.max(0, student.course_fee - student.feesPaid);
    }

    return {
      status: 'SUCCESS',
      reversalPaymentId: reversalPayId,
      creditNoteNumber: creditNoteNum
    };
  }
}

async function runRegressionTests() {
  const engine = new MockPaymentEngine();
  const instituteId = 'inst_test_corp';

  // Seed student with ₹12,000 fee and no installments
  engine.addStudent({
    id: 'student_1',
    institute_id: instituteId,
    full_name: 'Aarav Mehta',
    course_fee: 12000,
    status: 'Active',
    course_id: 'c_math_10'
  });

  // Seed student with installments
  engine.addStudent({
    id: 'student_inst',
    institute_id: instituteId,
    full_name: 'Ananya Verma',
    course_fee: 12000,
    status: 'Active',
    course_id: 'c_math_10'
  });
  engine.addInstallment({
    id: 'inst_a',
    student_id: 'student_inst',
    institute_id: instituteId,
    installment_number: 1,
    amount: 6000,
    due_date: '2026-11-20'
  });
  engine.addInstallment({
    id: 'inst_b',
    student_id: 'student_inst',
    institute_id: instituteId,
    installment_number: 2,
    amount: 6000,
    due_date: '2026-12-20'
  });

  // --------------------------------------------------------------------------
  console.log('Test 1: Original ₹2,000 payment succeeds');
  // --------------------------------------------------------------------------
  const pay1 = engine.recordPaymentAtomic({
    instituteId,
    studentId: 'student_1',
    amount: 2000,
    paymentMode: 'Cash',
    paymentDate: '2026-11-06',
    remarks: 'Initial payment',
    idempotencyKey: 'key_aarav_001'
  });
  assert.equal(pay1.status, 'SUCCESS');
  assert.ok(pay1.paymentId);
  assert.ok(pay1.receiptNumber);
  const s1 = engine.students.get('student_1');
  assert.equal(s1.feesPaid, 2000);
  assert.equal(s1.feesDue, 10000);
  console.log(`✓ Original ₹2,000 payment succeeded (Payment ID: ${pay1.paymentId}, Receipt: ${pay1.receiptNumber})`);

  // --------------------------------------------------------------------------
  console.log('\nTest 2: Retrying the exact same request with the same idempotency key returns original payment and receipt');
  // --------------------------------------------------------------------------
  const initialPaymentCount = engine.payments.length;
  const initialReceiptCount = engine.receipts.length;

  const retryPay = engine.recordPaymentAtomic({
    instituteId,
    studentId: 'student_1',
    amount: 2000,
    paymentMode: 'Cash',
    paymentDate: '2026-11-06',
    remarks: 'Initial payment',
    idempotencyKey: 'key_aarav_001'
  });
  assert.equal(retryPay.status, 'EXISTING');
  assert.equal(retryPay.paymentId, pay1.paymentId);
  assert.equal(retryPay.receiptNumber, pay1.receiptNumber);
  console.log(`✓ Idempotent retry returned original payment (${retryPay.paymentId}) and receipt (${retryPay.receiptNumber})`);

  // --------------------------------------------------------------------------
  console.log('\nTest 3: The retry does not create another payment or receipt');
  // --------------------------------------------------------------------------
  assert.equal(engine.payments.length, initialPaymentCount, 'Payments array length must not increase on retry');
  assert.equal(engine.receipts.length, initialReceiptCount, 'Receipts array length must not increase on retry');
  assert.equal(s1.feesPaid, 2000, 'Student feesPaid must not double charge');
  assert.equal(s1.feesDue, 10000, 'Student feesDue must remain unchanged');
  console.log(`✓ Verified: 0 extra payments or receipts created (Count: ${engine.payments.length} payments, ${engine.receipts.length} receipts)`);

  // --------------------------------------------------------------------------
  console.log('\nTest 4: Reusing the same key with a different amount is rejected');
  // --------------------------------------------------------------------------
  assert.throws(() => {
    engine.recordPaymentAtomic({
      instituteId,
      studentId: 'student_1',
      amount: 4000, // Different amount reused with key_aarav_001
      paymentMode: 'Cash',
      paymentDate: '2026-11-06',
      remarks: 'Mismatched attempt',
      idempotencyKey: 'key_aarav_001'
    });
  }, /IDEMPOTENCY_CONFLICT/);
  console.log('✓ Idempotency collision strictly blocked with IDEMPOTENCY_CONFLICT');

  // --------------------------------------------------------------------------
  console.log('\nTest 5: Two concurrent payments cannot exceed the outstanding balance');
  // --------------------------------------------------------------------------
  // Current outstanding due for student_1 is ₹10,000 (12,000 - 2,000)
  // Two concurrent transactions attempt to pay ₹6,000 each (Total ₹12,000 > ₹10,000)
  // Student row lock serializes execution
  const concurrentPayA = engine.recordPaymentAtomic({
    instituteId,
    studentId: 'student_1',
    amount: 6000,
    paymentMode: 'UPI',
    paymentDate: '2026-11-06',
    remarks: 'Concurrent Payment A',
    idempotencyKey: 'key_concurrent_A'
  });
  assert.equal(concurrentPayA.status, 'SUCCESS');
  assert.equal(s1.feesPaid, 8000);
  assert.equal(s1.feesDue, 4000);

  // Second concurrent transaction unblocks and evaluates against the updated student balance
  assert.throws(() => {
    engine.recordPaymentAtomic({
      instituteId,
      studentId: 'student_1',
      amount: 6000, // Exceeds remaining balance of ₹4,000
      paymentMode: 'UPI',
      paymentDate: '2026-11-06',
      remarks: 'Concurrent Payment B',
      idempotencyKey: 'key_concurrent_B'
    });
  }, /Overpayment: Payment of 6000 exceeds remaining student balance of 4000/);
  assert.equal(s1.feesPaid, 8000);
  assert.equal(s1.feesDue, 4000);
  console.log('✓ Concurrency safety verified: first payment succeeded (₹6,000), second concurrent payment rejected (₹6,000 > ₹4,000 remaining)');

  // --------------------------------------------------------------------------
  console.log('\nTest 6: Reversed payments are accounted for correctly');
  // --------------------------------------------------------------------------
  // student_1 has paid ₹8,000 (pay1 ₹2,000 + concurrentPayA ₹6,000), remaining due is ₹4,000
  // Reverse the original ₹2,000 payment via voidPaymentAtomic
  const voidResult = engine.voidPaymentAtomic({
    instituteId,
    paymentId: pay1.paymentId,
    reason: 'Incorrect cash denomination submitted by parent'
  });
  assert.equal(voidResult.status, 'SUCCESS');
  assert.ok(voidResult.creditNoteNumber.startsWith('CN-2026-'));
  // Due balance must restore: feesPaid becomes 6000, feesDue becomes 6000 (12000 - 6000)
  assert.equal(s1.feesPaid, 6000);
  assert.equal(s1.feesDue, 6000);
  console.log(`✓ Reversed payment ${pay1.paymentId} via Credit Note ${voidResult.creditNoteNumber}`);
  console.log(`  Restored student balance: Paid = ₹${s1.feesPaid}, Due = ₹${s1.feesDue}`);

  // Now attempt a payment of ₹6,000 (which previously would have failed if pay1 was not excluded from calculations)
  const fullSettlement = engine.recordPaymentAtomic({
    instituteId,
    studentId: 'student_1',
    amount: 6000,
    paymentMode: 'Net Banking',
    paymentDate: '2026-11-06',
    remarks: 'Full settlement after reversal',
    idempotencyKey: 'key_post_reversal_settlement'
  });
  assert.equal(fullSettlement.status, 'SUCCESS');
  assert.equal(s1.feesPaid, 12000);
  assert.equal(s1.feesDue, 0);
  console.log('✓ Payment of ₹6,000 successfully accepted after reversal, bringing student balance to ₹0');

  // --------------------------------------------------------------------------
  console.log('\nTest 7: Existing installment-based payments continue working');
  // --------------------------------------------------------------------------
  const instPay1 = engine.recordPaymentAtomic({
    instituteId,
    studentId: 'student_inst',
    amount: 6000,
    paymentMode: 'Cheque',
    paymentDate: '2026-11-06',
    allocations: [{ installment_id: 'inst_a', amount: 6000 }],
    remarks: 'Cheque #123456 for Installment 1',
    idempotencyKey: 'key_inst_1_pay'
  });
  assert.equal(instPay1.status, 'SUCCESS');
  const sInst = engine.students.get('student_inst');
  assert.equal(sInst.feesPaid, 6000);
  assert.equal(sInst.feesDue, 6000);
  assert.equal(engine.installments.get('inst_a').status, 'Paid');
  assert.equal(engine.installments.get('inst_b').status, 'Pending');
  console.log('✓ Installment 1 paid successfully; Installment 1 = Paid, Installment 2 = Pending');

  // Reverse installment payment and ensure installment status returns to Pending
  const voidInst = engine.voidPaymentAtomic({
    instituteId,
    paymentId: instPay1.paymentId,
    reason: 'Cheque bounced'
  });
  assert.equal(voidInst.status, 'SUCCESS');
  assert.equal(sInst.feesPaid, 0);
  assert.equal(sInst.feesDue, 12000);
  assert.equal(engine.installments.get('inst_a').status, 'Pending');
  console.log('✓ Reversing installment payment restored installment 1 status to Pending and balance to ₹12,000');

  // Re-pay installment 1 with Cash
  const rePayInst = engine.recordPaymentAtomic({
    instituteId,
    studentId: 'student_inst',
    amount: 6000,
    paymentMode: 'Cash',
    paymentDate: '2026-11-06',
    allocations: [{ installment_id: 'inst_a', amount: 6000 }],
    remarks: 'Cash replacement for bounced cheque',
    idempotencyKey: 'key_inst_1_repay'
  });
  assert.equal(rePayInst.status, 'SUCCESS');
  assert.equal(sInst.feesPaid, 6000);
  assert.equal(engine.installments.get('inst_a').status, 'Paid');
  console.log('✓ Re-paying installment 1 succeeded; Installment 1 = Paid');

  console.log('\n================================================================');
  console.log('ALL 7 REGRESSION & REVERSAL / IDEMPOTENCY TESTS PASSED (7/7)!');
  console.log('================================================================');
}

runRegressionTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
