import { supabase } from '../lib/supabase';
import { AppSettings } from '../types';

const useSupabase = 
  !!import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project-id.supabase.co';

export const DEFAULT_SETTINGS: AppSettings = {
  instituteName: 'EduLedger ERP',
  logoUrl: '',
  address: '123 Academy Lane, Tech City, IN',
  contactNumber: '+91 98765 43210',
  email: 'info@eduledger.com',
  website: 'https://eduledger.com',
  receiptPrefix: 'REC',
  receiptFooter: 'This is a computer generated receipt. Signature is not mandatory.',
  authorizedSignatureUrl: '',
  whatsappReminderTemplate: 'Dear {ParentName}, this is a gentle reminder that Installment #{InstallmentNumber} of {Amount} is due on {DueDate} for {StudentName}. Please clear the dues. Thank you, {InstituteName}.',
  currencySymbol: '₹',
  dateFormat: 'YYYY-MM-DD',
  timeZone: 'Asia/Kolkata'
};

const LOCAL_STORAGE_KEY = 'eduledger_settings';

export const settingsService = {
  async getSettings(): Promise<AppSettings> {
    if (useSupabase) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'app_settings')
          .maybeSingle();

        // If table doesn't exist, we'll get an error, otherwise data might be null if not initialized
        if (error) {
          console.warn('Failed to fetch settings from Supabase, falling back to local.', error);
          return this.getLocalSettings();
        }

        if (data && data.value) {
          return { ...DEFAULT_SETTINGS, ...data.value } as AppSettings;
        }

        // Initialize table if empty
        const defaults = this.getLocalSettings();
        await this.saveSettings(defaults);
        return defaults;
      } catch (err) {
        console.warn('Error reading settings from database:', err);
        return this.getLocalSettings();
      }
    } else {
      return this.getLocalSettings();
    }
  },

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    // Save to local storage first
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));

    if (useSupabase) {
      try {
        // Upsert into Supabase settings table
        const { error } = await supabase
          .from('settings')
          .upsert({
            key: 'app_settings',
            value: settings,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('Failed to save settings to Supabase:', error);
        }
      } catch (err) {
        console.error('Database connection error saving settings:', err);
      }
    }

    return settings;
  },

  getLocalSettings(): AppSettings {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  },

  async getCourseFees(): Promise<Record<string, number>> {
    if (useSupabase) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'course_fees')
          .maybeSingle();

        if (error) {
          console.warn('Failed to fetch course fees from Supabase, falling back to local.', error);
          return JSON.parse(localStorage.getItem('eduledger_course_fees') || '{}');
        }

        if (data && data.value) {
          return data.value as Record<string, number>;
        }

        return {};
      } catch (err) {
        console.warn('Error reading course fees from database:', err);
        return JSON.parse(localStorage.getItem('eduledger_course_fees') || '{}');
      }
    } else {
      return JSON.parse(localStorage.getItem('eduledger_course_fees') || '{}');
    }
  },

  async saveCourseFees(mapping: Record<string, number>): Promise<void> {
    localStorage.setItem('eduledger_course_fees', JSON.stringify(mapping));

    if (useSupabase) {
      try {
        const { error } = await supabase
          .from('settings')
          .upsert({
            key: 'course_fees',
            value: mapping,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('Failed to save course fees to Supabase:', error);
        }
      } catch (err) {
        console.error('Database connection error saving course fees:', err);
      }
    }
  }
};
