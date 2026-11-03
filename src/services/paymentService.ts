import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Payment } from '../types';
import { Student as UiStudent, Payment as UiPayment, getStoredData, saveStoredData } from '../data/mockData';
import { requireActiveInstituteId } from '../lib/tenant';

const useSupabase = isSupabaseConfigured;

export const paymentService = {
  async getPayments(): Promise<Payment[]> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('institute_id', instituteId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data as Payment[];
    } else {
      const mockPayments: UiPayment[] = getStoredData().payments;
      return mockPayments.map(p => ({
        id: p.id,
        student_id: p.studentId,
        amount: p.amount,
        payment_mode: p.paymentMethod,
        payment_date: p.paymentDate,
        remarks: p.remarks || '',
        created_at: new Date().toISOString()
      }));
    }
  },

  async getPaymentsByStudentId(studentId: string): Promise<Payment[]> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', studentId)
        .eq('institute_id', instituteId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data as Payment[];
    } else {
      const all = await this.getPayments();
      return all.filter(p => p.student_id === studentId);
    }
  },

  async recordPaymentAtomic(input: {
    studentId: string;
    amount: number;
    paymentMode: string;
    paymentDate: string;
    installmentId: string;
    remarks: string;
    idempotencyKey: string;
  }): Promise<{ paymentId: string; receiptNumber: string }> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase.rpc('record_payment_atomic', {
        p_institute_id: instituteId,
        p_student_id: input.studentId,
        p_amount: input.amount,
        p_payment_mode: input.paymentMode,
        p_payment_date: input.paymentDate,
        p_allocations: [{ installment_id: input.installmentId, amount: input.amount }],
        p_remarks: input.remarks,
        p_idempotency_key: input.idempotencyKey,
      });
      if (error) throw error;
      if (!data || !['SUCCESS', 'EXISTING'].includes(data.status) || !data.payment_id || !data.receipt_number) {
        throw new Error('The payment gateway returned an incomplete result. Refresh and check the ledger before retrying.');
      }
      return { paymentId: String(data.payment_id), receiptNumber: String(data.receipt_number) };
    } else {
      const newId = `p${Date.now()}`;
      const mockData = getStoredData();
      const student = mockData.students.find((s: UiStudent) => s.id === input.studentId);
      if (student) {
        const receiptNumber = `REC-2026-${String(mockData.payments.length + 1).padStart(3, '0')}`;
        const uiPayment: UiPayment = {
          id: newId,
          receiptNumber,
          studentId: payment.student_id,
          studentName: student.name,
          courseName: student.courseName,
          amount: input.amount,
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMode as UiPayment['paymentMethod'],
          transactionId: input.remarks.includes('ID') ? input.remarks.split('ID:')[1] : undefined,
          remarks: input.remarks
        };

        const updatedFeesPaid = student.feesPaid + input.amount;
        const updatedStudents = mockData.students.map((s: UiStudent) => {
          if (s.id === student.id) {
            return {
              ...s,
              feesPaid: updatedFeesPaid,
              feesDue: Math.max(0, s.totalFees - updatedFeesPaid)
            };
          }
          return s;
        });

        saveStoredData({
          ...mockData,
          students: updatedStudents,
          installments: (mockData.installments || []).map(installment => installment.id === input.installmentId && input.amount >= installment.amount
            ? { ...installment, status: 'Paid' as const, paymentId: newId }
            : installment),
          payments: [uiPayment, ...mockData.payments]
        });
        return { paymentId: newId, receiptNumber };
      }
      throw new Error('Student not found in demo data.');
    }
  }
};

