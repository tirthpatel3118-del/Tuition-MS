export interface Course {
  id: string;
  name: string;
  fees: number | null;
  duration: string; // e.g. "6 Months"
  subject: string;
}

export interface Student {
  id: string;
  rollNumber: string;
  name: string;
  email: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  enrollmentDate: string;
  courseId: string;
  courseName: string;
  batch: string;
  batchId?: string;
  totalFees: number;
  feesPaid: number;
  feesDue: number;
  status: 'Active' | 'Inactive' | 'Completed';
  notes?: string;
}

export interface Installment {
  id: string;
  studentId: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: 'Pending' | 'Paid' | 'Overdue' | 'Partially_Paid';
  paymentId?: string | null;
  remarks?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  courseName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'UPI' | 'Cash' | 'Card' | 'Cheque' | 'Net Banking';
  transactionId?: string;
  remarks?: string;
}

export interface Reminder {
  id: string;
  studentId: string;
  studentName: string;
  amountDue: number;
  sentDate: string;
  type: 'WhatsApp' | 'SMS' | 'Email';
  status: 'queued' | 'manual_opened' | 'sent' | 'delivered' | 'failed';
}

// Initial Mock Data
const INITIAL_COURSES: Course[] = [
  { id: 'c1', name: 'Mathematics - Grade 10 (Advanced)', fees: 15000, duration: '10 Months', subject: 'Mathematics' },
  { id: 'c2', name: 'Physics - Grade 11 (IIT-JEE Foundation)', fees: 25000, duration: '12 Months', subject: 'Physics' },
  { id: 'c3', name: 'Chemistry - Grade 12 (Board + NEET)', fees: 22000, duration: '12 Months', subject: 'Chemistry' },
  { id: 'c4', name: 'Computer Science - Python Bootcamp', fees: 8000, duration: '3 Months', subject: 'Computer Science' },
  { id: 'c5', name: 'English Literature & Grammar', fees: 6000, duration: '4 Months', subject: 'English' }
];

