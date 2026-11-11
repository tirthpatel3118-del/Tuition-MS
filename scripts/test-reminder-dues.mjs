import assert from 'node:assert/strict';

console.log('Testing EduLedger Dues & Reminders Direct Fee & Installment Engine...\n');

// Mirroring the pure logic implemented in src/utils/reminderTemplate.ts
const DEFAULT_INSTALLMENT_REMINDER_TEMPLATE =
  'Dear {ParentName}, this is a gentle reminder that Installment #{InstallmentNumber} of {Amount} is due on {DueDate} for {StudentName}. Please clear the dues. Thank you, {InstituteName}.';

const DEFAULT_DIRECT_REMINDER_TEMPLATE =
  'Dear {ParentName}, this is a gentle reminder that an outstanding fee balance of {Amount} is due for {StudentName}. Please clear the dues. Thank you, {InstituteName}.';

function formatAmount(value, currencySymbol = '₹') {
  return `${currencySymbol}${(Number.isFinite(value) ? value ?? 0 : 0).toLocaleString('en-IN')}`;
}

function renderReminderTemplate(template, values) {
  const currencySymbol = values.currencySymbol || '₹';
  const isDirect = Boolean(
    values.isDirect ||
    values.installmentNumber === undefined ||
    values.installmentNumber === null ||
    values.installmentNumber === ''
  );

  const tokens = {
    StudentName: values.studentName || '',
    ParentName: values.parentName || '',
    InstallmentNumber: isDirect ? '' : String(values.installmentNumber ?? ''),
    Amount: formatAmount(values.amount ?? values.installmentAmount ?? values.remainingFee, currencySymbol),
    InstallmentAmount: formatAmount(values.installmentAmount ?? values.amount ?? values.remainingFee, currencySymbol),
    DueDate: isDirect ? '' : (values.dueDate && values.dueDate !== '—' ? values.dueDate : ''),
    RemainingFee: formatAmount(values.remainingFee ?? values.amount ?? values.installmentAmount, currencySymbol),
    InstituteName: values.instituteName || 'EduLedger ERP',
  };

  let rendered = template;

  if (isDirect) {
    rendered = rendered.replace(
      /Installment\s*(?:#\s*)?(?:\{|\[)InstallmentNumber(?:\}|\])\s*(?:of\s+)?/gi,
      (match) => (/of\s+/i.test(match) ? 'an outstanding fee balance of ' : 'an outstanding fee ')
    );
    rendered = rendered.replace(/\s*(?:is\s*)?due\s+on\s+(?:\{|\[)DueDate(?:\}|\])/gi, ' is due');
  }

  for (const [name, value] of Object.entries(tokens)) {
    rendered = rendered.replace(new RegExp(`\\{${name}\\}|\\[${name}\\]`, 'g'), value);
  }

  return rendered.replace(/\{[A-Za-z0-9_]+\}|\[[A-Za-z0-9_]+\]/g, '');
}

// Mirroring the pure logic implemented in src/pages/Reminders.tsx
function generateDueItems({ students, installments, installmentPaidTotals = {}, dateFormat = 'YYYY-MM-DD' }) {
  const items = [];

  const activeStudentsWithDue = (students || []).filter(
    s => s.status !== 'Inactive' && s.feesDue > 0
  );

  const installmentsByStudent = new Map();
  for (const inst of installments || []) {
    if (!installmentsByStudent.has(inst.studentId)) {
      installmentsByStudent.set(inst.studentId, []);
    }
    installmentsByStudent.get(inst.studentId).push(inst);
  }

  for (const student of activeStudentsWithDue) {
    const studentInsts = installmentsByStudent.get(student.id) || [];
    const unpaidInsts = studentInsts
      .filter(inst => inst.status !== 'Paid')
      .sort((a, b) => (a.installmentNumber - b.installmentNumber) || a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));

    let remainingAllowance = student.feesDue;

    for (const inst of unpaidInsts) {
      if (remainingAllowance <= 0) break;

      const nominalBalance = Math.max(0, inst.amount - (installmentPaidTotals[inst.id] ?? 0));
      if (nominalBalance <= 0) continue;

      const amount = Math.min(nominalBalance, remainingAllowance);
      remainingAllowance -= amount;

      const isOverdue = inst.status === 'Overdue';

      items.push({
        id: inst.id,
        isDirect: false,
        studentId: student.id,
        student,
        studentName: student.name,
        studentRoll: student.rollNumber || '',
        courseName: student.courseName || '',
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || '',
        installmentNumber: inst.installmentNumber,
        displayInstallment: `#${inst.installmentNumber}`,
        amount,
        dueDate: inst.dueDate,
        displayDueDate: inst.dueDate,
        status: isOverdue ? 'Overdue' : 'Pending',
        remarks: inst.remarks,
        remainingFee: student.feesDue,
      });
    }

    if (remainingAllowance > 0) {
      items.push({
        id: `direct-${student.id}`,
        isDirect: true,
        studentId: student.id,
        student,
        studentName: student.name,
        studentRoll: student.rollNumber || '',
        courseName: student.courseName || '',
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || '',
        installmentNumber: undefined,
        displayInstallment: 'Direct Fee',
        amount: remainingAllowance,
        dueDate: '',
        displayDueDate: '—',
        status: 'Pending',
        remarks: 'Direct fee balance',
        remainingFee: student.feesDue,
      });
    }
  }

  return items;
}

