import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, LoaderCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDateForDisplay, formatLocalDateInput } from '../lib/date';

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

interface ReportStudent {
  id: string;
  full_name: string;
  roll_number: string | null;
}

interface ReportBatch {
  id: string;
  name: string;
}

interface AttendanceReportRecord {
  id: string;
  attendance_date: string;
  batch_id: string;
  status: AttendanceStatus;
  marked_at: string;
}

interface MonthlyAttendanceReportProps {
  instituteId: string;
  students: ReportStudent[];
  batches: ReportBatch[];
}

const statusStyle: Record<AttendanceStatus, string> = {
  Present: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Absent: 'border-rose-200 bg-rose-50 text-rose-800',
  Late: 'border-amber-200 bg-amber-50 text-amber-800',
  Leave: 'border-violet-200 bg-violet-50 text-violet-800',
};

function getMonthRange(month: string) {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (!year || monthNumber < 1 || monthNumber > 12) return null;
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function MonthlyAttendanceReport({ instituteId, students, batches }: MonthlyAttendanceReportProps) {
  const [month, setMonth] = useState(() => formatLocalDateInput().slice(0, 7));
  const [studentId, setStudentId] = useState('');
  const uniqueStudents = useMemo(() => Array.from(new Map(students.map(student => [student.id, student])).values()).sort((a, b) => a.full_name.localeCompare(b.full_name)), [students]);
  const [records, setRecords] = useState<AttendanceReportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uniqueStudents.length) {
      setStudentId('');
      setRecords([]);
      return;
    }
    if (!studentId || !uniqueStudents.some(student => student.id === studentId)) {
      setStudentId(uniqueStudents[0].id);
    }
  }, [studentId, uniqueStudents]);

  useEffect(() => {
    const range = getMonthRange(month);
    if (!instituteId || !studentId || !range) {
      setRecords([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const { data, error: queryError } = await supabase
        .from('attendance_records')
        .select('id,attendance_date,batch_id,status,marked_at')
        .eq('institute_id', instituteId)
        .eq('student_id', studentId)
        .gte('attendance_date', range.start)
        .lte('attendance_date', range.end)
        .order('attendance_date', { ascending: true })
        .order('marked_at', { ascending: true });

      if (cancelled) return;
      if (queryError) {
        setError(queryError.message || 'Could not load the monthly attendance report.');
        setRecords([]);
      } else {
        setRecords((data ?? []) as AttendanceReportRecord[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [instituteId, month, studentId]);

  const selectedStudent = uniqueStudents.find(student => student.id === studentId);
  const batchNames = useMemo(() => new Map(batches.map(batch => [batch.id, batch.name])), [batches]);
  const totals = useMemo(() => {
    const counts = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
    records.forEach(record => { counts[record.status] += 1; });
    const countedSessions = counts.Present + counts.Absent + counts.Late;
    const attendedSessions = counts.Present + counts.Late;
    return {
      ...counts,
      total: records.length,
      percentage: countedSessions ? Math.round((attendedSessions / countedSessions) * 100) : 0,
    };
  }, [records]);

  const monthLabel = useMemo(() => {
    if (!getMonthRange(month)) return month;
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [month]);

  return (
    <section className="attendance-report-print-root overflow-hidden rounded-2xl border border-[#E5DDE0] bg-white shadow-sm">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .attendance-report-print-root,
          .attendance-report-print-root * { visibility: visible !important; }
          .attendance-report-print-root { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; border: 0 !important; box-shadow: none !important; }
          .attendance-report-print-controls { display: none !important; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
      <div className="flex flex-col gap-3 border-b border-[#E5DDE0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#6B1F38]">Student report</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Monthly attendance</h2>
          <p className="mt-1 text-xs text-slate-500">Review every recorded class session for an individual student.</p>
        </div>
        <div className="attendance-report-print-controls flex flex-col gap-2 sm:flex-row">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <span className="sr-only">Select student</span>
            <select aria-label="Select student for monthly report" value={studentId} onChange={event => setStudentId(event.target.value)} className="min-w-0 bg-transparent py-2 text-sm text-slate-700 outline-none" disabled={!uniqueStudents.length}>
              {uniqueStudents.length ? uniqueStudents.map(student => (
                <option key={student.id} value={student.id}>{student.full_name}{student.roll_number ? ` · ${student.roll_number}` : ''}</option>
              )) : <option value="">No students available</option>}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <span className="sr-only">Report month</span>
            <input aria-label="Report month" type="month" value={month} onChange={event => setMonth(event.target.value)} className="min-w-0 py-2 text-sm text-slate-700 outline-none" />
          </label>
          <button type="button" onClick={() => window.print()} disabled={!selectedStudent || loading || records.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6B1F38] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#57172D] disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" /> Print / Save PDF
          </button>
        </div>
      </div>

      <div className="p-5">
        {selectedStudent && (
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{selectedStudent.full_name}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{selectedStudent.roll_number ? `Roll no. ${selectedStudent.roll_number} · ` : ''}{monthLabel}</p>
            </div>
            <span className="rounded-full border border-[#E5DDE0] bg-[#FAF7F8] px-3 py-1 text-xs font-semibold text-[#6B1F38]">{totals.total} recorded session{totals.total === 1 ? '' : 's'}</span>
          </div>
        )}

        {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading monthly report…</div>
        ) : !uniqueStudents.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">No students are available for this institute.</div>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {([
                ['Present', totals.Present, 'text-emerald-700'],
                ['Absent', totals.Absent, 'text-rose-700'],
                ['Late', totals.Late, 'text-amber-700'],
                ['Leave', totals.Leave, 'text-violet-700'],
                ['Attendance', `${totals.percentage}%`, 'text-[#6B1F38]'],
              ] as const).map(([label, value, tone]) => (
                <article key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className={`mt-1.5 text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
                </article>
              ))}
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900">Session-by-session history</h4>
              <p className="text-xs text-slate-500">Late counts as attended; Leave is excluded from the percentage.</p>
            </div>

            {records.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                <p className="font-medium text-slate-700">No attendance records for this month</p>
                <p className="mt-1 text-sm text-slate-500">Unmarked sessions are not counted as absences.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Class / Batch session</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map(record => (
                      <tr key={record.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateForDisplay(record.attendance_date, 'DD-MMM-YYYY')}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{batchNames.get(record.batch_id) ?? 'Class session'}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[record.status]}`}>{record.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <p className="mt-4 text-[11px] text-slate-400">Report generated from saved attendance records. Only marked class sessions are included; days without a saved record are not treated as absences.</p>
      </div>
    </section>
  );
}
