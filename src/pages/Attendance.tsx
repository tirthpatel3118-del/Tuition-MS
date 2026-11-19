import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, ClipboardCheck, History, LoaderCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatLocalDateInput, formatDateForDisplay } from '../lib/date';
import { MonthlyAttendanceReport } from '../components/MonthlyAttendanceReport';

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';
type CorrectionDecision = 'Pending' | 'Approved' | 'Rejected';
const STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Leave'];

interface BatchRow { id: string; name: string; course_id: string; }
interface StudentRow { id: string; roll_number: string | null; full_name: string; status: string; batch_id: string | null; course_id: string; }
interface AttendanceRow { id: string; student_id: string; batch_id: string; attendance_date: string; status: AttendanceStatus; marked_at: string; }
interface CorrectionRow { id: string; attendance_id: string; requested_by: string; requested_status: AttendanceStatus; request_reason: string; decision: CorrectionDecision; decision_reason: string | null; created_at: string; }
interface AuditRow { id: string; attendance_id: string; actor_id: string; action: string; old_status: AttendanceStatus | null; new_status: AttendanceStatus; reason: string; created_at: string; }

const inputClass = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#A03B5E] focus:ring-2 focus:ring-[#F8E9ED]';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
const statusStyle: Record<AttendanceStatus, string> = {
  Present: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Absent: 'border-rose-200 bg-rose-50 text-rose-800',
  Late: 'border-amber-200 bg-amber-50 text-amber-800',
  Leave: 'border-violet-200 bg-violet-50 text-violet-800',
};