const INITIAL_STUDENTS: Student[] = [
  {
    id: 's1',
    rollNumber: 'EL-2026-001',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    phone: '9876543210',
    parentName: 'Ramesh Sharma',
    parentPhone: '9876543211',
    enrollmentDate: '2026-01-10',
    courseId: 'c1',
    courseName: 'Mathematics - Grade 10 (Advanced)',
    batch: 'Morning - Batch A (08:00 AM)',
    totalFees: 15000,
    feesPaid: 15000,
    feesDue: 0,
    status: 'Active',
    notes: 'Excels in algebra. Punctual student.'
  },
  {
    id: 's2',
    rollNumber: 'EL-2026-002',
    name: 'Isha Patel',
    email: 'isha.patel@example.com',
    phone: '9823456789',
    parentName: 'Kirit Patel',
    parentPhone: '9823456780',
    enrollmentDate: '2026-01-15',
    courseId: 'c2',
    courseName: 'Physics - Grade 11 (IIT-JEE Foundation)',
    batch: 'Evening - Batch B (04:30 PM)',
    totalFees: 25000,
    feesPaid: 15000,
    feesDue: 10000,
    status: 'Active',
    notes: 'Requires practice with mechanics problems.'
  },
  {
    id: 's3',
    rollNumber: 'EL-2026-003',
    name: 'Rohan Verma',
    email: 'rohan.verma@example.com',
    phone: '9123456780',
    parentName: 'Sanjay Verma',
    parentPhone: '9123456781',
    enrollmentDate: '2026-02-01',
    courseId: 'c3',
    courseName: 'Chemistry - Grade 12 (Board + NEET)',
    batch: 'Evening - Batch A (06:00 PM)',
    totalFees: 22000,
    feesPaid: 10000,
    feesDue: 12000,
    status: 'Active',
    notes: 'Strong in organic chemistry. Parent requested bi-weekly feedback.'
  },
  {
    id: 's4',
    rollNumber: 'EL-2026-004',
    name: 'Ananya Rao',
    email: 'ananya.rao@example.com',
    phone: '9988776655',
    parentName: 'Prasad Rao',
    parentPhone: '9988776654',
    enrollmentDate: '2026-02-05',
    courseId: 'c1',
    courseName: 'Mathematics - Grade 10 (Advanced)',
    batch: 'Morning - Batch A (08:00 AM)',
    totalFees: 15000,
    feesPaid: 5000,
    feesDue: 10000,
    status: 'Active',
    notes: 'Attentive, asks good questions.'
  },
  {
    id: 's5',
    rollNumber: 'EL-2026-005',
    name: 'Kabir Malhotra',
    email: 'kabir.m@example.com',
    phone: '9765432109',
    parentName: 'Vikram Malhotra',
    parentPhone: '9765432108',
    enrollmentDate: '2026-03-01',
    courseId: 'c4',
    courseName: 'Computer Science - Python Bootcamp',
    batch: 'Weekend - Batch A (10:00 AM)',
    totalFees: 8000,
    feesPaid: 8000,
    feesDue: 0,
    status: 'Active',
    notes: 'Already has basic JS knowledge, fast learner.'
  },
  {
    id: 's6',
    rollNumber: 'EL-2026-006',
    name: 'Siddharth Sen',
    email: 'sid.sen@example.com',
    phone: '9543210987',
    parentName: 'Amit Sen',
    parentPhone: '9543210986',
    enrollmentDate: '2026-03-10',
    courseId: 'c2',
    courseName: 'Physics - Grade 11 (IIT-JEE Foundation)',
    batch: 'Evening - Batch B (04:30 PM)',
    totalFees: 25000,
    feesPaid: 0,
    feesDue: 25000,
    status: 'Active',
    notes: 'Deferred first installment payment due to medical emergency.'
  },
  {
    id: 's7',
    rollNumber: 'EL-2026-007',
    name: 'Meera Nair',
    email: 'meera.nair@example.com',
    phone: '9432109876',
    parentName: 'Gopal Nair',
    parentPhone: '9432109875',
    enrollmentDate: '2026-04-01',
    courseId: 'c5',
    courseName: 'English Literature & Grammar',
    batch: 'Morning - Batch B (10:00 AM)',
    totalFees: 6000,
    feesPaid: 6000,
    feesDue: 0,
    status: 'Completed',
    notes: 'Course completed. Scored 94% in final test.'
  },
  {
    id: 's8',
    rollNumber: 'EL-2026-008',
    name: 'Dev Bajwa',
    email: 'dev.bajwa@example.com',
    phone: '9321098765',
    parentName: 'Harbhajan Singh',
    parentPhone: '9321098764',
    enrollmentDate: '2026-04-12',
    courseId: 'c3',
    courseName: 'Chemistry - Grade 12 (Board + NEET)',
    batch: 'Evening - Batch A (06:00 PM)',
    totalFees: 22000,
    feesPaid: 12000,
    feesDue: 10000,
    status: 'Active',
    notes: 'Good performance in lab sessions.'
  },
  {
    id: 's9',
    rollNumber: 'EL-2026-009',
    name: 'Zara Khan',
    email: 'zara.khan@example.com',
    phone: '9210987654',
    parentName: 'Javed Khan',
    parentPhone: '9210987653',
    enrollmentDate: '2026-05-01',
    courseId: 'c4',
    courseName: 'Computer Science - Python Bootcamp',
    batch: 'Weekend - Batch A (10:00 AM)',
    totalFees: 8000,
    feesPaid: 4000,
    feesDue: 4000,
    status: 'Active',
    notes: 'Requires extra support with loop constructs.'
  },
  {
    id: 's10',
    rollNumber: 'EL-2026-010',
    name: 'Aryan Joshi',
    email: 'aryan.joshi@example.com',
    phone: '9109876543',
    parentName: 'Manoj Joshi',
    parentPhone: '9109876542',
    enrollmentDate: '2026-05-15',
    courseId: 'c5',
    courseName: 'English Literature & Grammar',
    batch: 'Morning - Batch B (10:00 AM)',
    totalFees: 6000,
    feesPaid: 0,
    feesDue: 6000,
    status: 'Inactive',
    notes: 'Withdrew early due to relocation. Refund not applicable.'
  }
];

