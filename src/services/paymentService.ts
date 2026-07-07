import { supabase } from '../lib/supabase';
import { Payment } from '../types';
import { Student as UiStudent, Payment as UiPayment, getStoredData, saveStoredData } from '../data/mockData';

// Determine if we should use Supabase
const useSupabase = 
  !!import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project-id.supabase.co';

export const paymentService = {
  async getPayments(): Promise<Payment[]> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
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
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data as Payment[];
    } else {
      const all = await this.getPayments();
      return all.filter(p => p.student_id === studentId);
    }
  },

  async createPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('payments')
        .insert([payment])
        .select()
        .single();
      if (error) throw error;
      return data as Payment;
    } else {
      const newId = `p${Date.now()}`;
      const newPayment: Payment = {
        ...payment,
        id: newId,
        created_at: new Date().toISOString()
      };

      const mockData = getStoredData();
      const student = mockData.students.find((s: UiStudent) => s.id === payment.student_id);
      if (student) {
        const receiptNumber = `REC-2026-${String(mockData.payments.length + 1).padStart(3, '0')}`;
        const uiPayment: UiPayment = {
          id: newId,
          receiptNumber,
          studentId: payment.student_id,
          studentName: student.name,
          courseName: student.courseName,
          amount: payment.amount,
          paymentDate: payment.payment_date,
          paymentMethod: payment.payment_mode as UiPayment['paymentMethod'],
          transactionId: payment.remarks.includes('ID') ? payment.remarks.split('ID:')[1] : undefined,
          remarks: payment.remarks
        };

        const updatedFeesPaid = student.feesPaid + payment.amount;
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
          payments: [uiPayment, ...mockData.payments]
        });
      }

      return newPayment;
    }
  }
};