// Mirroring the pure logic implemented in src/context/DataContext.tsx
function getStudentDueItemAmounts(student, installments, installmentPaidTotals = {}) {
  const itemAmounts = new Map();
  if (student.status === 'Inactive' || student.feesDue <= 0) return itemAmounts;

  const unpaidInsts = installments
    .filter(inst => inst.studentId === student.id && inst.status !== 'Paid')
    .sort((a, b) =>
      (a.installmentNumber - b.installmentNumber) ||
      a.dueDate.localeCompare(b.dueDate) ||
      a.id.localeCompare(b.id)
    );

  let remainingAllowance = student.feesDue;

  for (const inst of unpaidInsts) {
    if (remainingAllowance <= 0) break;
    const nominalBalance = Math.max(0, inst.amount - (installmentPaidTotals[inst.id] ?? 0));
    if (nominalBalance <= 0) continue;

    const amount = Math.min(nominalBalance, remainingAllowance);
    remainingAllowance -= amount;
    itemAmounts.set(inst.id, amount);
  }

  if (remainingAllowance > 0) {
    itemAmounts.set(`direct-${student.id}`, remainingAllowance);
  }

  return itemAmounts;
}

function simulateSendBulkReminders({ itemIds, type, students, installments, installmentPaidTotals = {} }) {
  const uniqueIds = Array.from(new Set(itemIds));
  const queued = [];
  const studentDueCache = new Map();
  const studentRemaining = new Map();

  const getDueMap = (student) => {
    let dueMap = studentDueCache.get(student.id);
    if (!dueMap) {
      dueMap = getStudentDueItemAmounts(student, installments, installmentPaidTotals);
      studentDueCache.set(student.id, dueMap);
    }
    return dueMap;
  };

  for (const id of uniqueIds) {
    if (id.startsWith('direct-')) {
      const studentId = id.slice(7);
      const student = students.find(s => s.id === studentId);
      if (!student || student.status === 'Inactive' || student.feesDue <= 0) continue;
      const directAmount = getDueMap(student).get(id) ?? 0;
      const available = studentRemaining.has(student.id)
        ? studentRemaining.get(student.id)
        : student.feesDue;
      const amountDue = Math.min(directAmount, available);
      if (amountDue > 0) {
        queued.push({ itemId: id, studentId: student.id, studentName: student.name, amountDue, channel: type, status: 'queued' });
        studentRemaining.set(student.id, available - amountDue);
      }
    } else {
      const installment = installments.find(inst => inst.id === id);
      if (!installment || installment.status === 'Paid') continue;
      const student = students.find(s => s.id === installment.studentId);
      if (!student || student.status === 'Inactive' || student.feesDue <= 0) continue;
      const instAmount = getDueMap(student).get(installment.id) ?? 0;
      const available = studentRemaining.has(student.id)
        ? studentRemaining.get(student.id)
        : student.feesDue;
      const amountDue = Math.min(instAmount, available);
      if (amountDue > 0) {
        queued.push({ itemId: id, studentId: student.id, studentName: student.name, amountDue, channel: type, status: 'queued' });
        studentRemaining.set(student.id, available - amountDue);
      }
    }
  }

  return queued;
}

