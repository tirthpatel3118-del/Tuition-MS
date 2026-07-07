import { supabase } from '../lib/supabase';
import { Student } from '../types';
import { Course as UiCourse, Student as UiStudent, Payment as UiPayment, Reminder as UiReminder, getStoredData, saveStoredData } from '../data/mockData';

// Determine if we should use Supabase
const useSupabase = 
  !!import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project-id.supabase.co';

export const studentService = {
  async getStudents(): Promise<Student[]> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Student[];
    } else {
      const mockStudents: UiStudent[] = getStoredData().students;
      return mockStudents.map(s => ({
        id: s.id,
        roll_number: s.rollNumber,
        full_name: s.name,
        parent_name: s.parentName,
        parent_whatsapp: s.parentPhone,
        student_mobile: s.phone,
        email: s.email,
        address: 'Default Center Address',
        course_id: s.courseId,
        admission_date: s.enrollmentDate,
        course_fee: s.totalFees,
        discount: 0,
        status: s.status,
        created_at: new Date().toISOString()
      }));
    }
  },

  async getStudentById(id: string): Promise<Student> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Student;
    } else {
      const students = await this.getStudents();
      const found = students.find(s => s.id === id);
      if (!found) throw new Error('Student not found');
      return found;
    }
  },

  async createStudent(student: Omit<Student, 'id' | 'created_at'>): Promise<Student> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('students')
        .insert([student])
        .select()
        .single();
      if (error) throw error;
      return data as Student;
    } else {
      const newId = `s${Date.now()}`;
      const newStudent: Student = {
        ...student,
        id: newId,
        created_at: new Date().toISOString()
      };
      
      // Update mock storage to synchronize UI state
      const mockData = getStoredData();
      const course = mockData.courses.find((c: UiCourse) => c.id === student.course_id);
      const uiStudent: UiStudent = {
        id: newId,
        rollNumber: student.roll_number,
        name: student.full_name,
        email: student.email,
        phone: student.student_mobile,
        parentName: student.parent_name,
        parentPhone: student.parent_whatsapp,
        enrollmentDate: student.admission_date,
        courseId: student.course_id,
        courseName: course ? course.name : 'Unknown Course',
        batch: 'Morning - Batch A (08:00 AM)',
        totalFees: student.course_fee,
        feesPaid: 0,
        feesDue: student.course_fee,
        status: student.status
      };
      saveStoredData({
        ...mockData,
        students: [uiStudent, ...mockData.students]
      });
      
      return newStudent;
    }
  },

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('students')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Student;
    } else {
      const students = await this.getStudents();
      const found = students.find(s => s.id === id);
      if (!found) throw new Error('Student not found');
      const updated = { ...found, ...updates };

      const mockData = getStoredData();
      const updatedMockStudents = mockData.students.map((s: UiStudent) => {
        if (s.id === id) {
          const merged = { ...s };
          if (updates.full_name) merged.name = updates.full_name;
          if (updates.email) merged.email = updates.email;
          if (updates.student_mobile) merged.phone = updates.student_mobile;
          if (updates.parent_name) merged.parentName = updates.parent_name;
          if (updates.parent_whatsapp) merged.parentPhone = updates.parent_whatsapp;
          if (updates.course_id) {
            merged.courseId = updates.course_id;
            const course = mockData.courses.find((c: UiCourse) => c.id === updates.course_id);
            if (course) merged.courseName = course.name;
          }
          if (updates.course_fee !== undefined) merged.totalFees = updates.course_fee;
          if (updates.status) merged.status = updates.status;
          merged.feesDue = merged.totalFees - merged.feesPaid;
          return merged;
        }
        return s;
      });

      saveStoredData({
        ...mockData,
        students: updatedMockStudents
      });

      return updated;
    }
  },

  async deleteStudent(id: string): Promise<void> {
    if (useSupabase) {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      const mockData = getStoredData();
      saveStoredData({
        ...mockData,
        students: mockData.students.filter((s: UiStudent) => s.id !== id),
        payments: mockData.payments.filter((p: UiPayment) => p.studentId !== id),
        reminders: mockData.reminders.filter((r: UiReminder) => r.studentId !== id)
      });
    }
  }
};
