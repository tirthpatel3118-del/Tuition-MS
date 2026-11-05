import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Course } from '../types';
import { Course as UiCourse, getStoredData, saveStoredData } from '../data/mockData';
import { requireActiveInstituteId } from '../lib/tenant';

const useSupabase = isSupabaseConfigured;

export const courseService = {
  async getCourses(): Promise<Course[]> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('institute_id', instituteId)
        .order('course_name', { ascending: true });
      if (error) throw error;
      return data as Course[];
    } else {
      const mockCourses: UiCourse[] = getStoredData().courses;
      return mockCourses.map(c => ({
        id: c.id,
        course_name: c.name,
        batch_name: 'Morning - Batch A (08:00 AM)',
        duration_months: parseInt(c.duration) || 6,
        course_fee: c.fees,
        created_at: new Date().toISOString()
      }));
    }
  },

  async createCourse(course: Omit<Course, 'id' | 'created_at'>): Promise<Course> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { data, error } = await supabase
        .from('courses')
        .insert([{ ...course, institute_id: instituteId }])
        .select()
        .single();
      if (error) throw error;
      return data as Course;
    } else {
      const newId = `c${Date.now()}`;
      const newCourse: Course = {
        ...course,
        id: newId,
        created_at: new Date().toISOString()
      };

      const mockData = getStoredData();
      const uiCourse: UiCourse = {
        id: newId,
        name: course.course_name,
        fees: course.course_fee ?? null,
        duration: `${course.duration_months} Months`,
        subject: course.course_name.split(' ')[0] || 'General'
      };
      
      saveStoredData({
        ...mockData,
        courses: [...mockData.courses, uiCourse]
      });

      return newCourse;
    }
  },

  async deleteCourse(id: string): Promise<void> {
    if (useSupabase) {
      const instituteId = requireActiveInstituteId();
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id)
        .eq('institute_id', instituteId);
      if (error) throw error;
    } else {
      const mockData = getStoredData();
      saveStoredData({
        ...mockData,
        courses: mockData.courses.filter((c: any) => c.id !== id)
      });
    }
  }
};

