import React, { createContext, useContext, useState, useEffect } from 'react';
import { Course, Student, Payment, Reminder, Installment, getStoredData, setStoredValue } from '../data/mockData';
import { ToastMessage, ToastContainer } from '../components/Toast';
import { ConfirmConfig, ConfirmationDialog } from '../components/ConfirmationDialog';

// Import service layers
import { studentService } from '../services/studentService';
import { paymentService } from '../services/paymentService';
import { courseService } from '../services/courseService';
import { installmentService } from '../services/installmentService';
import { receiptService } from '../services/receiptService';
import { isSupabaseConfigured } from '../lib/supabase';
import { getActiveInstituteId } from '../lib/tenant';
import { formatLocalDateInput } from '../lib/date';

import { AppSettings, Batch } from '../types';
import { settingsService, DEFAULT_SETTINGS } from '../services/settingsService';
import { batchService } from '../services/batchService';
import { reminderService } from '../services/reminderService';

interface DataContextType {
  courses: Course[];
  students: Student[];
  payments: Payment[];
  reminders: Reminder[];
  installments: Installment[];
  installmentPaidTotals: Record<string, number>;
  batches: Batch[];
  settings: AppSettings;
  updateSettings: (newSettings: AppSettings) => Promise<void>;
  addStudent: (
    student: Omit<Student, 'id' | 'rollNumber' | 'feesPaid' | 'feesDue' | 'courseName'>,
    installments: Omit<Installment, 'id' | 'studentId' | 'createdAt'>[]
  ) => Student;
  updateStudent: (
    id: string,
    updatedFields: Partial<Student>,
    installments?: Omit<Installment, 'id' | 'studentId' | 'createdAt'>[]
  ) => void;
  deleteStudent: (id: string) => void;
  recordPayment: (
    payment: Omit<Payment, 'id' | 'receiptNumber' | 'studentName' | 'courseName' | 'paymentDate'>,
    installmentId?: string
  ) => Promise<Payment>;
  addCourse: (course: Omit<Course, 'id'>) => void;
  deleteCourse: (id: string) => Promise<boolean>;
  addBatch: (batchData: Omit<Batch, 'id'>) => Promise<void>;
  updateBatch: (id: string, updates: Partial<Batch>) => Promise<void>;
  deleteBatch: (id: string) => Promise<boolean>;
  sendReminder: (studentId: string, type: 'WhatsApp' | 'SMS' | 'Email', installmentId?: string) => Promise<void>;
  sendBulkReminders: (installmentIds: string[], type: 'WhatsApp' | 'SMS' | 'Email') => Promise<void>;
  
  // UI helper functions
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
  confirmConfig: ConfirmConfig;
  confirmAction: (config: Omit<ConfirmConfig, 'isOpen'>) => void;
  closeDialog: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);
