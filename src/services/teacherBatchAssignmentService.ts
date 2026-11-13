import { supabase } from '../lib/supabase';
import { requireActiveInstituteId } from '../lib/tenant';
import { listInstituteMembers, type InstituteMember } from './memberService';

export interface TeacherBatchAssignment {
  institute_id: string;
  batch_id: string;
  teacher_user_id: string;
  assigned_at: string;
}

export type TeacherOption = Pick<InstituteMember, 'userId' | 'email'>;

export async function loadTeacherBatchAssignments() {
  const instituteId = requireActiveInstituteId();
  const [members, assignmentResult] = await Promise.all([
    listInstituteMembers(),
    supabase.from('teacher_batch_assignments')
      .select('institute_id, batch_id, teacher_user_id, assigned_at')
      .eq('institute_id', instituteId),
  ]);
  if (assignmentResult.error) throw assignmentResult.error;
  return {
    teachers: members.filter(member => member.role === 'teacher'),
    assignments: (assignmentResult.data ?? []) as TeacherBatchAssignment[],
  };
}

export async function saveBatchTeachers(batchId: string, teacherUserIds: string[]) {
  const instituteId = requireActiveInstituteId();
  const { error } = await supabase.rpc('set_teacher_batch_assignments', {
    p_institute_id: instituteId,
    p_batch_id: batchId,
    p_teacher_user_ids: teacherUserIds,
  });
  if (error) throw error;
}
