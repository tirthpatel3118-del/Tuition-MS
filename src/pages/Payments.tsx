import { formatDateForDisplay } from '../lib/date';
import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Installment, Payment } from '../data/mockData';
import { 
  CreditCard, 
  Search, 
  Plus, 
  FileText, 
  AlertCircle,
  Eye,
  CheckCircle2,
  ArrowUpDown,
  Loader2,
  ChevronDown,
  X
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { TableSkeleton } from '../components/TableSkeleton';
import { isSupabaseConfigured } from '../lib/supabase';

export const Payments: React.FC = () => {
  const { students, payments, installments, installmentPaidTotals, recordPayment, showToast, confirmAction, settings } = useData();
  const [searchParams] = useSearchParams();

  // Tabs: 'ledger' | 'collect'
  const [activeTab, setActiveTab] = useState<'ledger' | 'collect'>('ledger');
  
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');

  // Sorting state
  const [sortField, setSortField] = useState<'receipt' | 'name' | 'date' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Loading states
  const [isLoadingTable, setIsLoadingTable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedInstallmentId, setSelectedInstallmentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Payment['paymentMethod']>('UPI');
  const [transactionId, setTransactionId] = useState('');
  const [remarks, setRemarks] = useState('');

  // Searchable Combobox State
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const comboboxRef = React.useRef<HTMLDivElement>(null);

  // Form Validation & Success State
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [successInfo, setSuccessInfo] = useState<{ receiptId: string; amount: number; studentName: string } | null>(null);

  const outstandingInstallmentAmount = (installment: Installment) =>
    Math.max(0, Number(installment.amount) - (installmentPaidTotals[installment.id] ?? 0));
  const getUnpaidInstallments = (studentId: string) => installments
    .filter(installment => installment.studentId === studentId
      && installment.status !== 'Paid'
      && outstandingInstallmentAmount(installment) > 0)
    .sort((a, b) => a.installmentNumber - b.installmentNumber);

  // Trigger simulated loader when filter/tab changes
  useEffect(() => {
    setCurrentPage(1);
    setIsLoadingTable(true);
    const timer = setTimeout(() => setIsLoadingTable(false), 400);
    return () => clearTimeout(timer);
  }, [search, methodFilter, activeTab]);

  // Read URL query parameter for student shortcut collections
  useEffect(() => {
    const studentId = searchParams.get('student');
    if (studentId) {
      const student = students.find(s => s.id === studentId);
      if (student && student.status === 'Active' && student.feesDue > 0) {
        setSelectedStudentId(studentId);
        
        // Find pending/overdue installments for this student
        const studentInsts = getUnpaidInstallments(studentId);

        if (studentInsts.length > 0) {
          setSelectedInstallmentId(studentInsts[0].id);
          setPaymentAmount(String(outstandingInstallmentAmount(studentInsts[0])));
        } else {
          setPaymentAmount(String(student.feesDue));
        }

        setActiveTab('collect');
      }
    }
  }, [searchParams, students, installments, installmentPaidTotals]);

  // Selected student details for validation & helpers
  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const selectedStudentInstallments = getUnpaidInstallments(selectedStudentId);

  // Filter students based on search term
  const eligibleStudents = students.filter(s => s.status !== 'Inactive' && s.feesDue > 0);
  const filteredStudents = eligibleStudents.filter(s => {
    const term = studentSearchInput.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      s.rollNumber.toLowerCase().includes(term) ||
      (s.phone && s.phone.toLowerCase().includes(term))
    );
  });

  // Synchronize studentSearchInput when selectedStudentId changes
  useEffect(() => {
    if (selectedStudentId) {
      const student = students.find(s => s.id === selectedStudentId);
      if (student) {
        setStudentSearchInput(student.name);
      }
    } else {
      setStudentSearchInput('');
    }
  }, [selectedStudentId, students]);

  // Click outside handler for combobox
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [studentSearchInput]);

  const handleInputFocus = () => {
    setIsComboboxOpen(true);
    setStudentSearchInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isComboboxOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsComboboxOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredStudents.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev > 0 ? prev - 1 : filteredStudents.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredStudents.length) {
        handleStudentChange(filteredStudents[highlightedIndex].id);
        setIsComboboxOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsComboboxOpen(false);
    }
  };

  const handleStudentChange = (studentId: string) => {
    setSelectedStudentId(studentId);
    setSelectedInstallmentId('');
    setFormErrors(prev => ({ ...prev, studentId: '' }));
    
    // Find pending/overdue installments for this student
    const studentInsts = getUnpaidInstallments(studentId);

    if (studentInsts.length > 0) {
      setSelectedInstallmentId(studentInsts[0].id);
      setPaymentAmount(String(outstandingInstallmentAmount(studentInsts[0])));
    } else {
      const student = students.find(s => s.id === studentId);
      setPaymentAmount(student ? String(student.feesDue) : '');
    }
  };

  const handleInstallmentChange = (instId: string) => {
    setSelectedInstallmentId(instId);
    setFormErrors(prev => ({ ...prev, installmentId: '' }));
    const inst = installments.find(i => i.id === instId);
    if (inst) {
      setPaymentAmount(String(outstandingInstallmentAmount(inst)));
    }
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!selectedStudentId) {
      errors.studentId = 'Please select an enrolled student';
    }

    // Check if the student has pending installments, and one must be selected
    const studentInsts = getUnpaidInstallments(selectedStudentId);
    if ((studentInsts.length > 0 || isSupabaseConfigured) && !selectedInstallmentId) {
      errors.installmentId = 'Please select which installment this payment is for';
    }

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      errors.amount = 'Please enter a valid amount greater than 0';
    } else if (selectedStudent) {
      if (selectedInstallmentId) {
        const targetInst = installments.find(i => i.id === selectedInstallmentId);
        const outstandingAmount = targetInst ? outstandingInstallmentAmount(targetInst) : 0;
        if (targetInst && amountNum > outstandingAmount) {
          errors.amount = `Amount exceeds selected installment balance of ${settings?.currencySymbol || '₹'}${outstandingAmount.toLocaleString('en-IN')}`;
        }
      } else if (amountNum > selectedStudent.feesDue) {
        errors.amount = `Amount exceeds outstanding student due of ${settings?.currencySymbol || '₹'}${selectedStudent.feesDue.toLocaleString('en-IN')}`;
      }
    }

    if (paymentMethod !== 'Cash' && !transactionId.trim()) {
      errors.transactionId = `Transaction/Reference ID is required for ${paymentMethod} payment`;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const amountNum = parseFloat(paymentAmount);
    const studentName = selectedStudent ? selectedStudent.name : '';

    confirmAction({
      title: 'Confirm Fee Collection',
      message: `Record fee payment of ${settings?.currencySymbol || '₹'}${amountNum.toLocaleString('en-IN')} for ${studentName} via ${paymentMethod}? This transaction will reduce their outstanding balance due.`,
      confirmText: 'Confirm Payment',
      type: 'success',
      onConfirm: () => {
        setIsSubmitting(true);
        void (async () => {
          try {
            const createdPayment = await recordPayment({
              studentId: selectedStudentId,
              amount: amountNum,
              paymentMethod,
              transactionId: paymentMethod === 'Cash' ? undefined : transactionId,
              remarks
            }, selectedInstallmentId || undefined);

            showToast(`Payment of ${settings?.currencySymbol || '₹'}${amountNum} recorded for ${studentName}!`, 'success');
            
            // Display Success Box
            setSuccessInfo({
              receiptId: createdPayment.id,
              amount: createdPayment.amount,
              studentName: createdPayment.studentName
            });

            // Clear Form fields
            setSelectedStudentId('');
            setSelectedInstallmentId('');
            setPaymentAmount('');
            setTransactionId('');
            setRemarks('');
            setFormErrors({});
          } catch (err: any) {
            showToast(err.message || 'Error recording payment', 'error');
          } finally {
            setIsSubmitting(false);
          }
        })();
      }
    });
  };

  // Sorting columns
  const handleSort = (field: 'receipt' | 'name' | 'date' | 'amount') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtered Payments History
  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      p.studentName.toLowerCase().includes(search.toLowerCase()) ||
      p.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.courseName.toLowerCase().includes(search.toLowerCase()) ||
      (p.transactionId && p.transactionId.toLowerCase().includes(search.toLowerCase()));

    const matchesMethod = methodFilter === 'All' || p.paymentMethod === methodFilter;

    return matchesSearch && matchesMethod;
  });

  // Sort logic applied
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'receipt') {
      comparison = a.receiptNumber.localeCompare(b.receiptNumber);
    } else if (sortField === 'name') {
      comparison = a.studentName.localeCompare(b.studentName);
    } else if (sortField === 'date') {
      comparison = a.paymentDate.localeCompare(b.paymentDate);
    } else if (sortField === 'amount') {
      comparison = a.amount - b.amount;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Pagination calculation
  const totalPages = Math.ceil(sortedPayments.length / itemsPerPage);
  const paginatedPayments = sortedPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Fee Collection</h1>
          <p className="text-sm text-slate-500 mt-1">Record student tuition payments, manage receipt registers, and audit transaction logs.</p>
        </div>

        {/* Tab Toggle buttons */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl self-start no-print">
          <button 
            onClick={() => { setActiveTab('ledger'); setSuccessInfo(null); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'ledger' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Collection Ledger
          </button>
          <button 
            onClick={() => { setActiveTab('collect'); setSuccessInfo(null); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${activeTab === 'collect' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {activeTab === 'ledger' ? (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm no-print">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Search student, receipt, transaction..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 shrink-0 uppercase tracking-wider">Method:</span>
              <select 
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50 cursor-pointer"
              >
                <option value="All">All Methods</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Cheque">Cheque</option>
                <option value="Net Banking">Net Banking</option>
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          {isLoadingTable ? (
            <TableSkeleton columnCount={7} rowCount={itemsPerPage} />
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
                        <th 
                          onClick={() => handleSort('receipt')}
                          className="px-5 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Receipt No.</span>
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('name')}
                          className="px-5 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Student Name</span>
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </th>
                        <th className="px-5 py-3">Course</th>
                        <th 
                          onClick={() => handleSort('date')}
                          className="px-5 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Payment Date</span>
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </th>
                        <th className="px-5 py-3">Method</th>
                        <th 
                          onClick={() => handleSort('amount')}
                          className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100/50 transition-colors"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>Amount</span>
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </th>
                        <th className="px-5 py-3 text-center no-print">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {paginatedPayments.length > 0 ? (
                        paginatedPayments.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-slate-700">
                              {p.receiptNumber}
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-slate-800">
                              {p.studentName}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 font-medium">
                              {p.courseName}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500">
                              {formatDateForDisplay(p.paymentDate, settings?.dateFormat)}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] inline-block
                                ${p.paymentMethod === 'UPI' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : ''}
                                ${p.paymentMethod === 'Cash' ? 'bg-amber-50 text-amber-600 border border-amber-100' : ''}
                                ${p.paymentMethod === 'Card' ? 'bg-sky-50 text-sky-600 border border-sky-100' : ''}
                                ${p.paymentMethod === 'Cheque' ? 'bg-violet-50 text-violet-600 border border-violet-100' : ''}
                                ${p.paymentMethod === 'Net Banking' ? 'bg-teal-50 text-teal-600 border border-teal-100' : ''}
                              `}>
                                {p.paymentMethod}
                              </span>
                              {p.transactionId && (
                                <span className="block text-[9px] text-slate-400 mt-0.5 max-w-[120px] truncate" title={p.transactionId}>
                                  ID: {p.transactionId}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                              {settings?.currencySymbol || '₹'}{p.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="px-5 py-3 text-center no-print">
                              <Link 
                                to={`/receipts?id=${p.id}`}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View</span>
                              </Link>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                              <AlertCircle className="w-7 h-7 text-slate-300" />
                              <span>No recorded transactions found matching parameters.</span>
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
                <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-505 no-print">
                  <div>
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedPayments.length)} of {sortedPayments.length} entries
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
                            : 'bg-white text-slate-655 border-slate-200 hover:bg-slate-50'}
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
      ) : (
        /* Record Payment Form */
        <div className="max-w-2xl bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-1.5">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <span>Collect Course Fee Payment</span>
          </h3>

          {successInfo && (
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-in">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-950">Payment Recorded Successfully!</h4>
                  <p className="text-emerald-700 mt-1">{settings?.currencySymbol || '₹'}{successInfo.amount.toLocaleString('en-IN')} collected from {successInfo.studentName}.</p>
                </div>
              </div>
              <Link 
                to={`/receipts?id=${successInfo.receiptId}`}
                className="shrink-0 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors self-start sm:self-center cursor-pointer shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Show Receipt</span>
              </Link>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Student Dropdown -> Replaced with searchable combobox */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-655">Select Student (Outstanding Balance Due) <span className="text-rose-500">*</span></label>
                <div className="relative student-combobox-container" ref={comboboxRef}>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search student by name, roll number, or phone..."
                      value={isComboboxOpen ? studentSearchInput : (selectedStudent ? `${selectedStudent.name} (${selectedStudent.rollNumber})` : '')}
                      onFocus={handleInputFocus}
                      onChange={(e) => {
                        setStudentSearchInput(e.target.value);
                        setIsComboboxOpen(true);
                      }}
                      onKeyDown={handleKeyDown}
                      className={`w-full pl-10 pr-12 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white cursor-text transition-all ${formErrors.studentId ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'}`}
                    />
                    <div className="absolute right-3.5 top-3 flex items-center gap-1.5">
                      {selectedStudent && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStudentChange('');
                          }}
                          className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsComboboxOpen(prev => !prev);
                        }}
                        className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isComboboxOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Dropdown Options */}
                  {isComboboxOpen && (
                    <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto divide-y divide-slate-100 focus:outline-none animate-in fade-in slide-in-from-top-1 duration-100">
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map((s, index) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              handleStudentChange(s.id);
                              setIsComboboxOpen(false);
                            }}
                            className={`px-4 py-3 cursor-pointer transition-colors duration-150 flex flex-col items-start 
                              ${highlightedIndex === index 
                                ? 'bg-blue-600 text-white font-medium' 
                                : selectedStudentId === s.id 
                                  ? 'bg-blue-50/50 hover:bg-blue-50' 
                                  : 'hover:bg-slate-50'
                              }`}
                          >
                            <div className="flex justify-between w-full items-center">
                              <span className={`font-semibold text-sm ${highlightedIndex === index ? 'text-white' : 'text-slate-800'}`}>{s.name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono 
                                ${highlightedIndex === index 
                                  ? 'bg-blue-700/50 text-blue-100' 
                                  : 'bg-slate-100 text-slate-655'
                                }`}
                              >
                                {s.rollNumber}
                              </span>
                            </div>
                            <div className={`text-[11px] mt-1 flex items-center gap-1 
                              ${highlightedIndex === index ? 'text-blue-100' : 'text-slate-400'}`}
                            >
                              <span>{s.courseName}</span>
                              <span className={highlightedIndex === index ? 'text-blue-300' : 'text-slate-300'}>•</span>
                              <span>{s.batch}</span>
                            </div>
                            {s.phone && (
                              <div className={`text-[10px] mt-0.5 font-medium 
                                ${highlightedIndex === index ? 'text-blue-200' : 'text-slate-400'}`}
                              >
                                Phone: {s.phone}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center text-slate-400 text-xs">
                          No active students found matching "{studentSearchInput}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {formErrors.studentId && <span className="text-[10px] text-rose-600 font-bold block">{formErrors.studentId}</span>}
              </div>

              {/* Student Ledger Quick summary */}
              {selectedStudent && (
                <div className="sm:col-span-2 bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2 animate-fade-in">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-500">Selected Course:</span>
                    <span className="font-bold text-slate-800">{selectedStudent.courseName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-500">Batch Assignment:</span>
                    <span className="font-bold text-slate-800">{selectedStudent.batch}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/50 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Total Fees</span>
                      <span className="font-bold text-slate-800 text-xs">{settings?.currencySymbol || '₹'}{selectedStudent.totalFees.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Already Paid</span>
                      <span className="font-bold text-emerald-600 text-xs">{settings?.currencySymbol || '₹'}{selectedStudent.feesPaid.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Balance Due</span>
                      <span className="font-bold text-amber-600 text-xs">{settings?.currencySymbol || '₹'}{selectedStudent.feesDue.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Installment Selection (Requirement 2) */}
              {selectedStudent && (
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-655">Select Installment <span className="text-rose-500">*</span></label>
                  <select
                    value={selectedInstallmentId}
                    onChange={(e) => handleInstallmentChange(e.target.value)}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white cursor-pointer ${formErrors.installmentId ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'}`}
                  >
                    {selectedStudentInstallments.length > 0 ? (
                      <>
                        <option value="">-- Choose Installment --</option>
                        {selectedStudentInstallments.map(inst => (
                            <option key={inst.id} value={inst.id}>
                              Installment #{inst.installmentNumber} — Balance: {settings?.currencySymbol || '₹'}{outstandingInstallmentAmount(inst).toLocaleString('en-IN')} (Due: {formatDateForDisplay(inst.dueDate, settings?.dateFormat)}) {inst.remarks ? `[${inst.remarks}]` : ''}
                            </option>
                          ))
                        }
                      </>
                    ) : (
                      <option value="">No pending/overdue installments. Collecting a custom payment.</option>
                    )}
                  </select>
                  {formErrors.installmentId && <span className="text-[10px] text-rose-600 font-bold block">{formErrors.installmentId}</span>}
                </div>
              )}

              {/* Payment Amount */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Payment Amount ({settings?.currencySymbol || '₹'}) <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <div className="absolute left-3.5 top-2.5 text-slate-400 font-semibold text-sm">{settings?.currencySymbol || '₹'}</div>
                  <input 
                    type="number" 
                    value={paymentAmount}
                    onChange={(e) => {
                      setPaymentAmount(e.target.value);
                      if (e.target.value) setFormErrors(prev => ({ ...prev, amount: '' }));
                    }}
                    placeholder="Enter amount"
                    className={`w-full pl-8 pr-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold text-slate-850 ${formErrors.amount ? 'border-rose-305 bg-rose-50/20' : 'border-slate-200'}`}
                  />
                </div>
                {formErrors.amount && <span className="text-[10px] text-rose-600 font-bold block">{formErrors.amount}</span>}
              </div>

              {/* Payment Method */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Payment Method <span className="text-rose-500">*</span></label>
                <select 
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as Payment['paymentMethod'])}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white cursor-pointer"
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Net Banking">Net Banking</option>
                </select>
              </div>

              {/* Reference ID */}
              {paymentMethod !== 'Cash' && (
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-600">
                    Transaction ID / Reference Number <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={transactionId}
                    onChange={(e) => {
                      setTransactionId(e.target.value);
                      if (e.target.value) setFormErrors(prev => ({ ...prev, transactionId: '' }));
                    }}
                    placeholder={
                      paymentMethod === 'UPI' ? 'UPI Reference Number (e.g. TXN9876543)' :
                      paymentMethod === 'Cheque' ? 'Cheque Number (e.g. CHQ-554433)' :
                      'Reference Transaction ID number'
                    }
                    className={`w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${formErrors.transactionId ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'}`}
                  />
                  {formErrors.transactionId && <span className="text-[10px] text-rose-600 font-bold block">{formErrors.transactionId}</span>}
                </div>
              )}

              {/* Remarks */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-600">Remarks / Description</label>
                <input 
                  type="text" 
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Second installment paid, partial payment."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>

            {/* Form actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => { setActiveTab('ledger'); setSuccessInfo(null); }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmitting ? 'Recording...' : 'Record Payment'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