// ============================================================================
// TEST 1: Student with ₹12,000 due and no installments (e.g. TIRTH PATEL)
// ============================================================================
console.log('Test 1: Student with ₹12,000 due and no installments');
const s1 = { id: 's1', name: 'Tirth Patel', parentName: 'P. Patel', parentPhone: '9876543210', status: 'Active', totalFees: 12000, feesPaid: 0, feesDue: 12000 };
const items1 = generateDueItems({ students: [s1], installments: [] });
assert.equal(items1.length, 1, 'Must generate exactly 1 due item');
assert.equal(items1[0].id, 'direct-s1', 'ID must be prefixed with direct-');
assert.equal(items1[0].isDirect, true, 'isDirect must be true');
assert.equal(items1[0].displayInstallment, 'Direct Fee', 'Must display Direct Fee');
assert.equal(items1[0].amount, 12000, 'Amount must be 12,000');
assert.equal(items1[0].dueDate, '', 'Due date key must be empty');
assert.equal(items1[0].displayDueDate, '—', 'Display due date must be em-dash (—)');
assert.equal(items1[0].installmentNumber, undefined, 'Installment number must not be fabricated');
console.log('✓ Successfully generated direct fee reminder for ₹12,000 with due date "—"\n');

// ============================================================================
// TEST 2: Student with pending installments (2 x ₹6,000)
// ============================================================================
console.log('Test 2: Student with pending installments');
const s2 = { id: 's2', name: 'Aarav Shah', status: 'Active', totalFees: 12000, feesPaid: 0, feesDue: 12000 };
const inst2a = { id: 'inst_2a', studentId: 's2', installmentNumber: 1, amount: 6000, dueDate: '2026-08-01', status: 'Pending' };
const inst2b = { id: 'inst_2b', studentId: 's2', installmentNumber: 2, amount: 6000, dueDate: '2026-09-01', status: 'Pending' };
const items2 = generateDueItems({ students: [s2], installments: [inst2a, inst2b] });
assert.equal(items2.length, 2, 'Must generate 2 items for 2 installments');
assert.equal(items2[0].id, 'inst_2a');
assert.equal(items2[0].amount, 6000);
assert.equal(items2[0].displayInstallment, '#1');
assert.equal(items2[1].id, 'inst_2b');
assert.equal(items2[1].amount, 6000);
assert.equal(items2[1].displayInstallment, '#2');
const totalItems2Amount = items2.reduce((sum, item) => sum + item.amount, 0);
assert.equal(totalItems2Amount, 12000, 'Sum of installments must equal feesDue');
console.log('✓ Successfully generated 2 scheduled installment reminders matching ₹12,000 total\n');

// ============================================================================
// TEST 3: Student with partially planned installments
// ============================================================================
console.log('Test 3: Student with partially planned installments');
const s3 = { id: 's3', name: 'Riya Gupta', status: 'Active', totalFees: 12000, feesPaid: 0, feesDue: 12000 };
const inst3 = { id: 'inst_3', studentId: 's3', installmentNumber: 1, amount: 5000, dueDate: '2026-08-15', status: 'Pending' };
const items3 = generateDueItems({ students: [s3], installments: [inst3] });
assert.equal(items3.length, 2, 'Must generate 1 installment item + 1 direct fee item');
assert.equal(items3[0].id, 'inst_3');
assert.equal(items3[0].amount, 5000);
assert.equal(items3[0].displayInstallment, '#1');
assert.equal(items3[1].id, 'direct-s3');
assert.equal(items3[1].amount, 7000, 'Direct remainder must be 12000 - 5000 = 7000');
assert.equal(items3[1].displayInstallment, 'Direct Fee');
assert.equal(items3[1].displayDueDate, '—');
const totalItems3Amount = items3.reduce((sum, item) => sum + item.amount, 0);
assert.equal(totalItems3Amount, 12000, 'Total reminder amounts must exactly equal feesDue');
console.log('✓ Successfully generated 1 installment item (₹5,000) and 1 direct remainder item (₹7,000)\n');

