import { formatDateForDisplay } from '../lib/date';
import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  BellRing, 
  Search, 
  Send, 
  History, 
  MessageSquare, 
  Mail, 
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  CreditCard,
  ArrowUpDown
} from 'lucide-react';
import { TableSkeleton } from '../components/TableSkeleton';
import { isDemoMode } from '../lib/supabase';
import {
  renderReminderTemplate,
  DEFAULT_INSTALLMENT_REMINDER_TEMPLATE,
  DEFAULT_DIRECT_REMINDER_TEMPLATE
} from '../utils/reminderTemplate';

export const Reminders: React.FC = () => {
  const { students, reminders, installments, installmentPaidTotals, sendBulkReminders, sendReminder, showToast, confirmAction, settings } = useData();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Loading states
  const [isLoading, setIsLoading] = useState(true);

  // Tabs: 'dues' | 'logs'
  const [activeTab, setActiveTab] = useState<'dues' | 'logs'>('dues');
  const [search, setSearch] = useState('');

  // Bulk selection state
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<string[]>([]);
  const [reminderType, setReminderType] = useState<'WhatsApp' | 'SMS' | 'Email'>('WhatsApp');
  
  // Message templates
  const [installmentTemplate, setInstallmentTemplate] = useState(() =>
    settings?.whatsappReminderTemplate || DEFAULT_INSTALLMENT_REMINDER_TEMPLATE
  );
  const [directFeeTemplate, setDirectFeeTemplate] = useState(() =>
    settings?.directFeeReminderTemplate || DEFAULT_DIRECT_REMINDER_TEMPLATE
  );
  const [selectedTemplateType, setSelectedTemplateType] = useState<'installment' | 'direct'>('installment');

  useEffect(() => {
    if (settings?.whatsappReminderTemplate) {
      setInstallmentTemplate(settings.whatsappReminderTemplate);
    }
    if (settings?.directFeeReminderTemplate) {
      setDirectFeeTemplate(settings.directFeeReminderTemplate);
    }
  }, [settings]);

  // Single focus installment for preview
  const [focusedInstallmentId, setFocusedInstallmentId] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<'name' | 'due_date' | 'amount'>('due_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Simulate loader on load or search change
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, [search, activeTab]);

  // Installments and Direct Dues that are Pending or Overdue
  const dueItems = useMemo(() => {
    const items: Array<{
      id: string;
      isDirect: boolean;
      studentId: string;
      student?: (typeof students)[0];
      studentName: string;
      studentRoll: string;
      courseName: string;
      parentName: string;
      parentPhone: string;
      installmentNumber?: number;
      displayInstallment: string;
      amount: number;
      dueDate: string;
      displayDueDate: string;
      status: 'Pending' | 'Overdue';
      remarks?: string;
      remainingFee: number;
    }> = [];

    // Filter active students with positive feesDue
    const activeStudentsWithDue = (students || []).filter(
      s => s.status !== 'Inactive' && s.feesDue > 0
    );

    // Group installments by studentId
    const installmentsByStudent = new Map<string, typeof installments>();
    for (const inst of installments || []) {
      if (!installmentsByStudent.has(inst.studentId)) {
        installmentsByStudent.set(inst.studentId, []);
      }
      installmentsByStudent.get(inst.studentId)!.push(inst);
    }

    for (const student of activeStudentsWithDue) {
      const studentInsts = installmentsByStudent.get(student.id) || [];
      // Unpaid installments, sorted deterministically by installmentNumber, then dueDate, then id
      const unpaidInsts = studentInsts
        .filter(inst => inst.status !== 'Paid')
        .sort((a, b) => (a.installmentNumber - b.installmentNumber) || a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));

      let remainingAllowance = student.feesDue;

      for (const inst of unpaidInsts) {
        if (remainingAllowance <= 0) break;

        const nominalBalance = Math.max(0, inst.amount - (installmentPaidTotals[inst.id] ?? 0));
        if (nominalBalance <= 0) continue;

        // Cap installment reminder amount so sum never exceeds student.feesDue
        const amount = Math.min(nominalBalance, remainingAllowance);
        remainingAllowance -= amount;

        const isOverdue = inst.status === 'Overdue';

        items.push({
          id: inst.id,
          isDirect: false,
          studentId: student.id,
          student,
          studentName: student.name,
          studentRoll: student.rollNumber || '',
          courseName: student.courseName || '',
          parentName: student.parentName || '',
          parentPhone: student.parentPhone || '',
          installmentNumber: inst.installmentNumber,
          displayInstallment: `#${inst.installmentNumber}`,
          amount,
          dueDate: inst.dueDate,
          displayDueDate: formatDateForDisplay(inst.dueDate, settings?.dateFormat) || inst.dueDate,
          status: isOverdue ? 'Overdue' : 'Pending',
          remarks: inst.remarks,
          remainingFee: student.feesDue,
        });
      }

      // If student has direct remainder after accounting for all eligible unpaid installments
      if (remainingAllowance > 0) {
        items.push({
          id: `direct-${student.id}`,
          isDirect: true,
          studentId: student.id,
          student,
          studentName: student.name,
          studentRoll: student.rollNumber || '',
          courseName: student.courseName || '',
          parentName: student.parentName || '',
          parentPhone: student.parentPhone || '',
          installmentNumber: undefined,
          displayInstallment: 'Direct Fee',
          amount: remainingAllowance,
          dueDate: '',
          displayDueDate: '—',
          status: 'Pending',
          remarks: 'Direct fee balance',
          remainingFee: student.feesDue,
        });
      }
    }

    return items;
  }, [students, installments, installmentPaidTotals, settings?.dateFormat]);

  // Load focused student from dashboard query parameters
  useEffect(() => {
    const queryStudentId = searchParams.get('student');
    if (queryStudentId) {
      // Find the first due item (installment or direct) for this student
      const firstDue = dueItems.find(item => item.studentId === queryStudentId);
      if (firstDue) {
        setFocusedInstallmentId(firstDue.id);
        setSelectedTemplateType(firstDue.isDirect ? 'direct' : 'installment');
        setSelectedInstallmentIds(prev => (prev.includes(firstDue.id) ? prev : [firstDue.id]));
        setActiveTab('dues');
      }
    }
  }, [searchParams, dueItems]);

  // Filtered due items list
  const filteredDueInstallments = dueItems.filter(inst => {
    return (
      inst.studentName.toLowerCase().includes(search.toLowerCase()) ||
      inst.studentRoll.toLowerCase().includes(search.toLowerCase()) ||
      inst.courseName.toLowerCase().includes(search.toLowerCase()) ||
      inst.parentName.toLowerCase().includes(search.toLowerCase()) ||
      inst.displayInstallment.toLowerCase().includes(search.toLowerCase()) ||
      (inst.remarks && inst.remarks.toLowerCase().includes(search.toLowerCase()))
    );
  });

  // Sorting logic
  const handleSort = (field: 'name' | 'due_date' | 'amount') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const sortedInstallments = [...filteredDueInstallments].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'name') {
      comparison = a.studentName.localeCompare(b.studentName);
    } else if (sortField === 'due_date') {
      if (!a.dueDate && !b.dueDate) comparison = a.studentName.localeCompare(b.studentName);
      else if (!a.dueDate) comparison = 1;
      else if (!b.dueDate) comparison = -1;
      else comparison = a.dueDate.localeCompare(b.dueDate);
    } else if (sortField === 'amount') {
      comparison = a.amount - b.amount;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedInstallments.length / itemsPerPage);
  const paginatedInstallments = sortedInstallments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Checkbox handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedInstallmentIds(paginatedInstallments.map(i => i.id));
    } else {
      setSelectedInstallmentIds([]);
    }
  };

  const handleSelectOne = (instId: string, checked: boolean) => {
    if (checked) {
      setSelectedInstallmentIds(prev => [...prev, instId]);
      setFocusedInstallmentId(instId);
      const clickedItem = dueItems.find(i => i.id === instId);
      if (clickedItem) {
        setSelectedTemplateType(clickedItem.isDirect ? 'direct' : 'installment');
      }
    } else {
      setSelectedInstallmentIds(prev => prev.filter(id => id !== instId));
      if (focusedInstallmentId === instId) {
        setFocusedInstallmentId(null);
      }
    }
  };

  const parseItemReminder = (
    inst: (typeof dueItems)[0],
    customTemplate?: string
  ) => {
    const templateToUse = customTemplate || (inst.isDirect ? directFeeTemplate : installmentTemplate);
    return renderReminderTemplate(templateToUse, {
      studentName: inst.studentName,
      parentName: inst.parentName,
      installmentNumber: inst.isDirect ? undefined : inst.installmentNumber,
      amount: inst.amount,
      installmentAmount: inst.amount,
      dueDate: inst.isDirect ? '' : (formatDateForDisplay(inst.dueDate, settings?.dateFormat) || ''),
      remainingFee: inst.remainingFee,
      instituteName: settings?.instituteName,
      currencySymbol: settings?.currencySymbol,
      isDirect: inst.isDirect,
    });
  };

  // Resolve target item for live preview based on selected reminder type
  const getPreviewItem = () => {
    const focusedItem = focusedInstallmentId ? dueItems.find(i => i.id === focusedInstallmentId) : null;
    if (selectedTemplateType === 'direct') {
      if (focusedItem?.isDirect) return focusedItem;
      const firstDirect = dueItems.find(i => i.isDirect);
      if (firstDirect) return firstDirect;
      return {
        id: 'mock-direct',
        isDirect: true,
        studentId: 'mock-1',
        studentName: 'Tirth Patel',
        studentRoll: 'ROLL-001',
        courseName: 'General Course',
        parentName: 'P. Patel',
        parentPhone: '9876543210',
        installmentNumber: undefined,
        displayInstallment: 'Direct Fee',
        amount: 12000,
        dueDate: '',
        displayDueDate: '—',
        status: 'Pending' as const,
        remainingFee: 12000,
      };
    } else {
      if (focusedItem && !focusedItem.isDirect) return focusedItem;
      const firstInstallment = dueItems.find(i => !i.isDirect);
      if (firstInstallment) return firstInstallment;
      return {
        id: 'mock-inst',
        isDirect: false,
        studentId: 'mock-2',
        studentName: 'Rahul Sharma',
        studentRoll: 'ROLL-002',
        courseName: 'Foundation Batch',
        parentName: 'Mr. Amit Sharma',
        parentPhone: '9876543210',
        installmentNumber: 1,
        displayInstallment: '#1',
        amount: 5000,
        dueDate: '2026-08-15',
        displayDueDate: '2026-08-15',
        status: 'Pending' as const,
        remainingFee: 10000,
      };
    }
  };

  const previewItem = getPreviewItem();
  const previewMessage = parseItemReminder(
    previewItem,
    selectedTemplateType === 'direct' ? directFeeTemplate : installmentTemplate
  );

  // Generate dynamic WhatsApp link using parsed template text
  const getWhatsAppLink = (inst: (typeof dueItems)[0]) => {
    const message = parseItemReminder(inst);
    const cleanPhone = (inst.parentPhone || '').replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
  };

  // Send single/bulk reminder trigger
  const handleSendReminders = () => {
    if (selectedInstallmentIds.length === 0) {
      showToast('Please select at least one item to send reminders.', 'error');
      return;
    }

    confirmAction({
      title: 'Send Fee Reminders',
      message: `Add reminders for ${selectedInstallmentIds.length} selected item(s) to the ${reminderType} queue? They will be recorded as queued, not sent automatically.`,
      confirmText: 'Queue Reminders',
      type: 'primary',
      onConfirm: () => {
        void sendBulkReminders(selectedInstallmentIds, reminderType).then(() => {
          showToast(`Reminders queued for ${selectedInstallmentIds.length} selected item(s).`, 'success');
          setSelectedInstallmentIds([]);
          setFocusedInstallmentId(null);
        }).catch((error: unknown) => {
          showToast(error instanceof Error ? error.message : 'Could not queue reminders.', 'error');
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Dues & Reminders</h1>
          <p className="text-sm text-slate-500 mt-1">Review outstanding dues, queue reminders, or open WhatsApp manually. Messages are never sent automatically.</p>
        </div>

        {/* Tab Toggle buttons */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl self-start no-print">
          <button 
            onClick={() => setActiveTab('dues')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'dues' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Outstanding Dues</span>
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'logs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Reminder Logs</span>
          </button>
        </div>
      </div>

      {activeTab === 'dues' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Main Dues Table (Left columns) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center no-print">
              <div className="relative w-full sm:max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input 
                  type="text" 
                  placeholder="Search name, course, parent..." 
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50"
                />
              </div>

              <div className="text-xs font-semibold text-slate-500 shrink-0">
                {selectedInstallmentIds.length} of {filteredDueInstallments.length} selected
              </div>
            </div>

            {/* Table Content */}
            {isLoading ? (
              <TableSkeleton columnCount={5} rowCount={itemsPerPage} />
            ) : (
              <div className="space-y-4">
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider select-none">
                          <th className="px-4 py-3 text-center w-12 no-print">
                            <input 
                              type="checkbox"
                              onChange={handleSelectAll}
                              checked={paginatedInstallments.length > 0 && paginatedInstallments.every(i => selectedInstallmentIds.includes(i.id))}
                              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </th>
                          <th 
                            onClick={() => handleSort('name')}
                            className="px-4 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors"
                          >
                            <div className="flex items-center gap-1">
                              <span>Student</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="px-4 py-3">Parent</th>
                          <th className="px-4 py-3 text-center">Installment</th>
                          <th 
                            onClick={() => handleSort('amount')}
                            className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100/50 transition-colors"
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>Amount</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort('due_date')}
                            className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100/50 transition-colors"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>Due Date</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-center no-print">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {paginatedInstallments.length > 0 ? (
                          paginatedInstallments.map(inst => (
                            <tr 
                              key={inst.id} 
                              onClick={() => {
                                setFocusedInstallmentId(inst.id);
                                setSelectedTemplateType(inst.isDirect ? 'direct' : 'installment');
                              }}
                              className={`hover:bg-slate-50/40 cursor-pointer transition-colors
                                ${focusedInstallmentId === inst.id ? 'bg-blue-50/30' : ''}
                              `}
                            >
                              <td className="px-4 py-3.5 text-center no-print" onClick={(e) => e.stopPropagation()}>
                                <input 
                                  type="checkbox"
                                  checked={selectedInstallmentIds.includes(inst.id)}
                                  onChange={(e) => handleSelectOne(inst.id, e.target.checked)}
                                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="font-semibold text-slate-800 text-sm">{inst.studentName}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{inst.courseName}</div>
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="font-medium text-slate-700">{inst.parentName}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{inst.parentPhone}</div>
                              </td>
                              <td className="px-4 py-3.5 text-center font-semibold text-slate-700">
                                {inst.isDirect ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    Direct Fee
                                  </span>
                                ) : (
                                  inst.displayInstallment
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                                {settings?.currencySymbol || '₹'}{inst.amount.toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-3.5 text-center font-medium text-slate-600">
                                {inst.displayDueDate}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border
                                  ${inst.status === 'Overdue' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}
                                `}>
                                  {inst.status}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center no-print" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <a
                                    href={isDemoMode ? undefined : getWhatsAppLink(inst)}
                                    target={isDemoMode ? undefined : '_blank'}
                                    rel={isDemoMode ? undefined : 'noreferrer'}
                                    aria-disabled={isDemoMode}
                                    onClick={event => {
                                      if (isDemoMode) {
                                        event.preventDefault();
                                        showToast('Demo mode: no WhatsApp message was sent.', 'info');
                                        return;
                                      }
                                      void sendReminder(inst.studentId, 'WhatsApp', inst.id).then(() => {
                                        showToast('WhatsApp reminder marked as manually opened. Delivery is not confirmed.', 'info');
                                      }).catch((error: unknown) => {
                                        showToast(error instanceof Error ? error.message : 'Could not record the reminder.', 'error');
                                      });
                                    }}
                                    title={isDemoMode ? 'Demo mode: WhatsApp messages are disabled.' : 'Send WhatsApp Reminder'}
                                    className={`p-1.5 border border-emerald-250 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors ${isDemoMode ? 'cursor-not-allowed opacity-60' : ''}`}
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>
                                  <button
                                    onClick={() => navigate(`/payments?student=${inst.studentId}`)}
                                    title="Collect Fee Payment"
                                    className="p-1.5 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <AlertCircle className="w-6 h-6 text-slate-300" />
                                <span>No pending dues found matching search parameters.</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-500 no-print">
                    <div>
                      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedInstallments.length)} of {sortedInstallments.length} entries
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer select-none transition-all"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalPages }).map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentPage(idx + 1)}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer select-none
                            ${currentPage === idx + 1 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}
                          `}
                        >
                          {idx + 1}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer select-none transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Configurations Sidebar (Right Columns) */}
          <div className="space-y-5 no-print">
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Send className="w-4 h-4 text-blue-600" />
                <span>Send Notifications</span>
              </h3>

              {/* Channel Select */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reminder Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setReminderType('WhatsApp')}
                    className={`flex flex-col items-center justify-center py-2.5 border rounded-xl gap-1 transition-all cursor-pointer
                      ${reminderType === 'WhatsApp' 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' 
                        : 'border-slate-200 text-slate-655 hover:bg-slate-50'}`}
                  >
                    <MessageCircle className="w-5 h-5 shrink-0" />
                    <span className="text-[10px]">WhatsApp</span>
                  </button>
                  <button 
                    onClick={() => setReminderType('SMS')}
                    className={`flex flex-col items-center justify-center py-2.5 border rounded-xl gap-1 transition-all cursor-pointer
                      ${reminderType === 'SMS' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' 
                        : 'border-slate-200 text-slate-655 hover:bg-slate-50'}`}
                  >
                    <MessageSquare className="w-5 h-5 shrink-0" />
                    <span className="text-[10px]">SMS Text</span>
                  </button>
                  <button 
                    onClick={() => setReminderType('Email')}
                    className={`flex flex-col items-center justify-center py-2.5 border rounded-xl gap-1 transition-all cursor-pointer
                      ${reminderType === 'Email' 
                        ? 'border-violet-500 bg-violet-50 text-violet-700 font-bold' 
                        : 'border-slate-200 text-slate-655 hover:bg-slate-50'}`}
                  >
                    <Mail className="w-5 h-5 shrink-0" />
                    <span className="text-[10px]">Email Inbox</span>
                  </button>
                </div>
              </div>

              {/* Message Template input */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateType('installment')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        selectedTemplateType === 'installment'
                          ? 'bg-white text-slate-800 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Installment Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateType('direct')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        selectedTemplateType === 'direct'
                          ? 'bg-white text-slate-800 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Direct Fee Template
                    </button>
                  </div>
                  <span className="text-[9px] text-slate-400">
                    {selectedTemplateType === 'installment'
                      ? 'Tokens: [StudentName], [ParentName], [InstallmentNumber], [Amount], [DueDate], [RemainingFee], [InstituteName]'
                      : 'Tokens: [StudentName], [ParentName], [Amount], [RemainingFee], [InstituteName]'}
                  </span>
                </div>
                <textarea 
                  rows={4}
                  value={selectedTemplateType === 'direct' ? directFeeTemplate : installmentTemplate}
                  onChange={(e) => {
                    if (selectedTemplateType === 'direct') {
                      setDirectFeeTemplate(e.target.value);
                    } else {
                      setInstallmentTemplate(e.target.value);
                    }
                  }}
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 leading-relaxed font-sans"
                />
              </div>

              {/* Action Button */}
              <button 
                onClick={handleSendReminders}
                disabled={selectedInstallmentIds.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Dispatch {selectedInstallmentIds.length} Reminders</span>
              </button>
            </div>

            {/* Template Parser Preview panel */}
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Live Template Preview</span>
              </h4>
              
              <div className="space-y-2">
                <div className="text-[10px] text-slate-450">
                  Showing parsed message for <span className="font-bold text-slate-700">{previewItem.studentName}</span> ({previewItem.isDirect ? 'Direct Fee' : `Installment #${previewItem.installmentNumber || 1}`}):
                </div>
                <div className="bg-white border border-slate-100 rounded-xl p-3.5 text-xs text-slate-600 leading-relaxed shadow-sm font-medium whitespace-pre-wrap">
                  {previewMessage}
                </div>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Reminder Logs History (Logs logs) */
        <div className="space-y-4 max-w-4xl">
          {isLoading ? (
            <TableSkeleton columnCount={5} rowCount={itemsPerPage} />
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-505 uppercase tracking-wider">
                      <th className="px-5 py-3">Recipient Student</th>
                      <th className="px-5 py-3">Recorded</th>
                      <th className="px-5 py-3">Channel</th>
                      <th className="px-5 py-3 text-right">Outstanding Dues</th>
                      <th className="px-5 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {reminders.length > 0 ? (
                      reminders.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/20 transition-colors">
                          <td className="px-5 py-3.5 font-bold text-slate-800">
                            {log.studentName}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500">
                            {log.sentDate}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider inline-block
                              ${log.type === 'WhatsApp' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : ''}
                              ${log.type === 'SMS' ? 'bg-blue-50 text-blue-600 border border-blue-100' : ''}
                              ${log.type === 'Email' ? 'bg-violet-50 text-violet-600 border border-violet-100' : ''}
                            `}>
                              {log.type}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                            {settings?.currencySymbol || '₹'}{log.amountDue.toLocaleString('en-IN')}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              log.status === 'queued' ? 'text-amber-700 bg-amber-50 border-amber-100' :
                              log.status === 'failed' ? 'text-rose-700 bg-rose-50 border-rose-100' :
                              log.status === 'delivered' || log.status === 'sent' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' :
                              'text-blue-700 bg-blue-50 border-blue-100'
                            }`}>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{log.status === 'manual_opened' ? 'Opened manually' : log.status.replace('_', ' ')}</span>
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <AlertCircle className="w-6 h-6 text-slate-300" />
                            <span>No reminder dispatches recorded in history logs.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

