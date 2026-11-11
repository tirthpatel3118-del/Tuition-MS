import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AppSettings } from '../types';
import { getStoredValue, setStoredValue } from '../data/mockData';
import { requireActiveInstituteId } from '../lib/tenant';
import { DEFAULT_INSTALLMENT_REMINDER_TEMPLATE, DEFAULT_DIRECT_REMINDER_TEMPLATE } from '../utils/reminderTemplate';

const useSupabase = isSupabaseConfigured;

export const DEFAULT_SETTINGS: AppSettings = {
  instituteName: 'EduLedger ERP',
  logoUrl: '',
  address: '',
  contactNumber: '',
  email: '',
  website: '',
  receiptPrefix: 'REC',
  receiptFooter: 'This is a computer generated receipt. Signature is not mandatory.',
  authorizedSignatureUrl: '',
  whatsappReminderTemplate: DEFAULT_INSTALLMENT_REMINDER_TEMPLATE,
  directFeeReminderTemplate: DEFAULT_DIRECT_REMINDER_TEMPLATE,
  currencySymbol: '₹',
  dateFormat: 'YYYY-MM-DD',
  timeZone: 'Asia/Kolkata'
};

const LOCAL_STORAGE_KEY = 'eduledger_settings';
const LOCAL_COURSE_FEES_KEY = 'eduledger_course_fees';

export const settingsService = {
  async getSettings(): Promise<AppSettings> {
    if (!useSupabase) return this.getLocalSettings();

    const instituteId = requireActiveInstituteId();
    const { data, error } = await supabase
      .from('institute_settings')
      .select('value')
      .eq('institute_id', instituteId)
      .eq('key', 'app_settings')
      .maybeSingle();
    if (error) throw error;
    return { ...DEFAULT_SETTINGS, ...(data?.value ?? {}) } as AppSettings;
  },

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    if (!useSupabase) {
      setStoredValue(LOCAL_STORAGE_KEY, settings);
      return settings;
    }

    const instituteId = requireActiveInstituteId();
    const { error } = await supabase
      .from('institute_settings')
      .upsert({
        institute_id: instituteId,
        key: 'app_settings',
        value: settings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'institute_id,key' });
    if (error) throw error;
    return settings;
  },

  getLocalSettings(): AppSettings {
    const stored = getStoredValue<unknown>(LOCAL_STORAGE_KEY, null);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      return { ...DEFAULT_SETTINGS, ...(stored as Partial<AppSettings>) };
    }
    return DEFAULT_SETTINGS;
  },

  async getCourseFees(): Promise<Record<string, number>> {
    if (!useSupabase) {
      const stored = getStoredValue<unknown>(LOCAL_COURSE_FEES_KEY, {});
      return stored && typeof stored === 'object' && !Array.isArray(stored)
        ? stored as Record<string, number>
        : {};
    }

    const instituteId = requireActiveInstituteId();
    const { data, error } = await supabase
      .from('courses')
      .select('id, course_fee')
      .eq('institute_id', instituteId);
    if (error) throw error;
    return Object.fromEntries((data ?? []).flatMap((row: { id: string; course_fee: number | null }) =>
      row.course_fee == null ? [] : [[row.id, Number(row.course_fee)]]
    ));
  },

  async saveCourseFees(mapping: Record<string, number>): Promise<void> {
    if (!useSupabase) {
      setStoredValue(LOCAL_COURSE_FEES_KEY, mapping);
      return;
    }

    const instituteId = requireActiveInstituteId();
    for (const [courseId, courseFee] of Object.entries(mapping)) {
      const { error } = await supabase
        .from('courses')
        .update({ course_fee: courseFee })
        .eq('id', courseId)
        .eq('institute_id', instituteId);
      if (error) throw error;
    }
  }
};

