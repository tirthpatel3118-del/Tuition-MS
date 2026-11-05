import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Receipt } from '../types';
import { Payment as UiPayment, getStoredData } from '../data/mockData';
import { requireActiveInstituteId } from '../lib/tenant';

const useSupabase = isSupabaseConfigured;

export const receiptService = {
  async getReceipts(): Promise<Receipt[]> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('institute_id', instituteId)
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
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('payment_id', paymentId)
        .eq('institute_id', instituteId)
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
};

