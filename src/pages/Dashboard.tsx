import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { 
  DollarSign, 
  Users, 
  Percent, 
  TrendingUp, 
  Plus, 
  AlertTriangle,
  ArrowRight,
  MessageCircle,
  CreditCard,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PageLoader } from '../components/PageLoader';

export const Dashboard: React.FC = () => {
  const { students, payments, courses, installments, settings, sendReminder } = useData();
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
  const outstandingDues = (installments || [])
    .filter(inst => inst.status !== 'Paid')
    .reduce((sum, inst) => sum + inst.amount, 0);

  // Today's date relative to Temporal Context: 2026-07-06
  const todayStr = '2026-07-06';
  const today = new Date(todayStr);
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(today.getDate() + 7);
  const sevenDaysLaterStr = sevenDaysLater.toISOString().split('T')[0];

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

  const collectionRate = totalFeesExpected > 0 
    ? Math.round((totalRevenue / totalFeesExpected) * 100) 
    : 0;

  // 2. Prepare Data for Monthly Revenue Trend Chart (Custom Interactive SVG Chart)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  const monthlyRevenueMap: { [key: string]: number } = {
    'Jan': 0, 'Feb': 0, 'Mar': 0, 'Apr': 0, 'May': 0, 'Jun': 0, 'Jul': 0
  };

  payments.forEach(p => {
    const monthIndex = parseInt(p.paymentDate.split('-')[1], 10);
    if (!isNaN(monthIndex) && monthIndex >= 1 && monthIndex <= 7) {
      const monthName = months[monthIndex - 1];
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
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Here is a summary of {settings?.instituteName || 'EduLedger'} ERP database statistics.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link 
            to="/admissions" 
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl shadow-sm transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>Admit Student</span>
          </Link>
          <Link 
            to="/payments" 
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-sm px-4 py-2.5 rounded-xl transition-all duration-200"
          >
            <DollarSign className="w-4 h-4" />
            <span>Record Payment</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        {/* Metric 1: Total Collections */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm relative overflow-hidden transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">{settings?.currencySymbol || '₹'}{totalRevenue.toLocaleString('en-IN')}</h3>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full w-max">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.4% monthly</span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-blue-600"></div>
        </div>

        {/* Metric 2: Outstanding Dues */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm relative overflow-hidden transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Dues</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">{settings?.currencySymbol || '₹'}{outstandingDues.toLocaleString('en-IN')}</h3>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full w-max">
              <span>{pendingInstallmentsCount} installments pending</span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-amber-500"></div>
        </div>

        {/* Metric 3: Today's Due */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm relative overflow-hidden transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Due</span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">{settings?.currencySymbol || '₹'}{todaysDue.toLocaleString('en-IN')}</h3>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-600 font-medium bg-rose-50 px-2 py-0.5 rounded-full w-max">
              <span>{todaysDueCount} due/overdue</span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-rose-500"></div>
        </div>

        {/* Metric 4: Upcoming Due (7 Days) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm relative overflow-hidden transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Upcoming (7d)</span>
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">{settings?.currencySymbol || '₹'}{upcomingDue.toLocaleString('en-IN')}</h3>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-sky-600 font-medium bg-sky-50 px-2 py-0.5 rounded-full w-max">
              <span>{upcomingDueCount} upcoming</span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-sky-500"></div>
        </div>

        {/* Metric 3: Active Students */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm relative overflow-hidden transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Students</span>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">{activeStudents.length}</h3>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full w-max">
              <span>Total strength: {students.length}</span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-indigo-600"></div>
        </div>

        {/* Metric 4: Collection Rate */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm relative overflow-hidden transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Collection Rate</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">{collectionRate}%</h3>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full w-max">
              <span>Excellent Collection health</span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-emerald-600"></div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Trend Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Collection History (2026)</h3>
              <p className="text-xs text-slate-400">Monthly aggregate collection performance.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span className="text-xs font-medium text-slate-500">Collected Amount</span>
            </div>
          </div>

          {/* SVG Line/Area Chart */}
          <div className="relative flex-1 min-h-[240px] flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden px-4">
            <svg 
              viewBox={`0 0 ${width} ${height}`} 
              className="w-full h-full"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = paddingY + ratio * (height - 2 * paddingY);
                return (
                  <line 
                    key={i} 
                    x1={paddingX} 
                    y1={y} 
                    x2={width - paddingX} 
                    y2={y} 
                    stroke="#e2e8f0" 
                    strokeWidth="1" 
                    strokeDasharray="4 4"
                  />
                );
              })}

              {areaPath && (
                <path 
                  d={areaPath} 
                  fill="url(#area-gradient)" 
                  opacity="0.3"
                />
              )}

              {linePath && (
                <path 
                  d={linePath} 
                  fill="none" 
                  stroke="#2563eb" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              )}

              {points.map((p, index) => (
                <circle 
                  key={index} 
                  cx={p.x} 
                  cy={p.y} 
                  r={hoveredPoint?.index === index ? 6 : 4} 
                  fill={hoveredPoint?.index === index ? '#2563eb' : '#ffffff'} 
                  stroke="#2563eb" 
                  strokeWidth="3"
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => {
                    setHoveredPoint({
                      index,
                      x: p.x,
                      y: p.y,
                      val: p.val,
                      label: p.label
                    });
                  }}
                />
              ))}

              {points.map((p, index) => (
                <text 
                  key={index} 
                  x={p.x} 
                  y={height - 10} 
                  textAnchor="middle" 
                  className="text-[10px] font-semibold fill-slate-400"
                >
                  {p.label}
                </text>
              ))}

              <defs>
                <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>
            </svg>

            {hoveredPoint && (
              <div 
                className="absolute bg-slate-900 text-white rounded-lg px-2.5 py-1.5 text-xs shadow-md border border-slate-800 pointer-events-none transition-all duration-150"
                style={{
                  left: `${(hoveredPoint.x / width) * 100}%`,
                  top: `${(hoveredPoint.y / height) * 100 - 18}%`,
                  transform: 'translate(-50%, -100%)'
                }}
              >
                <div className="font-semibold text-[10px] text-slate-400">{hoveredPoint.label}</div>
                <div className="font-bold text-blue-400">{settings?.currencySymbol || '₹'}{hoveredPoint.val.toLocaleString('en-IN')}</div>
              </div>
            )}
          </div>
        </div>

        {/* Course-wise fee collection distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Course Collections</h3>
            <p className="text-xs text-slate-400 mb-4">Revenue share by course type.</p>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {courseCollection.map((item, index) => {
              const percentage = maxCourseAmt > 0 ? (item.amount / maxCourseAmt) * 100 : 0;
              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700 truncate max-w-[150px]" title={item.fullName}>
                      {item.fullName}
                    </span>
                    <span className="text-slate-800 font-bold shrink-0">{settings?.currencySymbol || '₹'}{item.amount.toLocaleString('en-IN')}</span>
                  </div>
                  
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>{item.count} students enrolled</span>
                    <span>{Math.round((item.amount / (totalRevenue || 1)) * 100)}% contribution</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid: Pending Dues list & Recent Payments list */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Dues alert list */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Pending Dues Alert</h3>
              <p className="text-xs text-slate-400">Students with the largest outstanding fees.</p>
            </div>
            <Link 
              to="/reminders" 
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 hover:underline"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1 space-y-3.5">
            {highDuesStudents.length > 0 ? (
              highDuesStudents.map(student => (
                <div key={student.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center font-bold text-xs shrink-0">
                        {student.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-850 truncate">{student.name}</h4>
                        <div className="text-[10px] text-slate-450 mt-0.5 truncate">Parent: <span className="font-semibold text-slate-700">{student.parentName}</span></div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">WhatsApp: <span className="font-semibold text-slate-600">{student.parentPhone}</span></div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Pending</span>
                      <span className="text-xs font-bold text-amber-600">{settings?.currencySymbol || '₹'}{student.feesDue.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-0.5">
                    <a
                      href={`https://wa.me/91${student.parentPhone}?text=${encodeURIComponent(
                        (settings?.whatsappReminderTemplate || 'Dear {ParentName}, this is a gentle reminder that an outstanding fee of {Amount} is due for {StudentName}.')
                          .replace(/{ParentName}/g, student.parentName)
                          .replace(/{StudentName}/g, student.name)
                          .replace(/{Amount}/g, `${settings?.currencySymbol || '₹'}${student.feesDue.toLocaleString('en-IN')}`)
                          .replace(/{DueDate}/g, 'N/A')
                          .replace(/{InstituteName}/g, settings?.instituteName || 'EduLedger')
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => sendReminder(student.id, 'WhatsApp')}
                      className="flex items-center justify-center gap-1 border border-emerald-250 bg-emerald-50/20 hover:bg-emerald-50/40 text-emerald-700 font-bold text-[10px] py-1.5 rounded-lg transition-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                    <button
                      onClick={() => navigate(`/payments?student=${student.id}`)}
                      className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Collect Fee</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-6 text-xs">
                All students up to date!
              </div>
            )}
          </div>
        </div>

        {/* Recent payments table */}
        <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Recent Collections</h3>
              <p className="text-xs text-slate-400">Latest recorded fee receipts.</p>
            </div>
            <Link 
              to="/payments" 
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 hover:underline"
            >
              <span>View History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-2">Receipt</th>
                  <th className="pb-2">Student</th>
                  <th className="pb-2">Method</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {payments.slice(0, 5).map(payment => (
                  <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 font-semibold text-slate-700">
                      <Link 
                        to={`/receipts?id=${payment.id}`}
                        className="text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        {payment.receiptNumber}
                      </Link>
                    </td>
                    <td className="py-2.5 text-slate-800 font-medium">
                      {payment.studentName}
                    </td>
                    <td className="py-2.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold text-[10px]">
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-800">
                      {settings?.currencySymbol || '₹'}{payment.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