const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'p1',
    receiptNumber: 'REC-2026-001',
    studentId: 's1',
    studentName: 'Aarav Sharma',
    courseName: 'Mathematics - Grade 10 (Advanced)',
    amount: 10000,
    paymentDate: '2026-01-10',
    paymentMethod: 'UPI',
    transactionId: 'TXN876543210',
    remarks: 'Admission fee & Part 1 payment'
  },
  {
    id: 'p2',
    receiptNumber: 'REC-2026-002',
    studentId: 's1',
    studentName: 'Aarav Sharma',
    courseName: 'Mathematics - Grade 10 (Advanced)',
    amount: 5000,
    paymentDate: '2026-03-10',
    paymentMethod: 'Cash',
    remarks: 'Final installment payment'
  },
  {
    id: 'p3',
    receiptNumber: 'REC-2026-003',
    studentId: 's2',
    studentName: 'Isha Patel',
    courseName: 'Physics - Grade 11 (IIT-JEE Foundation)',
    amount: 15000,
    paymentDate: '2026-01-15',
    paymentMethod: 'Card',
    transactionId: 'TXN998877665',
    remarks: 'First installment payment'
  },
  {
    id: 'p4',
    receiptNumber: 'REC-2026-004',
    studentId: 's3',
    studentName: 'Rohan Verma',
    courseName: 'Chemistry - Grade 12 (Board + NEET)',
    amount: 10000,
    paymentDate: '2026-02-01',
    paymentMethod: 'Net Banking',
    transactionId: 'TXN112233445',
    remarks: 'Initial token fee'
  },
  {
    id: 'p5',
    receiptNumber: 'REC-2026-005',
    studentId: 's4',
    studentName: 'Ananya Rao',
    courseName: 'Mathematics - Grade 10 (Advanced)',
    amount: 5000,
    paymentDate: '2026-02-05',
    paymentMethod: 'UPI',
    transactionId: 'TXN445566778',
    remarks: 'Part payment'
  },
  {
    id: 'p6',
    receiptNumber: 'REC-2026-006',
    studentId: 's5',
    studentName: 'Kabir Malhotra',
    courseName: 'Computer Science - Python Bootcamp',
    amount: 8000,
    paymentDate: '2026-03-01',
    paymentMethod: 'UPI',
    transactionId: 'TXN223344556',
    remarks: 'Full course fee payment'
  },
  {
    id: 'p7',
    receiptNumber: 'REC-2026-007',
    studentId: 's7',
    studentName: 'Meera Nair',
    courseName: 'English Literature & Grammar',
    amount: 6000,
    paymentDate: '2026-04-01',
    paymentMethod: 'Cash',
    remarks: 'Full course fee paid at admission'
  },
  {
    id: 'p8',
    receiptNumber: 'REC-2026-008',
    studentId: 's8',
    studentName: 'Dev Bajwa',
    courseName: 'Chemistry - Grade 12 (Board + NEET)',
    amount: 12000,
    paymentDate: '2026-04-12',
    paymentMethod: 'Cheque',
    transactionId: 'CHQ-556677',
    remarks: 'Cheque cleared on April 15'
  },
  {
    id: 'p9',
    receiptNumber: 'REC-2026-009',
    studentId: 's9',
    studentName: 'Zara Khan',
    courseName: 'Computer Science - Python Bootcamp',
    amount: 4000,
    paymentDate: '2026-05-01',
    paymentMethod: 'UPI',
    transactionId: 'TXN889900112',
    remarks: 'First installment'
  }
];

const INITIAL_REMINDERS: Reminder[] = [
  {
    id: 'r1',
    studentId: 's2',
    studentName: 'Isha Patel',
    amountDue: 10000,
    sentDate: '2026-06-15 10:30 AM',
    type: 'WhatsApp',
    status: 'manual_opened'
  },
  {
    id: 'r2',
    studentId: 's3',
    studentName: 'Rohan Verma',
    amountDue: 12000,
    sentDate: '2026-06-15 10:32 AM',
    type: 'Email',
    status: 'manual_opened'
  },
  {
    id: 'r3',
    studentId: 's6',
    studentName: 'Siddharth Sen',
    amountDue: 25000,
    sentDate: '2026-06-20 11:15 AM',
    type: 'SMS',
    status: 'manual_opened'
  }
];

