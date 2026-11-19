import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Download, LoaderCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDateForDisplay, formatLocalDateInput } from '../lib/date';

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

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
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  batches: ReportBatch[];
  onBack: () => void;
}

const statusStyle: Record<AttendanceStatus, string> = {
  Present: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Absent: 'border-rose-200 bg-rose-50 text-rose-800',
  Late: 'border-amber-200 bg-amber-50 text-amber-800',
  Leave: 'border-violet-200 bg-violet-50 text-violet-800',
};

const calendarStyle: Record<AttendanceStatus, string> = {
  Present: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  Absent: 'border-rose-200 bg-rose-100 text-rose-800',
  Late: 'border-amber-200 bg-amber-100 text-amber-800',
  Leave: 'border-violet-200 bg-violet-100 text-violet-800',
};

function getMonthRange(month: string) {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (!year || monthNumber < 1 || monthNumber > 12) return null;
  return {
    year,
    monthNumber,
    days: new Date(year, monthNumber, 0).getDate(),
    start: `${month}-01`,
    end: `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, '0')}`,
  };
}

export function MonthlyAttendanceReport({ instituteId, studentId, studentName, rollNumber, batches, onBack }: MonthlyAttendanceReportProps) {
  const [month, setMonth] = useState(() => formatLocalDateInput().slice(0, 7));
  const [records, setRecords] = useState<AttendanceReportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    return () => { cancelled = true; };
  }, [instituteId, month, studentId]);

  const range = getMonthRange(month);
  const monthLabel = useMemo(() => {
    if (!range) return month;
    return new Date(range.year, range.monthNumber - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [month, range]);
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

  const recordsByDate = useMemo(() => {
    const map = new Map<number, AttendanceStatus[]>();
    records.forEach(record => {
      const day = Number(record.attendance_date.slice(8, 10));
      const statuses = map.get(day) ?? [];
      statuses.push(record.status);
      map.set(day, statuses);
    });
    return map;
  }, [records]);

  const calendarDays = useMemo(() => {
    if (!range) return [];
    const offset = new Date(range.year, range.monthNumber - 1, 1).getDay();
    return [
      ...Array.from({ length: offset }, (_, index) => ({ key: `blank-${index}`, day: null as number | null })),
      ...Array.from({ length: range.days }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
    ];
  }, [range]);

  const getDayStyle = (day: number) => {
    const statuses = recordsByDate.get(day);
    if (!statuses?.length) return 'border-slate-200 bg-slate-100 text-slate-400';
    const unique = [...new Set(statuses)];
    if (unique.length > 1) return 'border-amber-200 bg-amber-50 text-amber-800';
    return calendarStyle[unique[0]];
  };

  return (
    <section className="attendance-student-report rounded-2xl border border-[#E5DDE0] bg-white shadow-sm">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body, #root { height: auto !important; min-height: 0 !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          .attendance-student-report, .attendance-student-report * { visibility: visible !important; }
          .attendance-student-report { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; max-width: none !important; border: 0 !important; box-shadow: none !important; overflow: visible !important; }
          .attendance-report-no-print { display: none !important; }
          .attendance-student-report .attendance-calendar-day { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .attendance-student-report .attendance-session-table tr { break-inside: avoid; }
        }
      `}</style>

      <div className="attendance-report-no-print flex flex-wrap items-center justify-between gap-3 border-b border-[#E5DDE0] px-4 py-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4" /> Back to student
        </button>
        <button type="button" onClick={() => window.print()} disabled={loading || records.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6B1F38] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#57172D] disabled:cursor-not-allowed disabled:opacity-50">
          <Download className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#6B1F38]">Student attendance</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{studentName}</h2>
            <p className="mt-1 text-sm text-slate-500">{rollNumber ? `Roll no. ${rollNumber} · ` : ''}{monthLabel}</p>
          </div>
          <label className="attendance-report-no-print flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <span className="sr-only">Report month</span>
            <input aria-label="Report month" type="month" value={month} onChange={event => setMonth(event.target.value)} className="min-w-0 py-2.5 text-sm text-slate-700 outline-none" />
          </label>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading attendance report…</div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              {([
                ['Present', totals.Present, 'text-emerald-700'],
                ['Absent', totals.Absent, 'text-rose-700'],
                ['Attendance', `${totals.percentage}%`, 'text-[#6B1F38]'],
              ] as const).map(([label, value, tone]) => (
                <article key={label} className="flex min-h-24 flex-col justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
                  <p className={`text-2xl font-bold tracking-tight sm:text-3xl ${tone}`}>{value}</p>
                  <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
                </article>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-base font-bold text-slate-900">Date-wise attendance</h3>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">{day}</div>
                ))}
                {calendarDays.map(({ key, day }) => (
                  <div key={key} className={day ? `attendance-calendar-day flex aspect-square min-w-0 items-center justify-center rounded-lg border text-sm font-bold sm:text-base ${getDayStyle(day)}` : 'aspect-square'} title={day ? (recordsByDate.get(day)?.join(', ') ?? 'Not marked / holiday') : undefined}>
                    {day ?? ''}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-200" /> Present</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-200" /> Late</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-rose-100 ring-1 ring-rose-200" /> Absent</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-violet-100 ring-1 ring-violet-200" /> Leave</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-100 ring-1 ring-slate-200" /> Not marked / holiday</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-50 ring-1 ring-amber-200" /> Mixed sessions</span>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-400">Only saved attendance records are included. Days without a saved record are shown as not marked / holiday and are not counted as absences.</p>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900">Session-by-session history</h3>
                <p className="text-xs text-slate-500">Late counts as attended; Leave is excluded from the percentage.</p>
              </div>
              {records.length ? (
                <div className="attendance-session-table overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[420px] text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr><th className="px-3 py-2.5 font-semibold">Date</th><th className="px-3 py-2.5 font-semibold">Class / Batch</th><th className="px-3 py-2.5 font-semibold">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map(record => (
                        <tr key={record.id}>
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{formatDateForDisplay(record.attendance_date, 'DD-MMM-YYYY')}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-800">{batchNames.get(record.batch_id) ?? 'Class session'}</td>
                          <td className="px-3 py-2.5"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusStyle[record.status]}`}>{record.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No attendance records for this month.</div>
              )}
            </div>
            <p className="mt-4 text-[11px] text-slate-400">Report generated from saved attendance records. Present and Late count as attended; Leave is excluded from the attendance percentage.</p>
          </>
        )}
      </div>
    </section>
  );
}
