import { supabase } from '../lib/supabase';
import { Batch } from '../types';
import { getStoredData, saveStoredData } from '../data/mockData';

const useSupabase = 
  !!import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project-id.supabase.co';

export const batchService = {
  async getBatches(): Promise<Batch[]> {
    if (useSupabase) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'batches')
          .maybeSingle();

        if (error) {
          console.warn('Failed to fetch batches from Supabase, falling back to local.', error);
          return getStoredData().batches;
        }

        if (data && data.value) {
          return data.value as Batch[];
        }

        // Initialize if empty
        const initial = getStoredData().batches;
        await this.saveAllBatches(initial);
        return initial;
      } catch (err) {
        console.warn('Error reading batches from database:', err);
        return getStoredData().batches;
      }
    } else {
      return getStoredData().batches;
    }
  },

  async saveAllBatches(batches: Batch[]): Promise<Batch[]> {
    const mockData = getStoredData();
    saveStoredData({
      ...mockData,
      batches
    });

    if (useSupabase) {
      try {
        const { error } = await supabase
          .from('settings')
          .upsert({
            key: 'batches',
            value: batches,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('Failed to save batches to Supabase:', error);
        }
      } catch (err) {
        console.error('Database connection error saving batches:', err);
      }
    }

    return batches;
  },

  async createBatch(batchData: Omit<Batch, 'id'>): Promise<Batch> {
    const batches = await this.getBatches();
    const newId = `b${Date.now()}`;
    const newBatch: Batch = {
      ...batchData,
      id: newId
    };

    const updated = [...batches, newBatch];
    await this.saveAllBatches(updated);
    return newBatch;
  },

  async updateBatch(id: string, updates: Partial<Batch>): Promise<Batch> {
    const batches = await this.getBatches();
    const found = batches.find(b => b.id === id);
    if (!found) throw new Error('Batch not found');

    const updatedBatch = { ...found, ...updates };
    const updated = batches.map(b => b.id === id ? updatedBatch : b);
    await this.saveAllBatches(updated);
    return updatedBatch;
  },

  async deleteBatch(id: string): Promise<void> {
    const batches = await this.getBatches();
    const updated = batches.filter(b => b.id !== id);
    await this.saveAllBatches(updated);
  },

  async getStudentBatches(): Promise<Record<string, string>> {
    if (useSupabase) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'student_batches')
          .maybeSingle();

        if (error) {
          console.warn('Failed to fetch student batches from Supabase, falling back to local.', error);
          return JSON.parse(localStorage.getItem('eduledger_student_batches') || '{}');
        }

        if (data && data.value) {
          return data.value as Record<string, string>;
        }

        return {};
      } catch (err) {
        console.warn('Error reading student batches from database:', err);
        return JSON.parse(localStorage.getItem('eduledger_student_batches') || '{}');
      }
    } else {
      return JSON.parse(localStorage.getItem('eduledger_student_batches') || '{}');
    }
  },

  async saveStudentBatches(mapping: Record<string, string>): Promise<void> {
    localStorage.setItem('eduledger_student_batches', JSON.stringify(mapping));

    if (useSupabase) {
      try {
        const { error } = await supabase
          .from('settings')
          .upsert({
            key: 'student_batches',
            value: mapping,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('Failed to save student batches to Supabase:', error);
        }
      } catch (err) {
        console.error('Database connection error saving student batches:', err);
      }
    }
  }
};
