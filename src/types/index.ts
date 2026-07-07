/**
 * Supabase Database Entity Types
 */

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface Course {
  id: string;
  course_name: string;
  batch_name: string;
  duration_months: number;
  created_at: string;
}

export interface Student {
  id: string;
  roll_number: string;
  full_name: string;
  parent_name: string;
  parent_whatsapp: string;
  student_mobile: string;
  email: string;
  address: string;
  course_id: string;
  admission_date: string;
  course_fee: number;
  discount: number;
  status: 'Active' | 'Inactive' | 'Completed';
  created_at: string;
}

export interface Payment {
  id: string;
  student_id: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  remarks: string;
  created_at: string;
}

export interface Receipt {
  id: string;
  payment_id: string;
  receipt_number: string;
  generated_at: string;
}

export interface Installment {
  id: string;
  student_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: 'Pending' | 'Paid' | 'Overdue';
  payment_id: string | null;
  remarks: string | null;
  created_at: string;
}

export interface AppSettings {
  instituteName: string;
  logoUrl: string;
  address: string;
  contactNumber: string;
  email: string;
  website: string;
  receiptPrefix: string;
  receiptFooter: string;
  authorizedSignatureUrl: string;
  whatsappReminderTemplate: string;
  currencySymbol: string;
  dateFormat: string;
  timeZone: string;
}

export interface Batch {
  id: string;
  courseId: string;
  name: string;
  timing: string;
  capacity: number;
  courseFee?: number;
  status: 'Active' | 'Inactive';
}
