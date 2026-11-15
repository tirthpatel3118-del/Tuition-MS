import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { 
  DollarSign, 
  Users, 
  Percent, 
  Plus, 
  AlertTriangle,
  ArrowRight,
  CreditCard,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PageLoader } from '../components/PageLoader';
import {
  renderReminderTemplate,
  DEFAULT_INSTALLMENT_REMINDER_TEMPLATE,
  DEFAULT_DIRECT_REMINDER_TEMPLATE
} from '../utils/reminderTemplate';

export const Dashboard: React.FC = () => {
  const { students, payments, courses, installments, settings } = useData();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // 1. Calculate Summary Metrics
  const activeStudents = students.filter(s => s.status === 'Active');
  
  // Total Revenue: sum of all recorded payments
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

  // Total Outstanding Dues: sum of all Pending/Overdue installments
  const outstandingDues = students
    .filter(s => s.status !== 'Inactive')
    .reduce((sum, s) => sum + s.feesDue, 0);

  // Use the browser's local calendar date so due totals stay correct across time zones.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const todayStr = toDateKey(today);
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(today.getDate() + 7);
  const sevenDaysLaterStr = toDateKey(sevenDaysLater);

  // Today's Due: Pending or Overdue installments due today (or overdue in the past)
  const todaysDue = (installments || [])
    .filter(inst => inst.status !== 'Paid' && inst.dueDate <= todayStr)
    .reduce((sum, inst) => sum + inst.amount, 0);

  // Upcoming Due: Pending/Overdue installments due in the next 7 days
  const upcomingDue = (installments || [])
    .filter(inst => inst.status !== 'Paid' && inst.dueDate > todayStr && inst.dueDate <= sevenDaysLaterStr)
    .reduce((sum, inst) => sum + inst.amount, 0);

  const pendingInstallmentsCount = (installments || []).filter(inst => inst.status !== 'Paid').length;
  const todaysDueCount = (installments || []).filter(inst => inst.status !== 'Paid' && inst.dueDate <= todayStr).length;
  const upcomingDueCount = (installments || []).filter(inst => inst.status !== 'Paid' && inst.dueDate > todayStr && inst.dueDate <= sevenDaysLaterStr).length;

  // Total Fees: sum of total fees of non-inactive students
  const totalFeesExpected = students
    .filter(s => s.status !== 'Inactive')
    .reduce((sum, s) => sum + s.totalFees, 0);

  const totalFeesCollected = students
    .filter(s => s.status !== 'Inactive')
    .reduce((sum, s) => sum + s.feesPaid, 0);
  const collectionRate = totalFeesExpected > 0
    ? Math.round((totalFeesCollected / totalFeesExpected) * 100)
    : 0;

  // 2. Prepare year-to-date monthly revenue for the interactive SVG chart.
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const months = monthNames.slice(0, today.getMonth() + 1);
  const monthlyRevenueMap: Record<string, number> = Object.fromEntries(months.map(month => [month, 0]));

  payments.forEach(p => {
    const [paymentYear, paymentMonth] = p.paymentDate.split('-').map(Number);
    if (paymentYear === today.getFullYear() && paymentMonth >= 1 && paymentMonth <= months.length) {
      const monthName = months[paymentMonth - 1];
      monthlyRevenueMap[monthName] += p.amount;
    }
  });

  const chartData = months.map(m => ({
    name: m,
    value: monthlyRevenueMap[m]
  }));

  const maxVal = Math.max(...chartData.map(d => d.value), 10000);
  
  // Interactive chart state
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; x: number; y: number; val: number; label: string } | null>(null);

  // SVG Chart Dimensions
  const width = 600;
  const height = 240;
  const paddingX = 40;
  const paddingY = 30;

  // Calculate coordinates for points
  const points = chartData.map((d, index) => {
    const x = paddingX + (index / (chartData.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - (d.value / maxVal) * (height - 2 * paddingY);
    return { x, y, val: d.value, label: d.name };
  });

  const linePath = points.reduce((path, p, index) => {
    return path + `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y} `;
  }, '');

  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
    : '';

  // 3. Prepare Course-wise Revenue Distribution
  const courseCollection = courses.map(course => {
    const coursePayments = payments
      .filter(p => p.courseName.toLowerCase().includes(course.name.toLowerCase()) || 
                  students.find(s => s.id === p.studentId)?.courseId === course.id)
      .reduce((sum, p) => sum + p.amount, 0);

    const count = students.filter(s => s.courseId === course.id).length;

    return {
      name: course.subject,
      fullName: course.name,
      amount: coursePayments,
      count
    };
  }).sort((a, b) => b.amount - a.amount);

  const maxCourseAmt = Math.max(...courseCollection.map(c => c.amount), 5000);

  // 4. Alert lists: Students with largest outstanding dues
  const highDuesStudents = [...students]
    .filter(s => s.feesDue > 0 && s.status === 'Active')
    .sort((a, b) => b.feesDue - a.feesDue)
    .slice(0, 4);

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-4 border-b border-[#E5DDE0] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#A03B5E]">Institute overview</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[30px]">Good {today.getHours() < 12 ? 'morning' : today.getHours() < 17 ? 'afternoon' : 'evening'}</h1>
          <p className="mt-1.5 text-sm text-slate-500">A clear view of your institute's activity and fee performance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admissions" className="ui-button-primary"><Plus className="h-4 w-4" /> Add student</Link>
          <Link to="/payments" className="ui-button-secondary"><CreditCard className="h-4 w-4" /> Record payment</Link>
        </div>
      </section>

      <section aria-label="Institute performance">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-800">At a glance</h2><span className="text-xs text-slate-400">Updated from recorded activity</span></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="ui-card p-4 sm:p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">Total collections</p><span className="rounded-lg bg-[#F8E9ED] p-2 text-[#6B1F38]"><DollarSign className="h-4 w-4" /></span></div><p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{settings?.currencySymbol || '₹'}{totalRevenue.toLocaleString('en-IN')}</p><p className="mt-1 text-xs text-slate-500">{payments.length} recorded payments</p></article>
          <article className="ui-card p-4 sm:p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">Outstanding balance</p><span className="rounded-lg bg-amber-50 p-2 text-amber-700"><AlertTriangle className="h-4 w-4" /></span></div><p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{settings?.currencySymbol || '₹'}{outstandingDues.toLocaleString('en-IN')}</p><p className="mt-1 text-xs text-slate-500">{pendingInstallmentsCount} unpaid installments</p></article>
          <article className="ui-card p-4 sm:p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">Active students</p><span className="rounded-lg bg-slate-100 p-2 text-slate-700"><Users className="h-4 w-4" /></span></div><p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{activeStudents.length}</p><p className="mt-1 text-xs text-slate-500">{students.length} students in the directory</p></article>
          <article className="ui-card p-4 sm:p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">Fee collection rate</p><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Percent className="h-4 w-4" /></span></div><p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{collectionRate}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(collectionRate, 100)}%` }} /></div><p className="mt-1.5 text-xs text-slate-500">Of expected fees collected</p></article>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="ui-card min-w-0 p-4 sm:p-5 xl:col-span-2">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900">Collection trend</h2><p className="mt-1 text-xs text-slate-500">Month-by-month collections for {today.getFullYear()}.</p></div><span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500"><span className="h-2 w-2 rounded-full bg-[#6B1F38]" /> Collected</span></div>
          <div className="relative h-[230px] w-full overflow-hidden rounded-lg bg-[#FCFAFB] px-2 py-3 sm:px-4">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Monthly fee collection trend">
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => { const y = paddingY + ratio * (height - 2 * paddingY); return <line key={i} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#E9E1E4" strokeWidth="1" strokeDasharray="3 5" />; })}
              {areaPath && <path d={areaPath} fill="url(#area-gradient)" />}
              {linePath && <path d={linePath} fill="none" stroke="#6B1F38" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
              {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={hoveredPoint?.index === index ? 6 : 3.5} fill="#FFFFFF" stroke="#6B1F38" strokeWidth="2.5" tabIndex={0} role="button" aria-label={`${point.label}: ${settings?.currencySymbol || '₹'}${point.val.toLocaleString('en-IN')}`} onMouseEnter={() => setHoveredPoint({ index, x: point.x, y: point.y, val: point.val, label: point.label })} onFocus={() => setHoveredPoint({ index, x: point.x, y: point.y, val: point.val, label: point.label })} />)}
              {points.map((point, index) => <text key={index} x={point.x} y={height - 8} textAnchor="middle" fontSize="11" fill="#8B7D83">{point.label}</text>)}
              <defs><linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A03B5E" stopOpacity="0.18" /><stop offset="100%" stopColor="#A03B5E" stopOpacity="0.01" /></linearGradient></defs>
            </svg>
            {hoveredPoint && <div className="pointer-events-none absolute right-4 top-3 rounded-lg border border-[#E5DDE0] bg-white px-3 py-2 text-xs shadow-sm"><p className="text-slate-500">{hoveredPoint.label}</p><p className="mt-0.5 font-semibold text-slate-900">{settings?.currencySymbol || '₹'}{hoveredPoint.val.toLocaleString('en-IN')}</p></div>}
          </div>
        </article>
        <article className="ui-card p-4 sm:p-5">
          <div className="mb-5"><h2 className="text-base font-semibold text-slate-900">Fee schedule</h2><p className="mt-1 text-xs text-slate-500">Upcoming collection priorities.</p></div>
          <div className="divide-y divide-[#EEE7EA]">
            <div className="flex items-center justify-between gap-3 py-4 first:pt-0"><div><p className="text-sm font-medium text-slate-800">Due today & overdue</p><p className="mt-1 text-xs text-slate-500">{todaysDueCount} installments</p></div><p className="whitespace-nowrap text-sm font-semibold text-rose-700">{settings?.currencySymbol || '₹'}{todaysDue.toLocaleString('en-IN')}</p></div>
            <div className="flex items-center justify-between gap-3 py-4"><div><p className="text-sm font-medium text-slate-800">Next 7 days</p><p className="mt-1 text-xs text-slate-500">{upcomingDueCount} installments</p></div><p className="whitespace-nowrap text-sm font-semibold text-amber-700">{settings?.currencySymbol || '₹'}{upcomingDue.toLocaleString('en-IN')}</p></div>
            <div className="flex items-center justify-between gap-3 py-4 last:pb-0"><div><p className="text-sm font-medium text-slate-800">Total outstanding</p><p className="mt-1 text-xs text-slate-500">Across active students</p></div><p className="whitespace-nowrap text-sm font-semibold text-slate-900">{settings?.currencySymbol || '₹'}{outstandingDues.toLocaleString('en-IN')}</p></div>
          </div>
          <Link to="/reminders" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5DDE0] px-3 py-2.5 text-sm font-semibold text-[#6B1F38] transition-colors hover:bg-[#F8E9ED]">Review pending dues <ArrowRight className="h-4 w-4" /></Link>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="ui-card p-4 sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900">Course performance</h2><p className="mt-1 text-xs text-slate-500">Collections and enrolled students by course.</p></div><Link to="/courses" className="text-xs font-semibold text-[#6B1F38] hover:underline">Manage courses</Link></div>
          {courseCollection.length ? <div className="space-y-5">{courseCollection.slice(0, 5).map((item, index) => { const percentage = maxCourseAmt > 0 ? (item.amount / maxCourseAmt) * 100 : 0; return <div key={index}><div className="mb-2 flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{item.fullName}</p><p className="mt-0.5 text-xs text-slate-500">{item.count} students</p></div><p className="shrink-0 text-sm font-semibold text-slate-900">{settings?.currencySymbol || '₹'}{item.amount.toLocaleString('en-IN')}</p></div><div className="h-2 overflow-hidden rounded-full bg-[#F1EAED]"><div className="h-full rounded-full bg-[#6B1F38]" style={{ width: `${percentage}%` }} /></div></div>; })}</div> : <div className="rounded-lg border border-dashed border-[#E5DDE0] px-4 py-8 text-center"><p className="text-sm font-medium text-slate-700">No courses to report yet</p><Link to="/courses" className="mt-2 inline-block text-xs font-semibold text-[#6B1F38]">Set up a course</Link></div>}
        </article>
        <article className="ui-card min-w-0 p-4 sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900">Students needing attention</h2><p className="mt-1 text-xs text-slate-500">Highest outstanding balances.</p></div><Link to="/reminders" className="text-xs font-semibold text-[#6B1F38] hover:underline">View all</Link></div>
          {highDuesStudents.length ? <div className="divide-y divide-[#EEE7EA]">{highDuesStudents.map(student => <div key={student.id} className="flex flex-col gap-3 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8E9ED] text-xs font-semibold text-[#6B1F38]">{student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{student.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{student.parentName} · {student.parentPhone}</p></div></div><div className="flex items-center justify-between gap-3 sm:justify-end"><p className="text-sm font-semibold text-slate-900">{settings?.currencySymbol || '₹'}{student.feesDue.toLocaleString('en-IN')}</p><button onClick={() => navigate(`/payments?student=${student.id}`)} className="rounded-lg bg-[#6B1F38] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#57172D]">Collect</button></div></div>)}</div> : <div className="rounded-lg border border-dashed border-[#E5DDE0] px-4 py-8 text-center text-sm text-slate-500">No outstanding balances need attention.</div>}
        </article>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5DDE0] px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold text-slate-900">Recent transactions</h2><p className="mt-1 text-xs text-slate-500">Latest payments recorded in your institute.</p></div><Link to="/payments" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B1F38] hover:underline">Payment history <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        {payments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead className="bg-[#FCFAFB]"><tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Receipt</th><th className="px-5 py-3">Student</th><th className="px-5 py-3">Payment method</th><th className="px-5 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-[#EEE7EA]">{payments.slice(0, 6).map(payment => <tr key={payment.id} className="transition-colors hover:bg-[#FCFAFB]"><td className="px-5 py-3.5 text-sm font-semibold"><Link to={`/receipts?id=${payment.id}`} className="text-[#6B1F38] hover:underline">{payment.receiptNumber}</Link></td><td className="px-5 py-3.5 text-sm text-slate-800">{payment.studentName}</td><td className="px-5 py-3.5"><span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{payment.paymentMethod}</span></td><td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-900">{settings?.currencySymbol || '₹'}{payment.amount.toLocaleString('en-IN')}</td></tr>)}</tbody></table></div> : <div className="px-5 py-10 text-center"><p className="text-sm font-medium text-slate-700">No payments recorded yet</p><p className="mt-1 text-xs text-slate-500">New fee collections will appear here.</p><Link to="/payments" className="mt-3 inline-flex text-xs font-semibold text-[#6B1F38]">Record first payment</Link></div>}
      </section>
    </div>
  );
};
