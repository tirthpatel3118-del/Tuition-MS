import { supabase } from '../lib/supabase';
import { Receipt } from '../types';
import { Payment as UiPayment, getStoredData } from '../data/mockData';

// Determine if we should use Supabase
const useSupabase = 
  !!import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project-id.supabase.co';

export const receiptService = {
  async getReceipts(): Promise<Receipt[]> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .order('generated_at', { ascending: false });
      if (error) throw error;
      return data as Receipt[];
    } else {
      const mockPayments: UiPayment[] = getStoredData().payments;
      return mockPayments.map(p => ({
        id: `r-${p.id}`,
        payment_id: p.id,
        receipt_number: p.receiptNumber,
        generated_at: p.paymentDate
      }));
    }
  },

  async getReceiptByPaymentId(paymentId: string): Promise<Receipt> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('payment_id', paymentId)
        .single();
      if (error) throw error;
      return data as Receipt;
    } else {
      const all = await this.getReceipts();
      const found = all.find(r => r.payment_id === paymentId);
      if (!found) throw new Error('Receipt not found');
      return found;
    }
  },

  async createReceipt(receipt: Omit<Receipt, 'id' | 'generated_at'>): Promise<Receipt> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('receipts')
        .insert([receipt])
        .select()
        .single();
      if (error) throw error;
      return data as Receipt;
    } else {
      const newId = `rec-${Date.now()}`;
      const newReceipt: Receipt = {
        ...receipt,
        id: newId,
        generated_at: new Date().toISOString()
      };
      return newReceipt;
    }
  }
};
