import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Installment } from '../types';
import { Installment as UiInstallment, getStoredData, saveStoredData } from '../data/mockData';
import { requireActiveInstituteId } from '../lib/tenant';

const useSupabase = isSupabaseConfigured;

export const installmentService = {
  async getInstallments(): Promise<Installment[]> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('installments')
        .select('*')
        .eq('institute_id', instituteId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data as Installment[];
    } else {
      const mockInstallments: UiInstallment[] = getStoredData().installments || [];
      return mockInstallments.map(i => ({
        id: i.id,
        student_id: i.studentId,
        installment_number: i.installmentNumber,
        due_date: i.dueDate,
        amount: i.amount,
        status: i.status,
        payment_id: i.paymentId || null,
        remarks: i.remarks || null,
        created_at: i.createdAt || new Date().toISOString()
      }));
    }
  },

  async getInstallmentsByStudentId(studentId: string): Promise<Installment[]> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('installments')
        .select('*')
        .eq('student_id', studentId)
        .eq('institute_id', instituteId)
        .order('installment_number', { ascending: true });
      if (error) throw error;
      return data as Installment[];
    } else {
      const all = await this.getInstallments();
      return all.filter(i => i.student_id === studentId);
    }
  },

  async createInstallments(installments: Omit<Installment, 'id' | 'created_at'>[]): Promise<Installment[]> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('installments')
        .insert(installments.map(installment => ({ ...installment, institute_id: instituteId })))
        .select();
      if (error) throw error;
      return data as Installment[];
    } else {
      const mockData = getStoredData();
      const newInstallments: Installment[] = [];
      const currentUiInstallments = [...(mockData.installments || [])];

      for (const inst of installments) {
        const newId = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const dbInst: Installment = {
          ...inst,
          id: newId,
          created_at: new Date().toISOString()
        };
        newInstallments.push(dbInst);

        const uiInst: UiInstallment = {
          id: newId,
          studentId: inst.student_id,
          installmentNumber: inst.installment_number,
          dueDate: inst.due_date,
          amount: inst.amount,
          status: inst.status,
          paymentId: inst.payment_id,
          remarks: inst.remarks || undefined,
          createdAt: dbInst.created_at
        };
        currentUiInstallments.push(uiInst);
      }

      saveStoredData({
        ...mockData,
        installments: currentUiInstallments
      });

      return newInstallments;
    }
  },

  async updateInstallment(id: string, updates: Partial<Installment>): Promise<Installment> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('installments')
        .update(updates)
        .eq('id', id)
        .eq('institute_id', instituteId)
        .select()
        .single();
      if (error) throw error;
      return data as Installment;
    } else {
      const all = await this.getInstallments();
      const found = all.find(i => i.id === id);
      if (!found) throw new Error('Installment not found');
      const updated = { ...found, ...updates };

      const mockData = getStoredData();
      const updatedUiInstallments = (mockData.installments || []).map((i: UiInstallment) => {
        if (i.id === id) {
          const merged = { ...i };
          if (updates.student_id) merged.studentId = updates.student_id;
          if (updates.installment_number !== undefined) merged.installmentNumber = updates.installment_number;
          if (updates.due_date) merged.dueDate = updates.due_date;
          if (updates.amount !== undefined) merged.amount = updates.amount;
          if (updates.status) merged.status = updates.status;
          if (updates.payment_id !== undefined) merged.paymentId = updates.payment_id;
          if (updates.remarks !== undefined) merged.remarks = updates.remarks || undefined;
          return merged;
        }
        return i;
      });

      saveStoredData({
        ...mockData,
        installments: updatedUiInstallments
      });

      return updated;
    }
  },

  async reconcilePendingInstallmentsByStudentId(
    studentId: string,
    desired: Array<{ installment_number: number; due_date: string; amount: number; remarks?: string | null }>
  ): Promise<void> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { error } = await supabase.rpc('reconcile_pending_installments_atomic', {
        p_institute_id: instituteId,
        p_student_id: studentId,
        p_desired_installments: desired,
      });
      if (error) throw error;
    } else {
      const mockData = getStoredData();
      const all: UiInstallment[] = mockData.installments || [];
      const desiredByNumber = new Map(desired.map(item => [item.installment_number, item]));
      const preserved = all.filter(item => item.studentId !== studentId || item.status !== 'Pending');
      const reconciled: UiInstallment[] = [];
      for (const item of all.filter(item => item.studentId === studentId && item.status === 'Pending')) {
        const replacement = desiredByNumber.get(item.installmentNumber);
        if (replacement) {
          reconciled.push({ ...item, dueDate: replacement.due_date, amount: replacement.amount, remarks: replacement.remarks ?? undefined });
          desiredByNumber.delete(item.installmentNumber);
        }
      }
      for (const item of desiredByNumber.values()) {
        reconciled.push({
          id: `inst_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          studentId,
          installmentNumber: item.installment_number,
          dueDate: item.due_date,
          amount: item.amount,
          status: 'Pending',
          remarks: item.remarks ?? undefined,
          createdAt: new Date().toISOString(),
        });
      }
      saveStoredData({ ...mockData, installments: [...preserved, ...reconciled] });
    }
  },

};
