import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Student } from '../types';
import { Course as UiCourse, Student as UiStudent, getStoredData, saveStoredData } from '../data/mockData';
import { requireActiveInstituteId } from '../lib/tenant';

const useSupabase = isSupabaseConfigured;

export const studentService = {
  async getStudents(): Promise<Array<Student & { batch?: string }>> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('institute_id', instituteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Array<Student & { batch?: string }>;
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
        batch: s.batch,
        discount: 0,
        status: s.status,
        created_at: new Date().toISOString()
      }));
    }
  },

  async getStudentById(id: string): Promise<Student> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .eq('institute_id', instituteId)
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

  async createStudent(student: Omit<Student, 'id' | 'created_at'>, demoBatchName?: string): Promise<Student> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('students')
        .insert([{ ...student, institute_id: instituteId }])
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
        batch: demoBatchName || 'Morning - Batch A (08:00 AM)',
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

  async updateStudent(id: string, updates: Partial<Student>, demoBatchName?: string): Promise<Student> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('students')
        .update(updates)
        .eq('id', id)
        .eq('institute_id', instituteId)
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
          if (demoBatchName !== undefined) merged.batch = demoBatchName;
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
  }
};