// ============================================================================
// TEST 4: Student with paid installments but remaining course balance
// ============================================================================
console.log('Test 4: Student with paid installments but remaining course balance');
const s4 = { id: 's4', name: 'Kabir Verma', status: 'Active', totalFees: 12000, feesPaid: 5000, feesDue: 7000 };
const inst4 = { id: 'inst_4', studentId: 's4', installmentNumber: 1, amount: 5000, dueDate: '2026-08-01', status: 'Paid' };
const items4 = generateDueItems({ students: [s4], installments: [inst4], installmentPaidTotals: { inst_4: 5000 } });
assert.equal(items4.length, 1, 'Paid installment must be excluded; only direct remainder shown');
assert.equal(items4[0].id, 'direct-s4');
assert.equal(items4[0].amount, 7000);
assert.equal(items4[0].displayInstallment, 'Direct Fee');
console.log('✓ Paid installment excluded; remaining unallocated balance of ₹7,000 accurately presented\n');

// ============================================================================
// TEST 5 & 6: Student with unallocated payments where pending installments exceed remaining course balance
// ============================================================================
console.log('Test 5 & 6: Capping when pending installments exceed remaining course balance');
const s5 = { id: 's5', name: 'Diya Mehta', status: 'Active', totalFees: 12000, feesPaid: 5000, feesDue: 7000 };
const inst5a = { id: 'inst_5a', studentId: 's5', installmentNumber: 1, amount: 6000, dueDate: '2026-08-01', status: 'Pending' };
const inst5b = { id: 'inst_5b', studentId: 's5', installmentNumber: 2, amount: 6000, dueDate: '2026-09-01', status: 'Pending' };
const items5 = generateDueItems({ students: [s5], installments: [inst5a, inst5b] });
assert.equal(items5.length, 2, 'Both installments included but second is capped');
assert.equal(items5[0].id, 'inst_5a');
assert.equal(items5[0].amount, 6000);
assert.equal(items5[1].id, 'inst_5b');
assert.equal(items5[1].amount, 1000, 'Second installment capped at remaining 1,000');
const totalItems5Amount = items5.reduce((sum, item) => sum + item.amount, 0);
assert.equal(totalItems5Amount, 7000, 'Total reminded must strictly equal feesDue (₹7,000) and not ₹12,000');
console.log('✓ Successfully capped installments: ₹6,000 and ₹1,000 summing to exact feesDue (₹7,000)\n');

// ============================================================================
// TEST 7: Inactive student exclusion
// ============================================================================
console.log('Test 7: Inactive student exclusion');
const sInactive = { id: 's_in', name: 'Inactive Student', status: 'Inactive', totalFees: 12000, feesPaid: 0, feesDue: 12000 };
const instInactive = { id: 'inst_in', studentId: 's_in', installmentNumber: 1, amount: 6000, dueDate: '2026-08-01', status: 'Pending' };
const itemsInactive = generateDueItems({ students: [sInactive], installments: [instInactive] });
assert.equal(itemsInactive.length, 0, 'Inactive student must produce 0 due items');
console.log('✓ Inactive student with ₹12,000 balance cleanly excluded\n');

// ============================================================================
// TEST 8: Bulk reminder for direct fee
// ============================================================================
console.log('Test 8: Bulk reminder for direct fee');
const queuedDirect = simulateSendBulkReminders({
  itemIds: ['direct-s1'],
  type: 'WhatsApp',
  students: [s1],
  installments: []
});
assert.equal(queuedDirect.length, 1);
assert.equal(queuedDirect[0].studentId, 's1');
assert.equal(queuedDirect[0].amountDue, 12000);
assert.equal(queuedDirect[0].channel, 'WhatsApp');
assert.equal(queuedDirect[0].status, 'queued');
console.log('✓ Bulk reminder dispatched for direct fee with amount ₹12,000\n');

