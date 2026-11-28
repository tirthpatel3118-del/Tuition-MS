import { useMemo, useState } from 'react';
import { CalendarDays, Check, ClipboardCheck, Users } from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatLocalDateInput } from '../lib/date';

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';
const STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Leave'];
const statusClasses: Record<AttendanceStatus, string> = {
  Present: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Absent: 'bg-rose-50 text-rose-800 border-rose-200',
  Late: 'bg-amber-50 text-amber-800 border-amber-200',
  Leave: 'bg-sky-50 text-sky-800 border-sky-200',
};

export function DemoAttendancePage() {
  const { students, batches, showToast } = useData();
  const [date, setDate] = useState(formatLocalDateInput());
  const [batchFilter, setBatchFilter] = useState('all');
  const [marked, setMarked] = useState<Record<string, AttendanceStatus>>({});

  const rows = useMemo(() => students
    .filter(student => student.status === 'Active')
    .map(student => {
      const batch = batches.find(item => item.id === student.batchId)
        ?? batches.find(item => student.batch?.startsWith(item.name));
      return {
        id: student.id, rollNumber: student.rollNumber, name: student.name,
        courseName: student.courseName, batchId: batch?.id ?? 'unassigned',
        batchName: batch?.name ?? student.batch ?? 'Unassigned',
      };
    })
    .filter(student => batchFilter === 'all' || student.batchId === batchFilter)
    .sort((a, b) => a.name.localeCompare(b.name)), [students, batches, batchFilter]);

  const getStatus = (studentId: string) => marked[`${date}:${studentId}`];
  const totals = rows.reduce((count, row) => {
    const status = getStatus(row.id);
    if (status) count[status] += 1;
    else count.unmarked += 1;
    return count;
  }, { Present: 0, Absent: 0, Late: 0, Leave: 0, unmarked: 0 });

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setMarked(previous => ({ ...previous, [`${date}:${studentId}`]: status }));
  };

  const markAllPresent = () => {
    setMarked(previous => {
      const next = { ...previous };
      rows.forEach(row => { next[`${date}:${row.id}`] = 'Present'; });
      return next;
    });
    showToast('Demo attendance marked present for all listed students.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[#E5DDE0] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#A03B5E]">Classroom operations</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[30px]">Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">Mark student attendance using temporary sample records.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"><ClipboardCheck className="h-4 w-4" /> Browser demo</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Students</p><p className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</p></div>
        {STATUSES.map(status => <div key={status} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{status}</p><p className="mt-1 text-2xl font-bold text-slate-900">{totals[status]}</p></div>)}
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#E5DDE0] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E5DDE0] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="grid w-full gap-3 sm:max-w-xl sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">
              <span className="mb-1.5 flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Date</span>
              <input type="date" value={date} onChange={event => setDate(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              <span className="mb-1.5 flex items-center gap-2"><Users className="h-4 w-4" /> Batch</span>
              <select value={batchFilter} onChange={event => setBatchFilter(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800">
                <option value="all">All batches</option>
                {batches.map(batch => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
          </div>
          <button type="button" onClick={markAllPresent} disabled={!rows.length} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#6B1F38] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#57172D] disabled:opacity-50"><Check className="h-4 w-4" /> Mark all present</button>
        </div>

        {rows.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">No active students found for this batch.</p> : (
          <div className="divide-y divide-slate-100">
            {rows.map(student => {
              const status = getStatus(student.id);
              return (
                <div key={student.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{student.rollNumber} · {student.courseName}</p>
                    <p className="mt-1 text-xs text-slate-400">{student.batchName}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {STATUSES.map(option => <button key={option} type="button" onClick={() => setStatus(student.id, option)} aria-pressed={status === option} className={(status === option ? statusClasses[option] : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50') + ' rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition'}>{option}</button>)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="border-t border-[#E5DDE0] bg-[#FCFAFB] px-4 py-3 text-xs text-slate-500 sm:px-5">{totals.unmarked} student(s) still unmarked. These changes exist only in this browser session and disappear on refresh.</div>
      </section>
    </div>
  );
}
