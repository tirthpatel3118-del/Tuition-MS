import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Batch } from '../types';
import { getStoredData, getStoredValue, saveStoredData, setStoredValue } from '../data/mockData';
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

function toUiBatch(row: BatchRow, courseIds: string[] = []): Batch {
  return {
    id: row.id,
    courseId: row.course_id,
    courseIds: courseIds.length ? courseIds : [row.course_id],
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
    const rows = (data ?? []) as BatchRow[];
    const { data: mappings, error: mappingError } = await supabase
      .from('batch_courses')
      .select('batch_id, course_id')
      .eq('institute_id', instituteId);
    if (mappingError) throw mappingError;
    const courseIdsByBatch = new Map<string, string[]>();
    for (const mapping of mappings ?? []) {
      const current = courseIdsByBatch.get(mapping.batch_id) ?? [];
      current.push(mapping.course_id);
      courseIdsByBatch.set(mapping.batch_id, current);
    }
    return rows.map(row => toUiBatch(row, courseIdsByBatch.get(row.id) ?? [row.course_id]));
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
    for (const batch of batches) {
      const courseIds = batch.courseIds?.length ? batch.courseIds : [batch.courseId];
      const { error: deleteError } = await supabase.from('batch_courses').delete().eq('institute_id', instituteId).eq('batch_id', batch.id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from('batch_courses').insert(courseIds.map(course_id => ({ institute_id: instituteId, batch_id: batch.id, course_id })));
      if (insertError) throw insertError;
    }
    return batches;
  },

  async createBatch(batchData: Omit<Batch, 'id'>): Promise<Batch> {
    if (!useSupabase) {
      const courseIds = batchData.courseIds?.length ? batchData.courseIds : [batchData.courseId];
      const newBatch = { ...batchData, courseId: batchData.courseId || courseIds[0], courseIds, id: `b${Date.now()}` };
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
    const courseIds = batchData.courseIds?.length ? batchData.courseIds : [batchData.courseId];
    const { error: mappingError } = await supabase.from('batch_courses').insert(courseIds.map(course_id => ({ institute_id: instituteId, batch_id: data.id, course_id })));
    if (mappingError) {
      await supabase.from('batches').delete().eq('id', data.id).eq('institute_id', instituteId);
      throw mappingError;
    }
    return toUiBatch(data as BatchRow, courseIds);
  },

  async updateBatch(id: string, updates: Partial<Batch>): Promise<Batch> {
    if (!useSupabase) {
      const batches = await this.getBatches();
      const found = batches.find(batch => batch.id === id);
      if (!found) throw new Error('Batch not found');
      const updatedBatch = { ...found, ...updates, courseIds: updates.courseIds ?? found.courseIds ?? [found.courseId] };
      await this.saveAllBatches(batches.map(batch => batch.id === id ? updatedBatch : batch));
      return updatedBatch;
    }

    const instituteId = requireActiveInstituteId();
    const dbUpdates: Record<string, unknown> = {};
    const selectedCourseIds = updates.courseIds?.length ? updates.courseIds : (updates.courseId ? [updates.courseId] : undefined);
    if (selectedCourseIds?.length) dbUpdates.course_id = selectedCourseIds[0];
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
    if (selectedCourseIds) {
      const { error: deleteError } = await supabase.from('batch_courses').delete().eq('institute_id', instituteId).eq('batch_id', id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from('batch_courses').insert(selectedCourseIds.map(course_id => ({ institute_id: instituteId, batch_id: id, course_id })));
      if (insertError) throw insertError;
    }
    return toUiBatch(data as BatchRow, selectedCourseIds ?? [data.course_id]);
  },

  async removeCourseFromBatch(batchId: string, courseId: string): Promise<Batch> {
    const batches = await this.getBatches();
    const batch = batches.find(item => item.id === batchId);
    if (!batch) throw new Error('Batch not found');

    const currentCourseIds = batch.courseIds?.length ? batch.courseIds : [batch.courseId];
    if (!currentCourseIds.includes(courseId)) throw new Error('This course is not assigned to the batch');
    if (currentCourseIds.length <= 1) {
      throw new Error('A batch must remain assigned to at least one course. Add another course before removing this one.');
    }

    const nextCourseIds = currentCourseIds.filter(id => id !== courseId);
    if (!useSupabase) {
      const updated = { ...batch, courseIds: nextCourseIds, courseId: nextCourseIds[0] };
      await this.saveAllBatches(batches.map(item => item.id === batchId ? updated : item));
      return updated;
    }

    const instituteId = requireActiveInstituteId();
    const { data, error } = await supabase
      .from('batch_courses')
      .delete()
      .eq('institute_id', instituteId)
      .eq('batch_id', batchId)
      .eq('course_id', courseId)
      .select('course_id');
    if (error) throw error;
    if (!data?.length) throw new Error('The course-to-batch assignment was not removed. Refresh and try again.');

    return { ...batch, courseIds: nextCourseIds, courseId: nextCourseIds[0] };
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
    if (!useSupabase) {
      const stored = getStoredValue<unknown>('eduledger_student_batches', {});
      return stored && typeof stored === 'object' && !Array.isArray(stored)
        ? stored as Record<string, string>
        : {};
    }

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
      setStoredValue('eduledger_student_batches', mapping);
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