// ============================================================================
// TEST 9: Bulk reminder for installment
// ============================================================================
console.log('Test 9: Bulk reminder for installment');
const queuedInst = simulateSendBulkReminders({
  itemIds: ['inst_2a', 'inst_2b'],
  type: 'SMS',
  students: [s2],
  installments: [inst2a, inst2b]
});
assert.equal(queuedInst.length, 2);
assert.equal(queuedInst[0].amountDue, 6000);
assert.equal(queuedInst[1].amountDue, 6000);
console.log('✓ Bulk reminder dispatched for installments #1 and #2\n');

// ============================================================================
// TEST 10: Invariant check: No duplicate or excessive reminder amounts
// ============================================================================
console.log('Test 10: Invariant check - No duplicate or excessive reminder amounts');
const allStudents = [s1, s2, s3, s4, s5, sInactive];
const allInstallments = [inst2a, inst2b, inst3, inst4, inst5a, inst5b, instInactive];
const allGeneratedItems = generateDueItems({ students: allStudents, installments: allInstallments });

for (const student of allStudents) {
  const studentItems = allGeneratedItems.filter(i => i.studentId === student.id);
  const totalReminderSum = studentItems.reduce((sum, i) => sum + i.amount, 0);
  if (student.status === 'Inactive') {
    assert.equal(studentItems.length, 0, 'Inactive student must have 0 reminders');
  } else {
    assert.equal(totalReminderSum, student.feesDue, `Student ${student.name} reminder sum (${totalReminderSum}) must strictly equal feesDue (${student.feesDue})`);
  }
}
console.log('✓ Invariant verified: Every active student has total reminder sum strictly equal to feesDue\n');

// ============================================================================
// TEST 11: Dedicated templates for installment vs direct fee reminders
// ============================================================================
console.log('Test 11: Separate reminder templates for installments and direct fees');