const INITIAL_INSTALLMENTS: Installment[] = [
  // s1
  { id: 'inst_s1_1', studentId: 's1', installmentNumber: 1, dueDate: '2026-01-10', amount: 10000, status: 'Paid', paymentId: 'p1', createdAt: '2026-01-10T00:00:00Z' },
  { id: 'inst_s1_2', studentId: 's1', installmentNumber: 2, dueDate: '2026-03-10', amount: 5000, status: 'Paid', paymentId: 'p2', createdAt: '2026-01-10T00:00:00Z' },
  // s2
  { id: 'inst_s2_1', studentId: 's2', installmentNumber: 1, dueDate: '2026-01-15', amount: 15000, status: 'Paid', paymentId: 'p3', createdAt: '2026-01-15T00:00:00Z' },
  { id: 'inst_s2_2', studentId: 's2', installmentNumber: 2, dueDate: '2026-04-15', amount: 5000, status: 'Overdue', paymentId: null, createdAt: '2026-01-15T00:00:00Z' },
  { id: 'inst_s2_3', studentId: 's2', installmentNumber: 3, dueDate: '2026-07-15', amount: 5000, status: 'Pending', paymentId: null, createdAt: '2026-01-15T00:00:00Z' },
  // s3
  { id: 'inst_s3_1', studentId: 's3', installmentNumber: 1, dueDate: '2026-02-01', amount: 10000, status: 'Paid', paymentId: 'p4', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'inst_s3_2', studentId: 's3', installmentNumber: 2, dueDate: '2026-05-01', amount: 6000, status: 'Overdue', paymentId: null, createdAt: '2026-02-01T00:00:00Z' },
  { id: 'inst_s3_3', studentId: 's3', installmentNumber: 3, dueDate: '2026-08-01', amount: 6000, status: 'Pending', paymentId: null, createdAt: '2026-02-01T00:00:00Z' },
  // s4
  { id: 'inst_s4_1', studentId: 's4', installmentNumber: 1, dueDate: '2026-02-05', amount: 5000, status: 'Paid', paymentId: 'p5', createdAt: '2026-02-05T00:00:00Z' },
  { id: 'inst_s4_2', studentId: 's4', installmentNumber: 2, dueDate: '2026-05-05', amount: 5000, status: 'Overdue', paymentId: null, createdAt: '2026-02-05T00:00:00Z' },
  { id: 'inst_s4_3', studentId: 's4', installmentNumber: 3, dueDate: '2026-08-05', amount: 5000, status: 'Pending', paymentId: null, createdAt: '2026-02-05T00:00:00Z' },
  // s5
  { id: 'inst_s5_1', studentId: 's5', installmentNumber: 1, dueDate: '2026-03-01', amount: 8000, status: 'Paid', paymentId: 'p6', createdAt: '2026-03-01T00:00:00Z' },
  // s6
  { id: 'inst_s6_1', studentId: 's6', installmentNumber: 1, dueDate: '2026-04-10', amount: 12500, status: 'Overdue', paymentId: null, createdAt: '2026-03-10T00:00:00Z' },
  { id: 'inst_s6_2', studentId: 's6', installmentNumber: 2, dueDate: '2026-07-10', amount: 12500, status: 'Pending', paymentId: null, createdAt: '2026-03-10T00:00:00Z' },
  // s7
  { id: 'inst_s7_1', studentId: 's7', installmentNumber: 1, dueDate: '2026-04-01', amount: 6000, status: 'Paid', paymentId: 'p7', createdAt: '2026-04-01T00:00:00Z' },
  // s8
  { id: 'inst_s8_1', studentId: 's8', installmentNumber: 1, dueDate: '2026-04-12', amount: 12000, status: 'Paid', paymentId: 'p8', createdAt: '2026-04-12T00:00:00Z' },
  { id: 'inst_s8_2', studentId: 's8', installmentNumber: 2, dueDate: '2026-07-12', amount: 10000, status: 'Pending', paymentId: null, createdAt: '2026-04-12T00:00:00Z' },
  // s9
  { id: 'inst_s9_1', studentId: 's9', installmentNumber: 1, dueDate: '2026-05-01', amount: 4000, status: 'Paid', paymentId: 'p9', createdAt: '2026-05-01T00:00:00Z' },
  { id: 'inst_s9_2', studentId: 's9', installmentNumber: 2, dueDate: '2026-08-01', amount: 4000, status: 'Pending', paymentId: null, createdAt: '2026-05-01T00:00:00Z' },
  // s10
  { id: 'inst_s10_1', studentId: 's10', installmentNumber: 1, dueDate: '2026-05-15', amount: 3000, status: 'Overdue', paymentId: null, createdAt: '2026-05-15T00:00:00Z' },
  { id: 'inst_s10_2', studentId: 's10', installmentNumber: 2, dueDate: '2026-08-15', amount: 3000, status: 'Pending', paymentId: null, createdAt: '2026-05-15T00:00:00Z' }
];

