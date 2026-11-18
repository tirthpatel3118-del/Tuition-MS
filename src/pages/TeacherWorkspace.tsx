import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { AttendancePage } from './Attendance';
import { PWAControls } from '../components/PWAControls';

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
  courseName: string;
}

export function TeacherWorkspace() {
  const location = useLocation();
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
        const courseNames = Object.fromEntries((coursesResult.data ?? []).map(course => [course.id, course.course_name]));
        setCourses(courseNames);
        const batchRows = batchesResult.data ?? [];
        const batchNames = Object.fromEntries(batchRows.map(batch => [batch.id, batch.name]));
        const assignedIds = new Set((assignmentsResult.data ?? []).map(assignment => assignment.batch_id));
        setBatches(batchNames);
        setAssignedBatches(batchRows
          .filter(batch => assignedIds.has(batch.id))
          .map(batch => ({ id: batch.id, name: batch.name, courseName: courseNames[batch.course_id] ?? 'Course' })));
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

  if (location.pathname === '/attendance') return <AttendancePage />;

  const activeStudentCount = students.filter(student => student.status === 'Active').length;

  return (
    <main className="min-h-screen bg-[#FAF7F8] px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-col gap-5 border-b border-[#E5DDE0] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#A03B5E]">Teacher workspace</p>
            <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900 sm:text-[30px]">{activeMembership?.instituteName}</h1>
            <p className="mt-1 text-sm text-slate-500">Your assigned academic roster · {email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PWAControls />
            <Link to="/attendance" className="ui-button-primary"> <span>Open attendance</span> </Link>
            <button onClick={() => void signOut()} className="ui-button-secondary">Sign out</button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Teacher overview">
          <article className="ui-card p-4"><p className="text-xs font-medium text-slate-500">Assigned batches</p><p className="mt-2 text-2xl font-semibold text-slate-900">{assignedBatches.length}</p><p className="mt-1 text-xs text-slate-500">Your teaching groups</p></article>
          <article className="ui-card p-4"><p className="text-xs font-medium text-slate-500">Students in roster</p><p className="mt-2 text-2xl font-semibold text-slate-900">{students.length}</p><p className="mt-1 text-xs text-slate-500">Visible academic records</p></article>
          <article className="ui-card p-4"><p className="text-xs font-medium text-slate-500">Active students</p><p className="mt-2 text-2xl font-semibold text-slate-900">{activeStudentCount}</p><p className="mt-1 text-xs text-slate-500">Currently active enrolments</p></article>
        </section>

        <section className="ui-card overflow-hidden">
          <div className="border-b border-[#E5DDE0] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-base font-semibold text-slate-900">Your assigned batches</h2><p className="mt-1 text-xs text-slate-500">Only batches assigned to your teacher account are listed.</p></div><span className="text-xs font-medium text-slate-500">{assignedBatches.length} assigned</span></div>
          </div>
          {!loading && !error && assignedBatches.length === 0
            ? <div className="px-5 py-8 text-sm text-slate-500">No batches are currently assigned to you. Contact your institute owner if you believe this is incorrect.</div>
            : <div className="flex flex-wrap gap-2 p-4 sm:p-5">{assignedBatches.map(batch => <span key={batch.id} className="inline-flex items-center rounded-lg border border-[#E5DDE0] bg-[#FCFAFB] px-3 py-2 text-xs font-semibold text-slate-700">{batch.courseName}<span className="mx-2 text-[#A03B5E]">/</span>{batch.name}</span>)}</div>}
        </section>

        <section className="ui-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5DDE0] px-4 py-4 sm:px-5">
            <div><h2 className="text-base font-semibold text-slate-900">Student roster</h2><p className="mt-1 text-xs text-slate-500">Academic details only. Financial and private owner information is not shown.</p></div>
            <span className="text-xs font-medium text-slate-500">{students.length} records</span>
          </div>
          {error && <p role="alert" className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
          {loading && <p className="px-5 py-12 text-center text-sm text-slate-500">Loading your academic roster…</p>}
          {!loading && !error && students.length === 0 && <div className="px-5 py-12 text-center"><p className="text-sm font-semibold text-slate-800">No students available</p><p className="mt-1 text-xs text-slate-500">Students assigned to your batches will appear here.</p></div>}
          {!loading && !error && students.length > 0 && <>
            <div className="space-y-3 p-3 md:hidden">{students.map(student => <article key={`${student.batch_id ?? "unassigned"}:${student.id}`} className="rounded-lg border border-[#EEE7EA] bg-white p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{student.full_name}</p><p className="mt-1 text-xs text-slate-500">{student.roll_number || 'No roll number'}</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${student.status === 'Active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#E5DDE0] bg-slate-50 text-slate-600'}`}>{student.status}</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#EEE7EA] pt-3"><div><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Course</p><p className="mt-1 truncate text-xs font-medium text-slate-700">{student.course_id ? (courses[student.course_id] ?? 'Course') : '—'}</p></div><div><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Batch</p><p className="mt-1 truncate text-xs font-medium text-slate-700">{student.batch_id ? (batches[student.batch_id] ?? 'Batch') : '—'}</p></div></div>
            </article>)}</div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm">
              <thead className="bg-[#FCFAFB] text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Roll number</th><th className="px-5 py-3">Student</th><th className="px-5 py-3">Course</th><th className="px-5 py-3">Batch</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-[#EEE7EA]">{students.map(student => <tr key={`${student.batch_id ?? "unassigned"}:${student.id}`} className="transition-colors hover:bg-[#FCFAFB]"><td className="px-5 py-3 font-medium text-slate-700">{student.roll_number || '—'}</td><td className="px-5 py-3 font-medium text-slate-900">{student.full_name}</td><td className="px-5 py-3 text-slate-600">{student.course_id ? (courses[student.course_id] ?? 'Course') : '—'}</td><td className="px-5 py-3 text-slate-600">{student.batch_id ? (batches[student.batch_id] ?? 'Batch') : '—'}</td><td className="px-5 py-3 text-slate-600">{student.status}</td></tr>)}</tbody>
            </table></div>
          </>}
        </section>
      </div>
    </main>
  );
}