const pendingPaymentIdempotencyKeys = new Map<string, string>();

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<{
    courses: Course[];
    students: Student[];
    payments: Payment[];
    reminders: Reminder[];
    installments: Installment[];
  }>(() => isSupabaseConfigured
    ? { courses: [], students: [], payments: [], reminders: [], installments: [] }
    : getStoredData());

  const [batches, setBatches] = useState<Batch[]>([]);
  const [installmentPaidTotals, setInstallmentPaidTotals] = useState<Record<string, number>>({});

  // Toast UI state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [settings, setSettings] = useState<AppSettings>(() => isSupabaseConfigured
    ? DEFAULT_SETTINGS
    : settingsService.getLocalSettings());

  const updateSettings = async (newSettings: AppSettings) => {
    try {
      const updated = await settingsService.saveSettings(newSettings);
      setSettings(updated);
      showToast('Settings saved successfully', 'success');
    } catch (err) {
      console.error('Failed to save settings:', err);
      showToast('Failed to save settings to database', 'error');
    }
  };

  // Confirmation dialog UI state
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {},
  });

  // Function to refresh data from Supabase backend or mock service fallback
  const refreshDataFromBackend = async () => {
    try {
      const [dbCourses, dbStudents, dbPayments, dbInstallments, dbReceipts, dbSettings, dbBatches, dbStudentBatches, dbCourseFees, dbReminders] = await Promise.all([
        courseService.getCourses(),
        studentService.getStudents(),
        paymentService.getPayments(),
        installmentService.getInstallments(),
        receiptService.getReceipts(),
        settingsService.getSettings(),
        batchService.getBatches(),
        batchService.getStudentBatches(),
        settingsService.getCourseFees(),
        reminderService.getReminders()
      ]);
      const allocationTotals = await paymentService.getAllocationTotals(dbInstallments);
      const paidByStudent = allocationTotals.byStudent;
      setInstallmentPaidTotals(allocationTotals.byInstallment);

      if (dbSettings) {
        setSettings(dbSettings);
      }

      if (dbBatches) {
        setBatches(dbBatches);
      }

      // Map DB courses to UI models using saved course fees
      const mappedCourses: Course[] = dbCourses.map(c => ({
        id: c.id,
        name: c.course_name,
        fees: dbCourseFees?.[c.id] ?? c.course_fee ?? null,
        duration: `${c.duration_months} Months`,
        subject: c.course_name.split(' ')[0] || 'General'
      }));

      // Map DB students to UI models incorporating their assigned batch
      const mappedStudents: Student[] = dbStudents.map(s => {
        const course = mappedCourses.find(c => c.id === s.course_id);
        const batchId = dbStudentBatches?.[s.id] || '';
        const batchObj = (dbBatches || []).find(b => b.id === batchId);
        return {
          id: s.id,
          rollNumber: s.roll_number,
          name: s.full_name,
          email: s.email || '',
          phone: s.student_mobile,
          parentName: s.parent_name,
          parentPhone: s.parent_whatsapp,
          enrollmentDate: s.admission_date,
          courseId: s.course_id,
          courseName: course ? course.name : 'Unknown Course',
          batchId: batchId,
          batch: batchObj ? `${batchObj.name} (${batchObj.timing})` : (s.batch || 'Unassigned Batch'),
          totalFees: Number(s.course_fee),
          feesPaid: paidByStudent[s.id] ?? 0,
          feesDue: Math.max(0, Number(s.course_fee) - (paidByStudent[s.id] ?? 0)),
          status: s.status
        };
      });

      // Map DB payments to UI models
      const mappedPayments: Payment[] = dbPayments.map(p => {
        const student = mappedStudents.find(s => s.id === p.student_id);
        const receipt = dbReceipts.find(r => r.payment_id === p.id);
        return {
          id: p.id,
          receiptNumber: receipt ? receipt.receipt_number : `REC-2026-${p.id.substring(0, 4)}`,
          studentId: p.student_id,
          studentName: student ? student.name : 'Unknown Student',
          courseName: student ? student.courseName : 'Unknown Course',
          amount: Number(p.amount),
          paymentDate: p.payment_date,
          paymentMethod: p.payment_mode as any,
          transactionId: p.remarks && p.remarks.startsWith('TXN') ? p.remarks : undefined,
          remarks: p.remarks
        };
      });

      // Map DB installments to UI models
      const mappedInstallments: Installment[] = dbInstallments.map(i => ({
        id: i.id,
        studentId: i.student_id,
        installmentNumber: i.installment_number,
        dueDate: i.due_date,
        amount: Number(i.amount),
        status: i.status,
        paymentId: i.payment_id,
        remarks: i.remarks || undefined,
        createdAt: i.created_at
      }));

      const mappedReminders: Reminder[] = dbReminders.map(reminder => ({
        ...reminder,
        studentName: mappedStudents.find(student => student.id === reminder.studentId)?.name ?? 'Unknown Student',
      }));

      setData(prev => ({
        ...prev,
        courses: mappedCourses,
        students: mappedStudents,
        payments: mappedPayments,
        installments: mappedInstallments,
        reminders: mappedReminders,
      }));
    } catch (err: any) {
      console.error('Failed to load data from backend:', err);
      showToast('Could not refresh institute records. The latest database state is unconfirmed; retry before making changes.', 'warning');
    }
  };

  useEffect(() => {
    refreshDataFromBackend();
  }, []);

  // Save reminders to local storage whenever they change
  useEffect(() => {
    if (!isSupabaseConfigured) setStoredValue('eduledger_reminders', data.reminders);
  }, [data.reminders]);

  // Toast helpers
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random().toString().substring(2, 6);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    const warnStorageUnavailable = () => {
      showToast('Browser storage is unavailable. Demo changes will stay only until this tab closes or reloads.', 'warning');
    };
    window.addEventListener('eduledger:storage-unavailable', warnStorageUnavailable);
    return () => window.removeEventListener('eduledger:storage-unavailable', warnStorageUnavailable);
  }, []);

  // Dialog helpers
  const confirmAction = (config: Omit<ConfirmConfig, 'isOpen'>) => {
    setConfirmConfig({
      ...config,
      isOpen: true,
    });
  };

  const closeDialog = () => {
    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
  };

  // Calculate dynamic feesPaid and feesDue for all students based on payment history
  const studentsWithFees = data.students.map(s => {
    const studentPayments = data.payments.filter(p => p.studentId === s.id);
    const feesPaid = studentPayments.reduce((sum, p) => sum + p.amount, 0);
    return {
      ...s,
      feesPaid,
      feesDue: Math.max(0, s.totalFees - feesPaid)
    };
  });

  const addStudent = (
    studentData: Omit<Student, 'id' | 'rollNumber' | 'feesPaid' | 'feesDue' | 'courseName'>,
    installmentsData: Omit<Installment, 'id' | 'studentId' | 'createdAt'>[]
  ) => {
    const course = data.courses.find(c => c.id === studentData.courseId);
    const courseName = course ? course.name : 'Unknown Course';
    const totalFees = studentData.totalFees;

    // Generate optimistic parameters
    const year = new Date().getFullYear();
    const count = data.students.length + 1;
    const rollNumber = `EL-${year}-${String(count).padStart(3, '0')}`;
    const localId = `s${Date.now()}`;

    const newStudent: Student = {
      ...studentData,
      id: localId,
      rollNumber,
      courseName,
      feesPaid: 0,
      feesDue: totalFees,
    };

    const newInstallments: Installment[] = installmentsData.map((inst, index) => ({
      ...inst,
      id: `inst_${localId}_${index + 1}_${Date.now()}`,
      studentId: localId,
      createdAt: new Date().toISOString()
    }));

    // Optimistically update local React state
    setData(prev => ({
      ...prev,
      students: [newStudent, ...prev.students],
      installments: [...(prev.installments || []), ...newInstallments]
    }));

    // Perform database operations asynchronously
    (async () => {
      try {
        const dbStudent = await studentService.createStudent({
          roll_number: rollNumber,
          full_name: studentData.name,
          parent_name: studentData.parentName,
          parent_whatsapp: studentData.parentPhone,
          student_mobile: studentData.phone,
          email: studentData.email,
          address: 'Default Center Address',
          course_id: studentData.courseId,
          admission_date: studentData.enrollmentDate,
          course_fee: studentData.totalFees,
          discount: 0,
          status: studentData.status
        }, studentData.batch);

        // Save batch mapping
        if (studentData.batch) {
          const batchObj = batches.find(b => b.id === studentData.batch || `${b.name} (${b.timing})` === studentData.batch || b.name === studentData.batch);
          if (batchObj) {
            const currentMappings = await batchService.getStudentBatches();
            currentMappings[dbStudent.id] = batchObj.id;
            await batchService.saveStudentBatches(currentMappings);
          }
        }

        if (newInstallments.length > 0) {
          await installmentService.createInstallments(
            newInstallments.map(inst => ({
              student_id: dbStudent.id,
              installment_number: inst.installmentNumber,
              due_date: inst.dueDate,
              amount: inst.amount,
              status: inst.status,
              payment_id: null,
              remarks: inst.remarks || null
            }))
          );
        }

        await refreshDataFromBackend();
      } catch (err: any) {
        showToast(`Database Sync Error: ${err.message || err}`, 'error');
        await refreshDataFromBackend();
      }
    })();

    return newStudent;
  };

  const updateStudent = (
    id: string,
    updatedFields: Partial<Student>,
    installmentsData?: Omit<Installment, 'id' | 'studentId' | 'createdAt'>[]
  ) => {
    // Optimistically update React state
    setData(prev => {
      const updatedStudents = prev.students.map(student => {
        if (student.id === id) {
          const merged = { ...student, ...updatedFields };
          if (updatedFields.courseId) {
            const course = prev.courses.find(c => c.id === updatedFields.courseId);
            merged.courseName = course ? course.name : student.courseName;
          }
          return merged;
        }
        return student;
      });

      let updatedInstallments = prev.installments || [];
      if (installmentsData) {
        const protectedInstallments = updatedInstallments.filter(inst => inst.studentId === id && inst.status !== 'Pending');
        const pendingByNumber = new Map(updatedInstallments
          .filter(inst => inst.studentId === id && inst.status === 'Pending')
          .map(inst => [inst.installmentNumber, inst]));
        const otherStudentsInstallments = updatedInstallments.filter(inst => inst.studentId !== id);

        const newInstallments: Installment[] = installmentsData
          .filter(inst => inst.status === 'Pending')
          .map((inst: any, index) => ({
            ...inst,
            id: pendingByNumber.get(inst.installmentNumber)?.id || inst.id || `inst_${id}_${index + 1}_${Date.now()}`,
            studentId: id,
            createdAt: inst.createdAt || new Date().toISOString()
          }));

        updatedInstallments = [...otherStudentsInstallments, ...protectedInstallments, ...newInstallments];
      }

      return {
        ...prev,
        students: updatedStudents,
        installments: updatedInstallments
      };
    });

    // Save to database asynchronously
    (async () => {
      try {
        const dbUpdates: Partial<any> = {};
        if (updatedFields.name) dbUpdates.full_name = updatedFields.name;
        if (updatedFields.email !== undefined) dbUpdates.email = updatedFields.email;
        if (updatedFields.phone) dbUpdates.student_mobile = updatedFields.phone;
        if (updatedFields.parentName) dbUpdates.parent_name = updatedFields.parentName;
        if (updatedFields.parentPhone) dbUpdates.parent_whatsapp = updatedFields.parentPhone;
        if (updatedFields.courseId) dbUpdates.course_id = updatedFields.courseId;
        if (updatedFields.totalFees !== undefined) dbUpdates.course_fee = updatedFields.totalFees;
        if (updatedFields.status) dbUpdates.status = updatedFields.status;

        if (Object.keys(dbUpdates).length > 0) {
          await studentService.updateStudent(id, dbUpdates, updatedFields.batch);
        }

        // Save batch mapping if modified
        if (updatedFields.batch !== undefined) {
          const batchObj = batches.find(b => b.id === updatedFields.batch || `${b.name} (${b.timing})` === updatedFields.batch || b.name === updatedFields.batch);
          const currentMappings = await batchService.getStudentBatches();
          if (batchObj) {
            currentMappings[id] = batchObj.id;
          } else {
            delete currentMappings[id];
          }
          await batchService.saveStudentBatches(currentMappings);
        }

        if (installmentsData) {
          await installmentService.reconcilePendingInstallmentsByStudentId(id, installmentsData
            .filter(inst => inst.status === 'Pending')
            .map(inst => ({
              installment_number: inst.installmentNumber,
              due_date: inst.dueDate,
              amount: inst.amount,
              remarks: inst.remarks || null,
            })));
        }

        await refreshDataFromBackend();
      } catch (err: any) {
        showToast(`Sync Error: ${err.message || err}`, 'error');
        await refreshDataFromBackend();
      }
    })();
  };

  const deleteStudent = (id: string) => {
    // Mark as inactive instead of permanent deletion
    setData(prev => ({
      ...prev,
      students: prev.students.map(s => s.id === id ? { ...s, status: 'Inactive' } : s)
    }));

    (async () => {
      try {
        await studentService.updateStudent(id, { status: 'Inactive' });
        showToast('Student profile deactivated (marked as Inactive)', 'success');
        await refreshDataFromBackend();
      } catch (err: any) {
        showToast(`Deactivation Error: ${err.message || err}`, 'error');
        await refreshDataFromBackend();
      }
    })();
  };

  const deleteCourse = async (id: string): Promise<boolean> => {
    const course = data.courses.find(c => c.id === id);
    if (!course) {
      showToast('Course not found', 'error');
      return false;
    }
    const enrolled = studentsWithFees.some(s => s.courseId === id);
    if (enrolled) {
      showToast(`Cannot delete course "${course.name}": Students are currently enrolled.`, 'error');
      return false;
    }

    try {
      await courseService.deleteCourse(id);
      setData(prev => ({
        ...prev,
        courses: prev.courses.filter(c => c.id !== id)
      }));
      showToast('Course deleted successfully', 'success');
      await refreshDataFromBackend();
      return true;
    } catch (err: any) {
      showToast(`Error deleting course: ${err.message || err}`, 'error');
      return false;
    }
  };

  const addBatch = async (batchData: Omit<Batch, 'id'>) => {
    try {
      const newBatch = await batchService.createBatch(batchData);
      setBatches(prev => [...prev, newBatch]);
      showToast('Batch created successfully', 'success');
      await refreshDataFromBackend();
    } catch (err: any) {
      showToast(`Error creating batch: ${err.message || err}`, 'error');
    }
  };

  const updateBatch = async (id: string, updates: Partial<Batch>) => {
    try {
      const updated = await batchService.updateBatch(id, updates);
      setBatches(prev => prev.map(b => b.id === id ? updated : b));
      showToast('Batch updated successfully', 'success');
      await refreshDataFromBackend();
    } catch (err: any) {
      showToast(`Error updating batch: ${err.message || err}`, 'error');
    }
  };

  const deleteBatch = async (id: string): Promise<boolean> => {
    const batch = batches.find(b => b.id === id);
    if (!batch) {
      showToast('Batch not found', 'error');
      return false;
    }
    const enrolled = studentsWithFees.some(s => s.batchId === id || s.batch === batch.name || s.batch.includes(batch.name));
    if (enrolled) {
      showToast(`Cannot delete batch "${batch.name}": Students are currently enrolled.`, 'error');
      return false;
    }

    try {
      await batchService.deleteBatch(id);
      setBatches(prev => prev.filter(b => b.id !== id));
      showToast('Batch deleted successfully', 'success');
      await refreshDataFromBackend();
      return true;
    } catch (err: any) {
      showToast(`Error deleting batch: ${err.message || err}`, 'error');
      return false;
    }
  };

  const recordPayment = async (
    paymentData: Omit<Payment, 'id' | 'receiptNumber' | 'studentName' | 'courseName' | 'paymentDate'>,
    installmentId?: string
  ): Promise<Payment> => {
    const student = data.students.find(s => s.id === paymentData.studentId);
    if (!student) throw new Error('Student not found');

    if (isSupabaseConfigured && !installmentId) {
      throw new Error('Select an installment before recording a payment. Payments must be allocated to a fee installment.');
    }

    const paymentDate = formatLocalDateInput();
    const localReceiptNumber = `REC-${new Date().getFullYear()}-${String(data.payments.length + 1).padStart(4, '0')}`;
    const requestKey = [getActiveInstituteId() ?? 'demo', paymentData.studentId, installmentId ?? 'none', paymentData.amount].join(':');
    const storageKey = `eduledger.pendingPayment:${requestKey}`;
    let idempotencyKey: string | null = pendingPaymentIdempotencyKeys.get(storageKey) ?? null;
    if (!idempotencyKey) {
      try {
        idempotencyKey = sessionStorage.getItem(storageKey);
      } catch {
        // The in-memory map still supports retries in this tab.
      }
    }
    if (!idempotencyKey) {
      idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pendingPaymentIdempotencyKeys.set(storageKey, idempotencyKey);
      try {
        sessionStorage.setItem(storageKey, idempotencyKey);
      } catch {
        // The in-memory map keeps this key available for same-tab retries.
      }
    }

    const result = await paymentService.recordPaymentAtomic({
      studentId: paymentData.studentId,
      amount: paymentData.amount,
      paymentMode: paymentData.paymentMethod,
      paymentDate,
      installmentId: installmentId ?? '',
      remarks: [paymentData.remarks, paymentData.transactionId ? `Reference: ${paymentData.transactionId}` : ''].filter(Boolean).join(' | '),
      idempotencyKey,
    });
    pendingPaymentIdempotencyKeys.delete(storageKey);
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional after the request completes. */ }

    const newPayment: Payment = {
      ...paymentData,
      id: result.paymentId,
      receiptNumber: result.receiptNumber || localReceiptNumber,
      studentName: student.name,
      courseName: student.courseName,
      paymentDate,
    };
    await refreshDataFromBackend();
    return newPayment;
  };

  const addCourse = (courseData: Omit<Course, 'id'>) => {
    const localId = `c${Date.now()}`;
    const newCourse: Course = {
      ...courseData,
      id: localId
    };

    // Optimistically update React state
    setData(prev => ({
      ...prev,
      courses: [...prev.courses, newCourse]
    }));

    // Trigger DB creation
    (async () => {
      try {
        const dbCourse = await courseService.createCourse({
          course_name: courseData.name,
          batch_name: 'Morning - Batch A (08:00 AM)',
          duration_months: parseInt(courseData.duration) || 6,
          course_fee: courseData.fees
        });

        // Save course fee to settings
        const currentFees = await settingsService.getCourseFees();
        currentFees[dbCourse.id] = Number(courseData.fees);
        await settingsService.saveCourseFees(currentFees);

        showToast('Course created successfully', 'success');
        await refreshDataFromBackend();
      } catch (err: any) {
        showToast(`Course Sync Error: ${err.message || err}`, 'error');
        await refreshDataFromBackend();
      }
    })();
  };

  const sendReminder = async (studentId: string, type: 'WhatsApp' | 'SMS' | 'Email', installmentId?: string) => {
    const student = studentsWithFees.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found.');

    const installment = installmentId ? data.installments.find(item => item.id === installmentId) : undefined;
    if (installmentId && !installment) throw new Error('Installment not found.');
    const amountDue = installment
      ? Math.max(0, installment.amount - (installmentPaidTotals[installment.id] ?? 0))
      : student.feesDue;
    if (amountDue <= 0) throw new Error('This installment has no outstanding balance.');

    const newReminder = await reminderService.createReminder({
      studentId,
      amountDue,
      channel: type,
      status: 'manual_opened',
    });
    newReminder.studentName = student.name;

    setData(prev => ({
      ...prev,
      reminders: [newReminder, ...prev.reminders]
    }));
  };

  const sendBulkReminders = async (installmentIds: string[], type: 'WhatsApp' | 'SMS' | 'Email') => {
    const selected = installmentIds
      .map(id => data.installments.find(installment => installment.id === id))
      .filter((installment): installment is Installment => Boolean(installment && installment.status !== 'Paid'))
      .map(installment => ({
        installment,
        amountDue: Math.max(0, installment.amount - (installmentPaidTotals[installment.id] ?? 0)),
        student: studentsWithFees.find(student => student.id === installment.studentId),
      }))
      .filter((item): item is { installment: Installment; amountDue: number; student: Student } => Boolean(item.student && item.amountDue > 0));
    const created = await reminderService.createManyReminders(selected.map(({ student, amountDue }) => ({
      studentId: student.id,
      amountDue,
      channel: type,
      status: 'queued',
    })));
    const newReminders = created.map(reminder => ({
      ...reminder,
      studentName: selected.find(item => item.installment.studentId === reminder.studentId)?.student.name ?? 'Unknown Student',
    }));
    if (newReminders.length) setData(prev => ({ ...prev, reminders: [...newReminders, ...prev.reminders] }));
  };

  return (
    <DataContext.Provider value={{
      ...data,
      students: studentsWithFees,
      batches,
      installmentPaidTotals,
      settings,
      updateSettings,
      addStudent,
      updateStudent,
      deleteStudent,
      recordPayment,
      addCourse,
      deleteCourse,
      addBatch,
      updateBatch,
      deleteBatch,
      sendReminder,
      sendBulkReminders,
      toasts,
      showToast,
      removeToast,
      confirmConfig,
      confirmAction,
      closeDialog
    }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmationDialog config={confirmConfig} closeDialog={closeDialog} />
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