export function AttendancePage() {
  const { activeMembership, session } = useAuth();
  const instituteId = activeMembership?.instituteId;
  const isOwner = activeMembership?.role === 'owner';
  const isTeacher = activeMembership?.role === 'teacher';
  const [date, setDate] = useState(formatLocalDateInput());
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [courseNames, setCourseNames] = useState<Record<string, string>>({});
  const [batchFilter, setBatchFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftStatuses, setDraftStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reasonForms, setReasonForms] = useState<Record<string, string>>({});
  const [correctionStatuses, setCorrectionStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [ownerEdit, setOwnerEdit] = useState<{ recordId: string; status: AttendanceStatus; reason: string } | null>(null);
  const [decisionForms, setDecisionForms] = useState<Record<string, { decision: 'Approved' | 'Rejected'; reason: string }>>({});

  const load = useCallback(async (showPageLoader = true) => {
    if (!instituteId || (!isOwner && !isTeacher)) { if (showPageLoader) setLoading(false); return; }
    if (showPageLoader) setLoading(true); setError(null);
    try {
      const [batchResult, courseResult, rosterResult, recordResult] = await Promise.all([
        supabase.from('batches').select('id,name,course_id').eq('institute_id', instituteId).order('name'),
        supabase.from('courses').select('id,course_name').eq('institute_id', instituteId),
        supabase.from('academic_students').select('id,roll_number,full_name,status,batch_id,course_id').eq('institute_id', instituteId).order('full_name'),
        supabase.from('attendance_records').select('id,student_id,batch_id,attendance_date,status,marked_at').eq('institute_id', instituteId).eq('attendance_date', date),
      ]);
      const failure = batchResult.error || courseResult.error || rosterResult.error || recordResult.error;
      if (failure) throw failure;
      setBatches((batchResult.data ?? []) as BatchRow[]);
      setCourseNames(Object.fromEntries((courseResult.data ?? []).map(row => [row.id, row.course_name])));
      setStudents((rosterResult.data ?? []) as StudentRow[]);
      setRecords((recordResult.data ?? []) as AttendanceRow[]);
      const ids = (recordResult.data ?? []).map(row => row.id);
      if (ids.length) {
        const correctionResult = await supabase.from('attendance_correction_requests').select('id,attendance_id,requested_by,requested_status,request_reason,decision,decision_reason,created_at').eq('institute_id', instituteId).in('attendance_id', ids).order('created_at', { ascending: false });
        if (correctionResult.error) throw correctionResult.error;
        setCorrections((correctionResult.data ?? []) as CorrectionRow[]);
      } else setCorrections([]);
      if (isOwner && ids.length) {
        const auditResult = await supabase.from('attendance_audit_logs').select('id,attendance_id,actor_id,action,old_status,new_status,reason,created_at').eq('institute_id', instituteId).in('attendance_id', ids).order('created_at', { ascending: false });
        if (auditResult.error) throw auditResult.error;
        setAudit((auditResult.data ?? []) as AuditRow[]);
      } else setAudit([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load attendance. Check your institute access and database policies.');
    } finally { if (showPageLoader) setLoading(false); }
  }, [date, instituteId, isOwner, isTeacher]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setDraftStatuses({}); }, [date]);

  const assignedBatchIds = useMemo(() => new Set(batches.map(batch => batch.id)), [batches]);
  const visibleBatches = useMemo(() => batchFilter === 'all' ? batches : batches.filter(batch => batch.id === batchFilter), [batchFilter, batches]);
  const recordsByStudent = useMemo(() => new Map(records.map(record => [`${record.batch_id}:${record.student_id}`, record])), [records]);
  const pendingByAttendance = useMemo(() => new Map(corrections.filter(item => item.decision === 'Pending').map(item => [item.attendance_id, item])), [corrections]);
  const studentsByBatch = useMemo(() => {
    const groups = new Map<string, StudentRow[]>();
    for (const student of students) {
      if (!student.batch_id || !assignedBatchIds.has(student.batch_id)) continue;
      const group = groups.get(student.batch_id) ?? [];
      group.push(student); groups.set(student.batch_id, group);
    }
    return groups;
  }, [assignedBatchIds, students]);
  const attendanceSummary = useMemo(() => {
    const counts = { Present: 0, Absent: 0, Late: 0, Leave: 0, unmarked: 0 };
    for (const batch of visibleBatches) {
      for (const student of studentsByBatch.get(batch.id) ?? []) {
        const record = recordsByStudent.get(`${batch.id}:${student.id}`);
        if (record) counts[record.status] += 1;
        else if (student.status === 'Active') counts.unmarked += 1;
      }
    }
    return counts;
  }, [visibleBatches, studentsByBatch, recordsByStudent]);

  const runAction = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusyId(key); setError(null); setNotice(null);
    try { await action(); setNotice(success); await load(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The attendance change could not be saved.'); }
    finally { setBusyId(null); }
  };
  const mark = (student: StudentRow, batchId: string, status: AttendanceStatus) => {
    const key = `${batchId}:${student.id}`;
    setDraftStatuses(current => ({ ...current, [key]: status }));
    setError(null);
    setNotice(null);
  };

  const submitPendingMarks = async () => {
    if (!instituteId || isBulkSubmitting) return;
    const pending = Object.entries(draftStatuses).filter(([key]) => {
      const [batchId, studentId] = key.split(':');
      return batches.some(batch => batch.id === batchId)
        && students.some(student => student.id === studentId && student.status === 'Active')
        && !recordsByStudent.has(key);
    });
    if (!pending.length) return;
    setIsBulkSubmitting(true);
    setError(null);
    setNotice(null);
    const results = await Promise.allSettled(pending.map(async ([key, status]) => {
      const [batchId, studentId] = key.split(':');
      const { error: rpcError } = await supabase.rpc('mark_attendance', {
        p_institute_id: instituteId,
        p_student_id: studentId,
        p_batch_id: batchId,
        p_attendance_date: date,
        p_status: status,
      });
      if (rpcError) throw rpcError;
      return key;
    }));
    const savedKeys = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    if (savedKeys.length) {
      setDraftStatuses(current => {
        const next = { ...current };
        savedKeys.forEach(key => delete next[key]);
        return next;
      });
      await load(false);
    }
    const failedCount = results.length - savedKeys.length;
    if (failedCount) {
      setError(`${savedKeys.length} attendance record(s) saved; ${failedCount} could not be saved. Failed selections have been kept so you can retry.`);
    } else {
      setNotice(`Attendance submitted successfully for ${savedKeys.length} student(s).`);
    }
    setIsBulkSubmitting(false);
  };
  const submitCorrection = (record: AttendanceRow) => {
    const reason = reasonForms[record.id]?.trim() ?? '';
    if (reason.length < 5) { setError('Please enter a correction reason of at least five characters.'); return; }
    if (!instituteId || !session?.user.id) return;
    const requestedStatus = correctionStatuses[record.id];
    if (!requestedStatus) return;
    void runAction(record.id, async () => {
      const { error: insertError } = await supabase.from('attendance_correction_requests').insert({ institute_id: instituteId, attendance_id: record.id, requested_by: session.user.id, requested_status: requestedStatus, request_reason: reason, decision: 'Pending' });
      if (insertError) throw insertError;
    }, 'Correction request submitted.');
  };
  const editAttendance = () => {
    if (!ownerEdit || !instituteId) return;
    if (ownerEdit.reason.trim().length < 5) { setError('Please enter an edit reason of at least five characters.'); return; }
    void runAction(ownerEdit.recordId, async () => {
      const { error: rpcError } = await supabase.rpc('owner_edit_attendance', { p_institute_id: instituteId, p_attendance_id: ownerEdit.recordId, p_status: ownerEdit.status, p_reason: ownerEdit.reason.trim() });
      if (rpcError) throw rpcError;
      setOwnerEdit(null);
    }, 'Attendance updated and recorded in the audit history.');
  };
  const decideCorrection = (item: CorrectionRow) => {
    const form = decisionForms[item.id];
    if (!form || form.reason.trim().length < 5) { setError('Please enter a decision reason of at least five characters.'); return; }
    if (!instituteId) return;
    void runAction(item.id, async () => {
      const { error: rpcError } = await supabase.rpc('decide_attendance_correction', { p_institute_id: instituteId, p_request_id: item.id, p_decision: form.decision, p_reason: form.reason.trim() });
      if (rpcError) throw rpcError;
    }, `Correction request ${form.decision.toLowerCase()}.`);
  };

  const groupedCorrections = corrections.filter(item => isOwner || item.requested_by === session?.user.id);
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {isTeacher && <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B1F38] hover:text-[#57172D]"><ArrowLeft className="h-3.5 w-3.5" /> Teacher workspace</Link>}
          <p className="text-xs font-bold uppercase tracking-wider text-[#6B1F38]">EduLedger · Attendance</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">{isOwner ? 'Institute attendance, corrections, and audit history.' : 'Mark attendance for your assigned batches and request corrections.'}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><CalendarDays className="h-4 w-4 text-slate-400" /><span className="sr-only">Attendance date</span><input aria-label="Attendance date" type="date" value={date} onChange={event => setDate(event.target.value)} className="min-w-0 py-2 text-sm text-slate-700 outline-none" /></label>
          <select aria-label="Filter by batch" value={batchFilter} onChange={event => setBatchFilter(event.target.value)} className={inputClass}><option value="all">All assigned batches</option>{batches.map(batch => <option key={batch.id} value={batch.id}>{courseNames[batch.course_id] ?? 'Course'} · {batch.name}</option>)}</select>
        </div>
      </header>

      {isOwner && instituteId && <MonthlyAttendanceReport instituteId={instituteId} students={students} batches={batches} />}

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {!loading && <section aria-label="Attendance summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {([
          ['Present', attendanceSummary.Present, 'bg-emerald-50 text-emerald-800'],
          ['Absent', attendanceSummary.Absent, 'bg-rose-50 text-rose-800'],
          ['Late', attendanceSummary.Late, 'bg-amber-50 text-amber-800'],
          ['Leave', attendanceSummary.Leave, 'bg-violet-50 text-violet-800'],
          ['Not marked', attendanceSummary.unmarked, 'bg-slate-100 text-slate-700'],
        ] as const).map(([label, value, tone]) => <article key={label} className="ui-card p-3.5 sm:p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className={`mt-2 text-2xl font-semibold tracking-tight ${tone.split(' ').at(-1)}`}>{value}</p></article>)}
      </section>}
      {loading ? <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading attendance…</div> : <>
        <section className="ui-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-slate-900">Attendance changes</p><p className="mt-1 text-xs text-slate-500">{Object.keys(draftStatuses).length} unsubmitted selection(s). You can change them before submitting.</p></div>
          <button type="button" disabled={isBulkSubmitting || Object.keys(draftStatuses).length === 0} onClick={() => void submitPendingMarks()} className={`${buttonClass} bg-[#6B1F38] px-5 py-2.5 text-white hover:bg-[#57172D]`}>
            {isBulkSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            {isBulkSubmitting ? 'Submitting…' : `Submit attendance (${Object.keys(draftStatuses).length})`}
          </button>
        </section>
        <section className="space-y-4">
          {visibleBatches.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center"><ClipboardCheck className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-800">No assigned batches</p><p className="mt-1 text-sm text-slate-500">Attendance appears here when batches are assigned to your account.</p></div>}
          {visibleBatches.map(batch => {
            const roster = studentsByBatch.get(batch.id) ?? [];
            return <article key={batch.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-1 border-b border-[#E5DDE0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-900">{batch.name}</h2><p className="text-xs text-slate-500">{Array.from(new Set(roster.map(student => courseNames[student.course_id]).filter(Boolean))).join(', ') || courseNames[batch.course_id] || 'Course'} · {roster.length} students</p></div><span className="text-xs font-medium text-slate-500">{formatDateForDisplay(date, 'DD-MMM-YYYY')}</span></div>
              {roster.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500">No active roster entries are available for this batch.</p> : <div className="divide-y divide-slate-100">
                {roster.map(student => {
                  const record = recordsByStudent.get(`${batch.id}:${student.id}`);
                  const pending = record ? pendingByAttendance.get(record.id) : undefined;
                  const key = `${batch.id}:${student.id}`;
                  return <div key={student.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0"><p className="truncate font-medium text-slate-900">{student.full_name}</p><p className="mt-0.5 text-xs text-slate-500">{student.roll_number || 'No roll number'} · {courseNames[student.course_id] ?? 'Standard not set'} · {student.status}</p></div>
                    <div className="flex flex-wrap items-center gap-2">
                      {record ? <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${statusStyle[record.status]}`}>{record.status}</span> : <span className="text-xs text-slate-400">Not marked</span>}
                      {!record && student.status === 'Active' && <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Attendance status for ${student.full_name}`}>{STATUSES.map(status => <button key={status} type="button" onClick={() => mark(student, batch.id, status)} aria-pressed={draftStatuses[key] === status} className={`${buttonClass} border px-2.5 py-2 ${draftStatuses[key] === status ? statusStyle[status] + ' ring-2 ring-offset-1 ring-[#A03B5E]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{status}</button>)}</div>}
                      {!record && student.status !== 'Active' && <span className="text-xs text-slate-400">Inactive student</span>}
                      {!record && draftStatuses[key] && <span className="text-[11px] font-semibold text-[#6B1F38]">Selected: {draftStatuses[key]}</span>}
                      {record && isOwner && <button type="button" onClick={() => { setOwnerEdit({ recordId: record.id, status: record.status, reason: '' }); setError(null); }} className={`${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>Edit</button>}
                    {record && isTeacher && !pending && <button type="button" onClick={() => { setReasonForms(prev => ({ ...prev, [record.id]: prev[record.id] ?? '' })); setCorrectionStatuses(prev => ({ ...prev, [record.id]: prev[record.id] ?? (record.status === 'Present' ? 'Absent' : 'Present') })); }} className={`${buttonClass} border border-[#E5DDE0] bg-[#F8E9ED] text-[#6B1F38] hover:bg-[#F8E9ED]`}><RotateCcw className="h-3.5 w-3.5" />Request correction</button>}
                      {pending && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Correction pending</span>}
                    </div>
                    {record && isTeacher && !pending && correctionStatuses[record.id] && <div className="grid w-full gap-2 border-t border-[#E5DDE0] pt-3 sm:grid-cols-[minmax(140px,0.7fr)_minmax(200px,1.3fr)_auto] lg:basis-full">
                      <select value={correctionStatuses[record.id]} onChange={event => setCorrectionStatuses(prev => ({ ...prev, [record.id]: event.target.value as AttendanceStatus }))} aria-label={`Requested status for ${student.full_name}`} className={inputClass}>{STATUSES.filter(status => status !== record.status).map(status => <option key={status}>{status}</option>)}</select>
                      <input value={reasonForms[record.id] ?? ''} onChange={event => setReasonForms(prev => ({ ...prev, [record.id]: event.target.value }))} maxLength={500} aria-label={`Correction reason for ${student.full_name}`} placeholder="Reason (at least 5 characters)" className={inputClass} />
                      <button type="button" disabled={busyId === record.id} onClick={() => submitCorrection(record)} className={`${buttonClass} bg-[#6B1F38] text-white hover:bg-[#57172D]`}>Submit request</button>
                    </div>}
                    {record && isOwner && ownerEdit?.recordId === record.id && <div className="grid w-full gap-2 border-t border-[#E5DDE0] pt-3 sm:grid-cols-[150px_minmax(200px,1fr)_auto_auto] lg:basis-full">
                      <select value={ownerEdit.status} onChange={event => setOwnerEdit({ ...ownerEdit, status: event.target.value as AttendanceStatus })} aria-label={`New status for ${student.full_name}`} className={inputClass}>{STATUSES.map(status => <option key={status}>{status}</option>)}</select>
                      <input value={ownerEdit.reason} onChange={event => setOwnerEdit({ ...ownerEdit, reason: event.target.value })} maxLength={500} aria-label="Mandatory edit reason" placeholder="Required reason (at least 5 characters)" className={inputClass} />
                      <button type="button" disabled={busyId === record.id} onClick={editAttendance} className={`${buttonClass} bg-[#6B1F38] text-white hover:bg-[#57172D]`}>Save edit</button><button type="button" onClick={() => setOwnerEdit(null)} className={`${buttonClass} text-slate-600 hover:bg-slate-100`}>Cancel</button>
                    </div>}
                  </div>;
                })}
              </div>}
            </article>;
          })}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-[#E5DDE0] px-5 py-4"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><History className="h-4 w-4 text-[#6B1F38]" />Correction requests</h2><p className="mt-1 text-xs text-slate-500">{isOwner ? 'Review teacher requests and record a decision reason.' : 'Your requests and their current decisions.'}</p></div>
          {groupedCorrections.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500">No correction requests yet.</p> : <div className="divide-y divide-slate-100">{groupedCorrections.map(item => {
            const record = records.find(row => row.id === item.attendance_id);
            const student = record ? students.find(row => row.id === record.student_id) : undefined;
            const form = decisionForms[item.id] ?? { decision: 'Approved' as const, reason: '' };
            return <div key={item.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium text-slate-900">{student?.full_name ?? 'Student'} · {record ? formatDateForDisplay(record.attendance_date, 'DD-MMM-YYYY') : 'Attendance record'}</p><p className="mt-1 text-sm text-slate-600">{item.requested_status} requested · {item.request_reason}</p>{item.decision_reason && <p className="mt-1 text-xs text-slate-500">Decision reason: {item.decision_reason}</p>}</div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.decision === 'Pending' ? 'bg-amber-50 text-amber-800' : item.decision === 'Approved' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{item.decision}</span></div>
              {isOwner && item.decision === 'Pending' && <div className="grid gap-2 sm:grid-cols-[130px_minmax(200px,1fr)_auto]">
                <select value={form.decision} aria-label="Correction decision" onChange={event => setDecisionForms(prev => ({ ...prev, [item.id]: { ...form, decision: event.target.value as 'Approved' | 'Rejected' } }))} className={inputClass}><option>Approved</option><option>Rejected</option></select>
                <input value={form.reason} onChange={event => setDecisionForms(prev => ({ ...prev, [item.id]: { ...form, reason: event.target.value } }))} maxLength={500} aria-label="Decision reason" placeholder="Decision reason (at least 5 characters)" className={inputClass} />
                <button type="button" disabled={busyId === item.id} onClick={() => decideCorrection(item)} className={`${buttonClass} bg-[#6B1F38] text-white hover:bg-[#57172D]`}><Check className="h-4 w-4" />Record decision</button>
              </div>}
            </div>;
          })}</div>}
        </section>

        {isOwner && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-[#E5DDE0] px-5 py-4"><h2 className="font-semibold text-slate-900">Audit history for {formatDateForDisplay(date, 'DD-MMM-YYYY')}</h2><p className="mt-1 text-xs text-slate-500">Initial marks, owner edits, and approved corrections.</p></div>
          {audit.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500">No audit events for this date.</p> : <div className="divide-y divide-slate-100">{audit.map(item => <div key={item.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-800">{item.action.replaceAll('_', ' ')} · {item.old_status ? `${item.old_status} → ` : ''}{item.new_status}</p><p className="text-xs text-slate-500">{item.reason}</p></div><time className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</time></div>)}</div>}
        </section>}
      </>}
    </div>
  );
}
