import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface RosterStudent {
  id: string;
  roll_number: string;
  full_name: string;
  status: string;
  course_id: string | null;
  batch_id: string | null;
}

interface AssignedBatch {
  id: string;
  name: string;
}

export function TeacherWorkspace() {
  const { activeMembership, email, session, signOut } = useAuth();
  const instituteId = activeMembership?.instituteId;
  const userId = session?.user.id;
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [courses, setCourses] = useState<Record<string, string>>({});
  const [batches, setBatches] = useState<Record<string, string>>({});
  const [assignedBatches, setAssignedBatches] = useState<AssignedBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isSupabaseConfigured || !instituteId || !userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const [rosterResult, coursesResult, batchesResult, assignmentsResult] = await Promise.all([
        supabase.from('academic_students')
          .select('id, roll_number, full_name, status, course_id, batch_id')
          .eq('institute_id', instituteId)
          .order('full_name'),
        supabase.from('courses')
          .select('id, course_name')
          .eq('institute_id', instituteId),
        supabase.from('batches')
          .select('id, name, course_id')
          .eq('institute_id', instituteId),
        supabase.from('teacher_batch_assignments')
          .select('batch_id')
          .eq('institute_id', instituteId)
          .eq('teacher_user_id', userId),
      ]);
      if (cancelled) return;
      if (rosterResult.error || coursesResult.error || batchesResult.error || assignmentsResult.error) {
        setError('Could not load the academic roster. Check that the approved database security setup is deployed.');
      } else {
        setStudents((rosterResult.data ?? []) as RosterStudent[]);
        setCourses(Object.fromEntries((coursesResult.data ?? []).map(course => [course.id, course.course_name])));
        const batchRows = batchesResult.data ?? [];
        const batchNames = Object.fromEntries(batchRows.map(batch => [batch.id, batch.name]));
        const assignedIds = new Set((assignmentsResult.data ?? []).map(assignment => assignment.batch_id));
        setBatches(batchNames);
        setAssignedBatches(batchRows
          .filter(batch => assignedIds.has(batch.id))
          .map(batch => ({ id: batch.id, name: batch.name })));
        setError(null);
      }
      setLoading(false);
    };
    void load();
    const channel = isSupabaseConfigured && instituteId && userId
      ? supabase.channel(`teacher-assignments-${instituteId}-${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'teacher_batch_assignments',
          filter: `teacher_user_id=eq.${userId}`,
        }, () => { void load(); })
        .subscribe()
      : null;
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [instituteId, userId]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">Teacher workspace</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{activeMembership?.instituteName}</h1>
            <p className="mt-1 text-sm text-slate-500">Academic roster · {email}</p>
          </div>
          <button onClick={() => void signOut()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Sign out</button>
        </header>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Students</h2>
            <p className="mt-1 text-xs text-slate-500">Only academic roster fields are shown in this workspace.</p>
          </div>
          {!loading && !error && <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-800">Assigned batches</h3>
            {assignedBatches.length === 0
              ? <p className="mt-1 text-sm text-slate-500">No batches are currently assigned to you.</p>
              : <ul className="mt-2 flex flex-wrap gap-2">{assignedBatches.map(batch => <li key={batch.id} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{batch.name}</li>)}</ul>}
          </div>}
          {error && <p role="alert" className="p-5 text-sm text-rose-700">{error}</p>}
          {loading && <p className="p-5 text-sm text-slate-500">Loading roster…</p>}
          {!loading && !error && students.length === 0 && <p className="p-5 text-sm text-slate-500">No students are available in this institute.</p>}
          {!loading && !error && students.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-3">Roll number</th><th className="px-5 py-3">Student</th><th className="px-5 py-3">Course</th><th className="px-5 py-3">Batch</th><th className="px-5 py-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map(student => <tr key={student.id}>
                    <td className="px-5 py-3 font-medium text-slate-700">{student.roll_number}</td>
                    <td className="px-5 py-3 text-slate-900">{student.full_name}</td>
                    <td className="px-5 py-3 text-slate-600">{student.course_id ? (courses[student.course_id] ?? 'Course') : '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{student.batch_id ? (batches[student.batch_id] ?? 'Batch') : '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{student.status}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

