import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Reminder, getStoredData } from '../data/mockData';
import { requireActiveInstituteId } from '../lib/tenant';

export type ReminderStatus = Reminder['status'];
export type ReminderChannel = Reminder['type'];

interface ReminderRow {
  id: string;
  student_id: string;
  amount_due: number;
  channel: ReminderChannel;
  status: ReminderStatus;
  created_at: string;
}

function toUiReminder(row: ReminderRow, studentName = ''): Reminder {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName,
    amountDue: Number(row.amount_due),
    sentDate: new Date(row.created_at).toLocaleString(),
    type: row.channel,
    status: row.status,
  };
}

export const reminderService = {
  async getReminders(): Promise<Reminder[]> {
    if (!isSupabaseConfigured) return getStoredData().reminders ?? [];
    const instituteId = requireActiveInstituteId();
    const { data, error } = await supabase
      .from('reminders')
      .select('id, student_id, amount_due, channel, status, created_at')
      .eq('institute_id', instituteId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(row => toUiReminder(row as ReminderRow));
  },

  async createReminder(input: {
    studentId: string;
    amountDue: number;
    channel: ReminderChannel;
    status: ReminderStatus;
  }): Promise<Reminder> {
    const createdAt = new Date().toISOString();
    if (!isSupabaseConfigured) {
      return {
        id: `r${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        studentId: input.studentId,
        studentName: '',
        amountDue: input.amountDue,
        sentDate: new Date(createdAt).toLocaleString(),
        type: input.channel,
        status: input.status,
      };
    }

    const instituteId = requireActiveInstituteId();
    const { data, error } = await supabase.from('reminders').insert({
      institute_id: instituteId,
      student_id: input.studentId,
      amount_due: input.amountDue,
      channel: input.channel,
      status: input.status,
    }).select('id, student_id, amount_due, channel, status, created_at').single();
    if (error) throw error;
    return toUiReminder(data as ReminderRow);
  },

  async createManyReminders(inputs: Array<{
    studentId: string;
    amountDue: number;
    channel: ReminderChannel;
    status: ReminderStatus;
  }>): Promise<Reminder[]> {
    if (inputs.length === 0) return [];
    if (!isSupabaseConfigured) {
      const createdAt = new Date().toLocaleString();
      return inputs.map(input => ({
        id: `r${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        studentId: input.studentId,
        studentName: '',
        amountDue: input.amountDue,
        sentDate: createdAt,
        type: input.channel,
        status: input.status,
      }));
    }

    const instituteId = requireActiveInstituteId();
    const { data, error } = await supabase.from('reminders').insert(inputs.map(input => ({
      institute_id: instituteId,
      student_id: input.studentId,
      amount_due: input.amountDue,
      channel: input.channel,
      status: input.status,
    }))).select('id, student_id, amount_due, channel, status, created_at');
    if (error) throw error;
    return (data ?? []).map(row => toUiReminder(row as ReminderRow));
  },
};

