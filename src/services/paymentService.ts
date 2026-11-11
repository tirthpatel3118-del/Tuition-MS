import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Payment } from '../types';
import { Student as UiStudent, Installment as UiInstallment, Payment as UiPayment, getStoredData, saveStoredData } from '../data/mockData';
import { requireActiveInstituteId } from '../lib/tenant';

const useSupabase = isSupabaseConfigured;

export const paymentService = {
  async getAllocationTotals(_installments?: Array<{ id: string; student_id: string }>): Promise<{
    byStudent: Record<string, number>;
    byInstallment: Record<string, number>;
  }> {
    if (!useSupabase) {
      const stored = getStoredData();
      return {
        byStudent: Object.fromEntries((stored.students as UiStudent[]).map(student => [student.id, student.feesPaid])),
        // In demo storage, a partial payment is already reflected in the installment amount.
        byInstallment: {},
      };
    }

    const instituteId = requireActiveInstituteId();
    const [{ data: allocData, error: allocError }, { data: paymentsData, error: paymentsError }, { data: reversalsData, error: reversalsError }] = await Promise.all([
      supabase
        .from('payment_allocations')
        .select('installment_id, allocated_amount')
        .eq('institute_id', instituteId),
      supabase
        .from('payments')
        .select('id, student_id, amount, payment_type')
        .eq('institute_id', instituteId),
      supabase
        .from('payment_reversals')
        .select('original_payment_id')
        .eq('institute_id', instituteId),
    ]);
    if (allocError) throw allocError;
    if (paymentsError) throw paymentsError;
    if (reversalsError) throw reversalsError;

    const reversedPaymentIds = new Set((reversalsData ?? []).map((r: any) => r.original_payment_id));

    // Aggregate all confirmed non-reversed payments per student (direct payments + installment payments)
    const byStudent: Record<string, number> = {};
    for (const p of paymentsData ?? []) {
      if ((p as any).payment_type === 'PAYMENT' && !reversedPaymentIds.has((p as any).id)) {
        byStudent[p.student_id] = (byStudent[p.student_id] ?? 0) + Number(p.amount);
      }
    }

    // Aggregate paid totals per installment
    const byInstallment: Record<string, number> = {};
    for (const allocation of allocData ?? []) {
      const installmentId = allocation.installment_id;
      const amount = Number(allocation.allocated_amount);
      byInstallment[installmentId] = (byInstallment[installmentId] ?? 0) + amount;
    }
    return { byStudent, byInstallment };
  },

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
    installmentId?: string;
    remarks: string;
    idempotencyKey: string;
  }): Promise<{ paymentId: string; receiptNumber: string }> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const allocations = input.installmentId
        ? [{ installment_id: input.installmentId, amount: input.amount }]
        : [];
      const { data, error } = await supabase.rpc('record_payment_atomic', {
        p_institute_id: instituteId,
        p_student_id: input.studentId,
        p_amount: input.amount,
        p_payment_mode: input.paymentMode,
        p_payment_date: input.paymentDate,
        p_allocations: allocations,
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
        // 1. Idempotency check for demo mode (must precede balance check to allow legitimate retries)
        const existing = (mockData.payments as UiPayment[]).find(p => p.remarks?.includes(`IDEMP:${input.idempotencyKey}`));
        if (existing) {
          if (existing.amount !== input.amount) {
            throw new Error(`IDEMPOTENCY_CONFLICT: Idempotency key ${input.idempotencyKey} reused with mismatched payment payload.`);
          }
          return { paymentId: existing.id, receiptNumber: existing.receiptNumber };
        }

        // 2. Enforce overpayment protection in demo/mock mode for genuinely new payments
        if (input.amount > student.feesDue) {
          throw new Error(`Overpayment: Payment of ₹${input.amount.toLocaleString('en-IN')} exceeds remaining student balance of ₹${student.feesDue.toLocaleString('en-IN')}`);
        }

        const receiptNumber = `REC-${new Date().getFullYear()}-${String(mockData.payments.length + 1).padStart(4, '0')}`;
        const uiPayment: UiPayment = {
          id: newId,
          receiptNumber,
          studentId: input.studentId,
          studentName: student.name,
          courseName: student.courseName,
          amount: input.amount,
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMode as UiPayment['paymentMethod'],
          transactionId: input.remarks.includes('ID') ? input.remarks.split('ID:')[1] : undefined,
          remarks: `${input.remarks} | IDEMP:${input.idempotencyKey}`
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

        const updatedInstallments = input.installmentId
          ? ((mockData.installments || []) as UiInstallment[]).map(installment => {
              if (installment.id !== input.installmentId) return installment;
              if (input.amount >= installment.amount) return { ...installment, status: 'Paid' as const, paymentId: newId };
              return { ...installment, amount: installment.amount - input.amount };
            })
          : (mockData.installments || []);

        saveStoredData({
          ...mockData,
          students: updatedStudents,
          installments: updatedInstallments,
          payments: [uiPayment, ...mockData.payments]
        });
        return { paymentId: newId, receiptNumber };
      }
      throw new Error('Student not found in demo data.');
    }
  }
};