// Installment template rendering
const installmentRendered = renderReminderTemplate(DEFAULT_INSTALLMENT_REMINDER_TEMPLATE, {
  studentName: 'Aarav Shah',
  parentName: 'Mr. Shah',
  installmentNumber: 1,
  amount: 6000,
  dueDate: '2026-08-01',
  remainingFee: 12000,
  instituteName: 'EduLedger Coaching',
  isDirect: false,
});
assert.match(installmentRendered, /Installment #1 of ₹6,000/);
assert.match(installmentRendered, /due on 2026-08-01/);
assert.doesNotMatch(installmentRendered, /\{[A-Za-z0-9_]+\}/, 'No unparsed tokens allowed');

// Direct fee template rendering using actual remaining balance, no fabricated number or date
const directRendered = renderReminderTemplate(DEFAULT_DIRECT_REMINDER_TEMPLATE, {
  studentName: 'Tirth Patel',
  parentName: 'P. Patel',
  installmentNumber: undefined,
  amount: 12000,
  dueDate: '',
  remainingFee: 12000,
  instituteName: 'EduLedger Coaching',
  isDirect: true,
});
assert.doesNotMatch(directRendered, /Installment #/, 'Must not contain Installment #');
assert.doesNotMatch(directRendered, /due on/, 'Must not contain fabricated due date phrase');
assert.doesNotMatch(directRendered, /—/, 'Must not contain placeholder dash for date');
assert.match(directRendered, /outstanding fee balance of ₹12,000 is due for Tirth Patel/);
assert.doesNotMatch(directRendered, /\{[A-Za-z0-9_]+\}/, 'No unparsed tokens allowed');
console.log('✓ Separate reminder templates rendered cleanly with actual remaining balance and zero fabricated fields:');
console.log(`  Installment: "${installmentRendered}"`);
console.log(`  Direct Fee:  "${directRendered}"\n`);

// ============================================================================
// TEST 12: URL parameter selection (?student=STUDENT_ID)
// ============================================================================
console.log('Test 12: URL parameter selection (?student=STUDENT_ID) for direct-fee and installment items');
// 12a. Direct fee student selection
const directStudentDue = allGeneratedItems.find(item => item.studentId === 's1');
assert.ok(directStudentDue, 'Must find due item for student s1');
assert.equal(directStudentDue.id, 'direct-s1', 'Must resolve direct-s1 for direct fee student');

let currentSelected = [];
const selectDirect = (firstDue) => {
  currentSelected = currentSelected.includes(firstDue.id) ? currentSelected : [firstDue.id];
};
selectDirect(directStudentDue);
assert.deepEqual(currentSelected, ['direct-s1'], 'Must select direct-s1');
const refBefore = currentSelected;
selectDirect(directStudentDue);
assert.equal(currentSelected, refBefore, 'Must preserve array reference and avoid duplicate selection');

// 12b. Installment student selection
const installmentStudentDue = allGeneratedItems.find(item => item.studentId === 's2');
assert.ok(installmentStudentDue, 'Must find due item for student s2');
assert.equal(installmentStudentDue.id, 'inst_2a', 'Must resolve inst_2a for installment student');

selectDirect(installmentStudentDue);
assert.deepEqual(currentSelected, ['inst_2a'], 'Must focus and select inst_2a');
console.log('✓ URL parameter selection accurately focuses and selects direct-s1 and inst_2a without duplicate state mutations\n');

// ============================================================================
// TEST 13: Custom templates & legacy installment template direct-fee safety
// ============================================================================
console.log('Test 13: Template customization, square bracket tokens, and legacy fallback safety');
const customDirectTemplate = 'Hello [ParentName], balance of [RemainingFee] for [StudentName] is pending at [InstituteName].';
const customDirectRendered = renderReminderTemplate(customDirectTemplate, {
  studentName: 'Tirth Patel',
  parentName: 'P. Patel',
  amount: 12000,
  remainingFee: 12000,
  instituteName: 'Apex Academy',
  isDirect: true,
});
assert.equal(
  customDirectRendered,
  'Hello P. Patel, balance of ₹12,000 for Tirth Patel is pending at Apex Academy.'
);

const legacyAdaptedRendered = renderReminderTemplate(DEFAULT_INSTALLMENT_REMINDER_TEMPLATE, {
  studentName: 'Tirth Patel',
  parentName: 'P. Patel',
  amount: 12000,
  remainingFee: 12000,
  instituteName: 'Apex Academy',
  isDirect: true,
});
assert.doesNotMatch(legacyAdaptedRendered, /Installment #/);
assert.doesNotMatch(legacyAdaptedRendered, /due on/);
assert.match(legacyAdaptedRendered, /an outstanding fee balance of ₹12,000 is due for Tirth Patel/);
console.log('✓ Custom templates and legacy fallbacks preserve tokens and omit fabricated installment numbers/dates\n');

// ============================================================================
// TEST 14: Preview selection based on selected reminder type
// ============================================================================
console.log('Test 14: Preview resolution switches accurately between direct and installment templates');
const sampleQueue = [
  {
    id: 'direct-s1',
    isDirect: true,
    studentName: 'Tirth Patel',
    parentName: 'P. Patel',
    amount: 12000,
    remainingFee: 12000,
    dueDate: '',
  },
  {
    id: 'inst_2a',
    isDirect: false,
    studentName: 'Aarav Shah',
    parentName: 'Mr. Shah',
    installmentNumber: 1,
    amount: 6000,
    remainingFee: 12000,
    dueDate: '2026-08-01',
  },
];

function previewByType(selectedType, focusedId) {
  const focused = focusedId ? sampleQueue.find(i => i.id === focusedId) : null;
  const item =
    selectedType === 'direct'
      ? (focused?.isDirect ? focused : sampleQueue.find(i => i.isDirect))
      : (focused && !focused.isDirect ? focused : sampleQueue.find(i => !i.isDirect));
  const templateToUse =
    selectedType === 'direct' ? DEFAULT_DIRECT_REMINDER_TEMPLATE : DEFAULT_INSTALLMENT_REMINDER_TEMPLATE;

  return renderReminderTemplate(templateToUse, {
    studentName: item.studentName,
    parentName: item.parentName,
    installmentNumber: item.isDirect ? undefined : item.installmentNumber,
    amount: item.amount,
    dueDate: item.isDirect ? '' : item.dueDate,
    remainingFee: item.remainingFee,
    instituteName: 'EduLedger Coaching',
    isDirect: item.isDirect,
  });
}

const directPreviewMsg = previewByType('direct', 'inst_2a'); // Even if inst_2a was focused, direct tab shows direct preview
assert.match(directPreviewMsg, /outstanding fee balance of ₹12,000 is due for Tirth Patel/);
assert.doesNotMatch(directPreviewMsg, /Installment #/);

const instPreviewMsg = previewByType('installment', 'direct-s1'); // Even if direct-s1 was focused, inst tab shows inst preview
assert.match(instPreviewMsg, /Installment #1 of ₹6,000 is due on 2026-08-01 for Aarav Shah/);
console.log('✓ Live preview switches cleanly between installment and direct fee reminder messages\n');

// ============================================================================
// TEST 15: Bulk reminder reverse sorting, partially planned amounts & deduplication
// ============================================================================
console.log('Test 15: Bulk reminder reverse sorting, partially planned remainders, and duplicate IDs');

// 15a. Partially planned student (s3: feesDue ₹12,000 = inst_3 ₹5,000 + direct-s3 ₹7,000) in reverse order
const reversePartialQueued = simulateSendBulkReminders({
  itemIds: ['direct-s3', 'inst_3', 'direct-s3', 'inst_3'],
  type: 'WhatsApp',
  students: [s3],
  installments: [inst3],
});
assert.equal(reversePartialQueued.length, 2, 'Duplicate IDs must be deduplicated and neither item dropped');
assert.deepEqual(
  reversePartialQueued.map(q => ({ itemId: q.itemId, amountDue: q.amountDue })),
  [
    { itemId: 'direct-s3', amountDue: 7000 },
    { itemId: 'inst_3', amountDue: 5000 },
  ],
  'direct-s3 must preserve ₹7,000 remainder and inst_3 must preserve ₹5,000 even when sorted first'
);

// 15b. Selecting direct-s3 alone must queue ₹7,000 remainder, NOT full ₹12,000 feesDue
const singleDirectPartialQueued = simulateSendBulkReminders({
  itemIds: ['direct-s3'],
  type: 'SMS',
  students: [s3],
  installments: [inst3],
});
assert.equal(singleDirectPartialQueued.length, 1);
assert.equal(singleDirectPartialQueued[0].amountDue, 7000, 'direct-s3 alone must resolve to ₹7,000 remainder');

// 15c. Reverse-sorted capped installments (s5: feesDue ₹7,000, inst_5a ₹6,000, inst_5b ₹6,000)
const reverseCappedQueued = simulateSendBulkReminders({
  itemIds: ['inst_5b', 'inst_5a'],
  type: 'Email',
  students: [s5],
  installments: [inst5a, inst5b],
});
assert.equal(reverseCappedQueued.length, 2);
assert.deepEqual(
  reverseCappedQueued.map(q => ({ itemId: q.itemId, amountDue: q.amountDue })),
  [
    { itemId: 'inst_5b', amountDue: 1000 },
    { itemId: 'inst_5a', amountDue: 6000 },
  ],
  'Reverse sorting must keep inst_5b at ₹1,000 and inst_5a at ₹6,000'
);

// 15d. Duplicate installment IDs for multi-installment student (s2)
const dupInstQueued = simulateSendBulkReminders({
  itemIds: ['inst_2a', 'inst_2a', 'inst_2b'],
  type: 'WhatsApp',
  students: [s2],
  installments: [inst2a, inst2b],
});
assert.equal(dupInstQueued.length, 2);
assert.equal(dupInstQueued.reduce((sum, q) => sum + q.amountDue, 0), 12000);
console.log('✓ Reverse sorting, partial remainders, and duplicate IDs handled deterministically without dropping items or over-billing\n');

// ============================================================================
// TEST 16: Dashboard buildReminderMessage partial payment & unallocated cap
// ============================================================================
console.log('Test 16: Dashboard WhatsApp message accounts for partial installment payments and caps at feesDue');

function buildDashboardReminderMessage({ student, installments, installmentPaidTotals = {}, settings = {} }) {
  const nextInstallment = installments
    .filter(item =>
      item.studentId === student.id &&
      item.status !== 'Paid' &&
      Math.max(0, item.amount - (installmentPaidTotals[item.id] ?? 0)) > 0
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.installmentNumber - b.installmentNumber || a.id.localeCompare(b.id))[0];

  if (!nextInstallment) {
    return renderReminderTemplate(
      settings.directFeeReminderTemplate || DEFAULT_DIRECT_REMINDER_TEMPLATE,
      {
        studentName: student.name,
        parentName: student.parentName,
        amount: student.feesDue,
        remainingFee: student.feesDue,
        dueDate: '',
        instituteName: settings.instituteName,
        currencySymbol: settings.currencySymbol,
        isDirect: true,
      }
    );
  }

  const remainingInstallmentDue = Math.max(
    0,
    nextInstallment.amount - (installmentPaidTotals[nextInstallment.id] ?? 0)
  );
  const installmentAmount = Math.min(remainingInstallmentDue, student.feesDue);

  return renderReminderTemplate(
    settings.whatsappReminderTemplate || DEFAULT_INSTALLMENT_REMINDER_TEMPLATE,
    {
      studentName: student.name,
      parentName: student.parentName,
      installmentNumber: nextInstallment.installmentNumber,
      amount: installmentAmount,
      installmentAmount,
      dueDate: nextInstallment.dueDate || '',
      remainingFee: student.feesDue,
      instituteName: settings.instituteName,
      currencySymbol: settings.currencySymbol,
      isDirect: false,
    }
  );
}

// 16a. Partial payment directly toward installment #1 (inst: ₹6,000, paid: ₹2,000, feesDue: ₹4,000)
const dashPartialStudent = { id: 'sd1', name: 'Neha Rao', parentName: 'R. Rao', feesDue: 4000, status: 'Active' };
const dashPartialInst = { id: 'inst_d1', studentId: 'sd1', installmentNumber: 1, amount: 6000, dueDate: '2026-08-10', status: 'Pending' };
const dashPartialMsg = buildDashboardReminderMessage({
  student: dashPartialStudent,
  installments: [dashPartialInst],
  installmentPaidTotals: { inst_d1: 2000 },
  settings: { instituteName: 'EduLedger Coaching' },
});
assert.match(dashPartialMsg, /Installment #1 of ₹4,000 is due on 2026-08-10/);
assert.doesNotMatch(dashPartialMsg, /₹6,000/);

// 16b. Unallocated direct payment reducing student.feesDue below nextInstallment.amount (inst: ₹6,000, feesDue: ₹3,500)
const dashUnallocStudent = { id: 'sd2', name: 'Karan Joshi', parentName: 'S. Joshi', feesDue: 3500, status: 'Active' };
const dashUnallocInst = { id: 'inst_d2', studentId: 'sd2', installmentNumber: 1, amount: 6000, dueDate: '2026-08-15', status: 'Pending' };
const dashUnallocMsg = buildDashboardReminderMessage({
  student: dashUnallocStudent,
  installments: [dashUnallocInst],
  installmentPaidTotals: {},
  settings: { instituteName: 'EduLedger Coaching' },
});
assert.match(dashUnallocMsg, /Installment #1 of ₹3,500 is due on 2026-08-15/);
assert.doesNotMatch(dashUnallocMsg, /₹6,000/);

// 16c. Direct-fee student (no installments) keeps existing direct-fee behavior
const dashDirectMsg = buildDashboardReminderMessage({
  student: s1,
  installments: [],
  installmentPaidTotals: {},
  settings: { instituteName: 'EduLedger Coaching' },
});
assert.match(dashDirectMsg, /an outstanding fee balance of ₹12,000 is due for Tirth Patel/);
assert.doesNotMatch(dashDirectMsg, /Installment #|due on/);

console.log('✓ Dashboard WhatsApp reminder message aligns with remaining installment due and caps at student.feesDue\n');

console.log('================================================================');
console.log('ALL 16 DUES & REMINDERS REGRESSION TESTS PASSED (16/16)!');
console.log('================================================================');
