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

export function TeacherWorkspace() {
  const { activeMembership, email, signOut } = useAuth();
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [courses, setCourses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isSupabaseConfigured || !activeMembership) return;
      setLoading(true);
      const [rosterResult, coursesResult] = await Promise.all([
        supabase.from('academic_students')
          .select('id, roll_number, full_name, status, course_id, batch_id')
          .eq('institute_id', activeMembership.instituteId)
          .order('full_name'),
        supabase.from('courses')
          .select('id, course_name')
          .eq('institute_id', activeMembership.instituteId),
      ]);
      if (cancelled) return;
      if (rosterResult.error || coursesResult.error) {
        setError('Could not load the academic roster. Check that the approved database security setup is deployed.');
      } else {
        setStudents((rosterResult.data ?? []) as RosterStudent[]);
        setCourses(Object.fromEntries((coursesResult.data ?? []).map(course => [course.id, course.course_name])));
        setError(null);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [activeMembership]);

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
          {error && <p role="alert" className="p-5 text-sm text-rose-700">{error}</p>}
          {loading && <p className="p-5 text-sm text-slate-500">Loading roster…</p>}
          {!loading && !error && students.length === 0 && <p className="p-5 text-sm text-slate-500">No students are available in this institute.</p>}
          {!loading && !error && students.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-3">Roll number</th><th className="px-5 py-3">Student</th><th className="px-5 py-3">Course</th><th className="px-5 py-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map(student => <tr key={student.id}>
                    <td className="px-5 py-3 font-medium text-slate-700">{student.roll_number}</td>
                    <td className="px-5 py-3 text-slate-900">{student.full_name}</td>
                    <td className="px-5 py-3 text-slate-600">{student.course_id ? (courses[student.course_id] ?? 'Course') : '—'}</td>
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

