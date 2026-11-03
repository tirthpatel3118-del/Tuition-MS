import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Batch } from '../types';
import { getStoredData, saveStoredData } from '../data/mockData';
import { requireActiveInstituteId } from '../lib/tenant';

const useSupabase = isSupabaseConfigured;

type BatchRow = {
  id: string;
  institute_id: string;
  course_id: string;
  name: string;
  timing: string;
  capacity: number;
  course_fee: number | null;
  status: 'Active' | 'Inactive';
};

function toUiBatch(row: BatchRow): Batch {
  return {
    id: row.id,
    courseId: row.course_id,
    name: row.name,
    timing: row.timing,
    capacity: row.capacity,
    courseFee: row.course_fee ?? undefined,
    status: row.status,
  };
}

export const batchService = {
  async getBatches(): Promise<Batch[]> {
    if (!useSupabase) return getStoredData().batches;

    const instituteId = requireActiveInstituteId();
    const { data, error } = await supabase
      .from('batches')
      .select('id, institute_id, course_id, name, timing, capacity, course_fee, status')
      .eq('institute_id', instituteId)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row: BatchRow) => toUiBatch(row));
  },

  async saveAllBatches(batches: Batch[]): Promise<Batch[]> {
    if (!useSupabase) {
      const mockData = getStoredData();
      saveStoredData({ ...mockData, batches });
      return batches;
    }

    const instituteId = requireActiveInstituteId();
    const rows = batches.map(batch => ({
      id: batch.id,
      institute_id: instituteId,
      course_id: batch.courseId,
      name: batch.name,
      timing: batch.timing,
      capacity: batch.capacity,
      course_fee: batch.courseFee ?? null,
      status: batch.status,
    }));
    const { error } = await supabase.from('batches').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    return batches;
  },

  async createBatch(batchData: Omit<Batch, 'id'>): Promise<Batch> {
    if (!useSupabase) {
      const newBatch = { ...batchData, id: `b${Date.now()}` };
      await this.saveAllBatches([...(await this.getBatches()), newBatch]);
      return newBatch;
    }

    const instituteId = requireActiveInstituteId();
    const { data, error } = await supabase
      .from('batches')
      .insert({
        institute_id: instituteId,
        course_id: batchData.courseId,
        name: batchData.name,
        timing: batchData.timing,
        capacity: batchData.capacity,
        course_fee: batchData.courseFee ?? null,
        status: batchData.status,
      })
      .select('id, institute_id, course_id, name, timing, capacity, course_fee, status')
      .single();
    if (error) throw error;
    return toUiBatch(data as BatchRow);
  },

  async updateBatch(id: string, updates: Partial<Batch>): Promise<Batch> {
    if (!useSupabase) {
      const batches = await this.getBatches();
      const found = batches.find(batch => batch.id === id);
      if (!found) throw new Error('Batch not found');
      const updatedBatch = { ...found, ...updates };
      await this.saveAllBatches(batches.map(batch => batch.id === id ? updatedBatch : batch));
      return updatedBatch;
    }

    const instituteId = requireActiveInstituteId();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.courseId !== undefined) dbUpdates.course_id = updates.courseId;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.timing !== undefined) dbUpdates.timing = updates.timing;
    if (updates.capacity !== undefined) dbUpdates.capacity = updates.capacity;
    if (updates.courseFee !== undefined) dbUpdates.course_fee = updates.courseFee;
    if (updates.status !== undefined) dbUpdates.status = updates.status;

    const { data, error } = await supabase
      .from('batches')
      .update(dbUpdates)
      .eq('id', id)
      .eq('institute_id', instituteId)
      .select('id, institute_id, course_id, name, timing, capacity, course_fee, status')
      .single();
    if (error) throw error;
    return toUiBatch(data as BatchRow);
  },

  async deleteBatch(id: string): Promise<void> {
    if (!useSupabase) {
      await this.saveAllBatches((await this.getBatches()).filter(batch => batch.id !== id));
      return;
    }

    const instituteId = requireActiveInstituteId();
    const { error } = await supabase
      .from('batches')
      .delete()
      .eq('id', id)
      .eq('institute_id', instituteId);
    if (error) throw error;
  },

  async getStudentBatches(): Promise<Record<string, string>> {
    if (!useSupabase) return JSON.parse(localStorage.getItem('eduledger_student_batches') || '{}');

    const instituteId = requireActiveInstituteId();
    const { data, error } = await supabase
      .from('students')
      .select('id, batch_id')
      .eq('institute_id', instituteId)
      .not('batch_id', 'is', null);
    if (error) throw error;
    return Object.fromEntries((data ?? []).flatMap((row: { id: string; batch_id: string | null }) =>
      row.batch_id ? [[row.id, row.batch_id]] : []
    ));
  },

  async saveStudentBatches(mapping: Record<string, string>): Promise<void> {
    if (!useSupabase) {
      localStorage.setItem('eduledger_student_batches', JSON.stringify(mapping));
      return;
    }

    const instituteId = requireActiveInstituteId();
    for (const [studentId, batchId] of Object.entries(mapping)) {
      const { error } = await supabase
        .from('students')
        .update({ batch_id: batchId })
        .eq('id', studentId)
        .eq('institute_id', instituteId);
      if (error) throw error;
    }
  },
};