export interface Batch {
  id: string;
  courseId: string;
  name: string;
  timing: string;
  capacity: number;
  courseFee?: number;
  status: 'Active' | 'Inactive';
}

export const INITIAL_BATCHES: Batch[] = [
  { id: 'b1', courseId: 'c1', name: 'Morning - Batch A', timing: '08:00 AM - 10:00 AM', capacity: 20, status: 'Active' },
  { id: 'b2', courseId: 'c1', name: 'Evening - Batch B', timing: '04:00 PM - 06:00 PM', capacity: 15, status: 'Active' },
  { id: 'b3', courseId: 'c2', name: 'Evening - Batch C', timing: '06:00 PM - 08:00 PM', capacity: 25, status: 'Active' }
];

// Helper functions for Local Storage
export const getStoredValue = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored) as T;
  } catch {
    // A damaged or unavailable browser store should not prevent demo startup.
    return fallback;
  }
};

const getStoredArray = <T,>(key: string, fallback: T[]): T[] => {
  const stored = getStoredValue<unknown>(key, null);
  return Array.isArray(stored) ? stored as T[] : fallback;
};

export const getStoredData = () => ({
  courses: getStoredArray('eduledger_courses', INITIAL_COURSES),
  students: getStoredArray('eduledger_students', INITIAL_STUDENTS),
  payments: getStoredArray('eduledger_payments', INITIAL_PAYMENTS),
  reminders: getStoredArray('eduledger_reminders', INITIAL_REMINDERS),
  installments: getStoredArray('eduledger_installments', INITIAL_INSTALLMENTS),
  batches: getStoredArray('eduledger_batches', INITIAL_BATCHES),
});

export const saveStoredData = (data: {
  courses?: Course[];
  students?: Student[];
  payments?: Payment[];
  reminders?: Reminder[];
  installments?: Installment[];
  batches?: Batch[];
}) => {
  if (data.courses) localStorage.setItem('eduledger_courses', JSON.stringify(data.courses));
  if (data.students) localStorage.setItem('eduledger_students', JSON.stringify(data.students));
  if (data.payments) localStorage.setItem('eduledger_payments', JSON.stringify(data.payments));
  if (data.reminders) localStorage.setItem('eduledger_reminders', JSON.stringify(data.reminders));
  if (data.installments) localStorage.setItem('eduledger_installments', JSON.stringify(data.installments));
  if (data.batches) localStorage.setItem('eduledger_batches', JSON.stringify(data.batches));
};

export const resetToDefault = () => {
  localStorage.setItem('eduledger_courses', JSON.stringify(INITIAL_COURSES));
  localStorage.setItem('eduledger_students', JSON.stringify(INITIAL_STUDENTS));
  localStorage.setItem('eduledger_payments', JSON.stringify(INITIAL_PAYMENTS));
  localStorage.setItem('eduledger_reminders', JSON.stringify(INITIAL_REMINDERS));
  localStorage.setItem('eduledger_installments', JSON.stringify(INITIAL_INSTALLMENTS));
  localStorage.setItem('eduledger_batches', JSON.stringify(INITIAL_BATCHES));
  window.location.reload();
};

