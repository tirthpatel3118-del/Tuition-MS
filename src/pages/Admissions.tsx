import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Student, Installment } from '../data/mockData';
import { 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit3, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  BookOpen, 
  FileText, 
  X,
  CreditCard,
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { TableSkeleton } from '../components/TableSkeleton';

export const Admissions: React.FC = () => {
  const { 
    students, 
    courses, 
    payments, 
    installments,
    addStudent, 
    updateStudent, 
    deleteStudent,
    showToast,
    confirmAction,
    settings
  } = useData();

  // Tabs: 'directory' | 'add'
  const [activeTab, setActiveTab] = useState<'directory' | 'add'>('directory');
  
  // Search & Filter State
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Sorting state
  const [sortField, setSortField] = useState<'roll' | 'name' | 'paid' | 'due' | 'status'>('roll');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Selected student for detail side-panel
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Loading indicator for table searches
  const [isLoadingTable, setIsLoadingTable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States (for Add & Edit)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    parentName: '',
    parentPhone: '',
    courseId: '',
    batch: '',
    totalFees: 0,
    status: 'Active' as Student['status'],
    notes: '',
  });

  const [plannedInstallments, setPlannedInstallments] = useState<Omit<Installment, 'studentId' | 'createdAt'>[]>([]);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const [selectedInstCount, setSelectedInstCount] = useState<number>(3);
  const [firstDueDate, setFirstDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [frequency, setFrequency] = useState<string>('monthly');

  const calculateDueDate = (start: string, freq: string, index: number): string => {
    if (!start) return new Date().toISOString().split('T')[0];
    const date = new Date(start);
    if (freq === 'custom') {
      date.setMonth(date.getMonth() + index);
      return date.toISOString().split('T')[0];
    }
    const monthsToAdd = freq === 'monthly' ? 1 : freq === '2months' ? 2 : freq === '3months' ? 3 : 1;
    date.setMonth(date.getMonth() + index * monthsToAdd);
    return date.toISOString().split('T')[0];
  };

  const applyDatesToInstallments = (start: string, freq: string, currentInsts: typeof plannedInstallments) => {
    return currentInsts.map((inst, index) => {
      if (inst.status === 'Paid') return inst;
      return {
        ...inst,
        dueDate: calculateDueDate(start, freq, index)
      };
    });
  };

  const handleFirstDueDateChange = (val: string) => {
    setFirstDueDate(val);
    setPlannedInstallments(prev => applyDatesToInstallments(val, frequency, prev));
  };

  const handleFrequencyChange = (val: string) => {
    setFrequency(val);
    setPlannedInstallments(prev => applyDatesToInstallments(firstDueDate, val, prev));
  };

  const handleAutoGenerate = () => {
    const fee = formData.totalFees || 0;
    const finalCount = selectedInstCount > 0 ? selectedInstCount : (plannedInstallments.length || 3);
    const paidInsts = plannedInstallments.filter(inst => inst.status === 'Paid');
    const unpaidCount = finalCount - paidInsts.length;
    
    if (unpaidCount <= 0 && finalCount > 0) {
      showToast('All planned installments are already paid.', 'error');
      return;
    }

    const paidTotal = paidInsts.reduce((sum, inst) => sum + inst.amount, 0);
    const remainingFee = Math.max(0, fee - paidTotal);

    const baseAmount = Math.floor(remainingFee / unpaidCount);
    const remainder = remainingFee - (baseAmount * unpaidCount);

    const generated: Omit<Installment, 'studentId' | 'createdAt'>[] = [];
    let unpaidIndex = 0;

    for (let i = 0; i < finalCount; i++) {
      const existingPaid = paidInsts.find(p => p.installmentNumber === i + 1);
      if (existingPaid) {
        generated.push(existingPaid);
      } else {
        const amount = unpaidIndex === unpaidCount - 1 ? baseAmount + remainder : baseAmount;
        const dueDate = calculateDueDate(firstDueDate, frequency, i);
        generated.push({
          id: '',
          installmentNumber: i + 1,
          amount,
          dueDate,
          status: 'Pending',
          remarks: ''
        });
        unpaidIndex++;
      }
    }

    setPlannedInstallments(generated);
  };

  const totalPlannedInstallments = plannedInstallments.reduce((sum, inst) => sum + inst.amount, 0);
  const remainingAllocation = (formData.totalFees || 0) - totalPlannedInstallments;
  const isAllocationComplete = remainingAllocation === 0;

  const addInstallmentRow = () => {
    const nextNumber = plannedInstallments.length + 1;
    const totalAllocated = plannedInstallments.reduce((sum, inst) => sum + inst.amount, 0);
    const suggestedAmount = Math.max(0, formData.totalFees - totalAllocated);
    
    setPlannedInstallments(prev => [
      ...prev,
      {
        id: '',
        installmentNumber: nextNumber,
        amount: suggestedAmount,
        dueDate: new Date().toISOString().split('T')[0],
        status: 'Pending',
        remarks: ''
      }
    ]);
  };

  const removeInstallmentRow = (index: number) => {
    const inst = plannedInstallments[index];
    if (inst && inst.status === 'Paid') {
      showToast('Cannot delete a paid installment.', 'error');
      return;
    }
    setPlannedInstallments(prev => {
      const updated = prev.filter((_, idx) => idx !== index);
      return updated.map((item, idx) => ({
        ...item,
        installmentNumber: idx + 1
      }));
    });
  };

  const updateInstallmentRow = (index: number, fields: Partial<typeof plannedInstallments[0]>) => {
    const inst = plannedInstallments[index];
    if (inst && inst.status === 'Paid') {
      showToast('Cannot edit a paid installment.', 'error');
      return;
    }
    setPlannedInstallments(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, ...fields };
      }
      return item;
    }));
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setIsLoadingTable(true);
    const timer = setTimeout(() => setIsLoadingTable(false), 400);
    return () => clearTimeout(timer);
  }, [search, selectedCourse, selectedStatus]);

  // Load course fee when a course is selected
  const handleCourseChange = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    setFormData(prev => ({
      ...prev,
      courseId,
      totalFees: course ? course.fees : 0
    }));
    // Clear validation error on selection change
    if (courseId) {
      setFormErrors(prev => ({ ...prev, courseId: '' }));
    }
  };

  // Input validation
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) errors.name = 'Student name is required';
    if (!formData.phone.trim()) {
      errors.phone = 'Student phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone)) {
      errors.phone = 'Phone number must be exactly 10 digits';
    }
    
    if (!formData.parentName.trim()) errors.parentName = 'Parent name is required';
    if (!formData.parentPhone.trim()) {
      errors.parentPhone = 'Parent contact number is required';
    } else if (!/^\d{10}$/.test(formData.parentPhone)) {
      errors.parentPhone = 'Parent contact must be exactly 10 digits';
    }

    if (!formData.courseId) errors.courseId = 'Please select a course package';
    if (!formData.batch.trim()) errors.batch = 'Batch timings are required';

    const totalPlanned = plannedInstallments.reduce((sum, inst) => sum + inst.amount, 0);
    if (totalPlanned !== formData.totalFees) {
      errors.installmentsTotal = `Total planned installments (${settings?.currencySymbol || '₹'}${totalPlanned.toLocaleString('en-IN')}) must exactly match the course fee of ${settings?.currencySymbol || '₹'}${formData.totalFees.toLocaleString('en-IN')}`;
    }
    
    plannedInstallments.forEach((inst, idx) => {
      if (!inst.amount || inst.amount <= 0) {
        errors[`inst_amount_${idx}`] = `Amount must be greater than 0`;
      }
      if (!inst.dueDate) {
        errors[`inst_date_${idx}`] = `Due Date is required`;
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const enrollmentDate = new Date().toISOString().split('T')[0];
      const newStud = addStudent({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        parentName: formData.parentName,
        parentPhone: formData.parentPhone,
        enrollmentDate,
        courseId: formData.courseId,
        batch: formData.batch,
        totalFees: formData.totalFees,
        status: formData.status,
        notes: formData.notes,
      }, plannedInstallments);

      showToast(`Student ${newStud.name} admitted successfully with Roll No ${newStud.rollNumber}!`, 'success');
      
      // Reset Form & Switch tab
      setFormData({
        name: '', email: '', phone: '', parentName: '', parentPhone: '',
        courseId: '', batch: '', totalFees: 0, status: 'Active', notes: ''
      });
      setPlannedInstallments([]);
      setFormErrors({});
      setIsSubmitting(false);
      setActiveTab('directory');
    }, 700);
  };

  // Handle Edit Submit
  const handleEditSubmit = (e: React.FormEvent, studentId: string) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      updateStudent(studentId, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        parentName: formData.parentName,
        parentPhone: formData.parentPhone,
        courseId: formData.courseId,
        batch: formData.batch,
        totalFees: formData.totalFees,
        status: formData.status,
        notes: formData.notes,
      }, plannedInstallments);

      showToast('Student profile updated successfully.', 'success');
      setIsSubmitting(false);
      setIsEditing(false);
    }, 600);
  };

  // Open Edit Mode
  const startEdit = (student: Student) => {
    setFormData({
      name: student.name,
      email: student.email,
      phone: student.phone,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      courseId: student.courseId,
      batch: student.batch,
      totalFees: student.totalFees,
      status: student.status,
      notes: student.notes || '',
    });
    
    // Load student installments
    const studentInsts = installments
      .filter(inst => inst.studentId === student.id)
      .sort((a, b) => a.installmentNumber - b.installmentNumber);
    setPlannedInstallments(studentInsts);

    const count = studentInsts.length;
    setSelectedInstCount([1, 2, 3, 4, 6].includes(count) ? count : 0);
    if (studentInsts.length > 0) {
      setFirstDueDate(studentInsts[0].dueDate);
    } else {
      setFirstDueDate(new Date().toISOString().split('T')[0]);
    }
    setFrequency('custom');

    setFormErrors({});
    setIsEditing(true);
  };

  // Delete Student wrapper
  const handleDelete = (studentId: string, studentName: string) => {
    confirmAction({
      title: 'Delete Student Profile',
      message: `Are you sure you want to permanently delete ${studentName}'s profile? All payment receipts and reminders logs will be deleted. This cannot be undone.`,
      confirmText: 'Delete Profile',
      type: 'danger',
      onConfirm: () => {
        deleteStudent(studentId);
        showToast(`Student ${studentName} was removed from the database.`, 'success');
        setSelectedStudentId(null);
        setIsEditing(false);
      }
    });
  };

  // Find selected student details
  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const studentPayments = selectedStudentId 
    ? payments.filter(p => p.studentId === selectedStudentId) 
    : [];

  // Get dynamic fee summary values
  const getFeeSummary = (student: Student) => {
    const studentPays = payments.filter(p => p.studentId === student.id);
    const lastPay = studentPays.length > 0
      ? studentPays.reduce((latest, p) => p.paymentDate > latest.paymentDate ? p : latest, studentPays[0])
      : null;

    // Find earliest pending or overdue installment
    const studentInsts = installments.filter(inst => inst.studentId === student.id && inst.status !== 'Paid');
    const earliestDueInst = studentInsts.length > 0
      ? studentInsts.reduce((earliest, inst) => inst.dueDate < earliest.dueDate ? inst : earliest, studentInsts[0])
      : null;

    let nextDueMonth = 'N/A';
    if (earliestDueInst) {
      const date = new Date(earliestDueInst.dueDate);
      if (!isNaN(date.getTime())) {
        nextDueMonth = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
    }

    return {
      total: student.totalFees,
      paid: student.feesPaid,
      due: student.feesDue,
      lastPaymentDate: lastPay ? lastPay.paymentDate : 'No payments',
      nextDueMonth
    };
  };

  // Sorting Handler
  const handleSort = (field: 'roll' | 'name' | 'paid' | 'due' | 'status') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtered Students List
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(search.toLowerCase()) ||
      student.phone.includes(search) ||
      student.email.toLowerCase().includes(search.toLowerCase());

    const matchesCourse = selectedCourse === 'All' || student.courseId === selectedCourse;
    const matchesStatus = selectedStatus === 'All' || student.status === selectedStatus;

    return matchesSearch && matchesCourse && matchesStatus;
  });

  // Sort logic applied
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'roll') {
      comparison = a.rollNumber.localeCompare(b.rollNumber);
    } else if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === 'paid') {
      comparison = a.feesPaid - b.feesPaid;
    } else if (sortField === 'due') {
      comparison = a.feesDue - b.feesDue;
    } else if (sortField === 'status') {
      comparison = a.status.localeCompare(b.status);
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Pagination calculation
  const totalPages = Math.ceil(sortedStudents.length / itemsPerPage);
  const paginatedStudents = sortedStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6 relative min-h-[calc(100vh-80px)]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Student Admissions</h1>
          <p className="text-sm text-slate-500 mt-1">Manage enrollments, view student directory details, and register new candidates.</p>
        </div>
        
        {/* Tab Toggle buttons */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl self-start no-print">
          <button 
            onClick={() => { setActiveTab('directory'); setIsEditing(false); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'directory' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Student Directory
          </button>
          <button 
            onClick={() => {
              setActiveTab('add');
              setIsEditing(false);
              setFormData({
                name: '', email: '', phone: '', parentName: '', parentPhone: '',
                courseId: courses[0]?.id || '', batch: 'Morning - Batch A (08:00 AM)',
                totalFees: courses[0]?.fees || 0, status: 'Active', notes: ''
              });
              setFormErrors({});
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${activeTab === 'add' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Admission</span>
          </button>
        </div>
      </div>

      {activeTab === 'directory' ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm no-print">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Search name, roll, phone..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50"
              />
            </div>

            {/* Course Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select 
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50 cursor-pointer"
              >
                <option value="All">All Courses</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <select 
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50 cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Directory Table */}
          {isLoadingTable ? (
            <TableSkeleton columnCount={6} rowCount={itemsPerPage} />
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-550 uppercase tracking-wider select-none">
                        <th 
                          onClick={() => handleSort('roll')} 
                          className="px-5 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Roll No.</span>
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('name')} 
                          className="px-5 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Name</span>
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </th>
                        <th className="px-5 py-3">Course / Batch</th>
                        <th 
                          onClick={() => handleSort('paid')} 
                          className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100/50 transition-colors"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>Paid / Total</span>
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('due')} 
                          className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100/50 transition-colors"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>Dues</span>
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('status')} 
                          className="px-5 py-3 text-center cursor-pointer hover:bg-slate-100/50 transition-colors"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>Status</span>
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {paginatedStudents.length > 0 ? (
                        paginatedStudents.map(student => (
                          <tr 
                            key={student.id} 
                            onClick={() => { setSelectedStudentId(student.id); setIsEditing(false); }}
                            className="hover:bg-blue-50/10 cursor-pointer transition-colors"
                          >
                            <td className="px-5 py-3.5 font-bold text-slate-700">
                              {student.rollNumber}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="font-semibold text-slate-800 text-sm">{student.name}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{student.phone}</div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="font-medium text-slate-700 max-w-[200px] truncate">{student.courseName}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">{student.batch}</div>
                            </td>
                            <td className="px-5 py-3.5 text-right font-medium">
                              <span className="text-slate-800 font-bold">{settings?.currencySymbol || '₹'}{student.feesPaid.toLocaleString('en-IN')}</span>
                              <span className="text-slate-400 text-[10px]"> / {settings?.currencySymbol || '₹'}{student.totalFees.toLocaleString('en-IN')}</span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <span className={`font-bold ${student.feesDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {settings?.currencySymbol || '₹'}{student.feesDue.toLocaleString('en-IN')}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block
                                ${student.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : ''}
                                ${student.status === 'Inactive' ? 'bg-rose-50 text-rose-600 border border-rose-100' : ''}
                                ${student.status === 'Completed' ? 'bg-blue-50 text-blue-600 border border-blue-100' : ''}
                              `}>
                                {student.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                              <AlertCircle className="w-7 h-7 text-slate-300" />
                              <span>No students found matching filters.</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-505 no-print">
                  <div>
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedStudents.length)} of {sortedStudents.length} enrollments
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
        /* Admissions Registration Form */
        <div className="max-w-2xl bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-1.5">
            <User className="w-5 h-5 text-blue-600" />
            <span>New Student Enrollment Form</span>
          </h3>

          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Student Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Student Name <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, name: e.target.value }));
                    if (e.target.value) setFormErrors(prev => ({ ...prev, name: '' }));
                  }}
                  placeholder="e.g. Rahul Sen"
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${formErrors.name ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'}`}
                />
                {formErrors.name && <span className="text-[10px] text-rose-600 font-bold block">{formErrors.name}</span>}
              </div>

              {/* Student Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Email Address</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="e.g. rahul@example.com"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              {/* Student Phone */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Student Phone Number <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }));
                    if (e.target.value) setFormErrors(prev => ({ ...prev, phone: '' }));
                  }}
                  placeholder="10 digit number"
                  maxLength={10}
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${formErrors.phone ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'}`}
                />
                {formErrors.phone && <span className="text-[10px] text-rose-600 font-bold block">{formErrors.phone}</span>}
              </div>

              {/* Course Selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Select Course Program <span className="text-rose-500">*</span></label>
                <select 
                  value={formData.courseId}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white cursor-pointer ${formErrors.courseId ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'}`}
                >
                  <option value="">-- Choose Course --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({settings?.currencySymbol || '₹'}{c.fees})</option>
                  ))}
                </select>
                {formErrors.courseId && <span className="text-[10px] text-rose-600 font-bold block">{formErrors.courseId}</span>}
              </div>

              {/* Batch Selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Batch Timings <span className="text-rose-500">*</span></label>
                <input 
                  type="text"
                  value={formData.batch}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, batch: e.target.value }));
                    if (e.target.value) setFormErrors(prev => ({ ...prev, batch: '' }));
                  }}
                  placeholder="e.g. Morning - Batch A (08:00 AM)"
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${formErrors.batch ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'}`}
                />
                {formErrors.batch && <span className="text-[10px] text-rose-600 font-bold block">{formErrors.batch}</span>}
              </div>

              {/* Total Course Fees */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Total Calculated Fees ({settings?.currencySymbol || '₹'})</label>
                <input 
                  type="number" 
                  value={formData.totalFees}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalFees: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50 font-semibold"
                />
              </div>

              {/* Parent Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Parent / Guardian Name <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.parentName}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, parentName: e.target.value }));
                    if (e.target.value) setFormErrors(prev => ({ ...prev, parentName: '' }));
                  }}
                  placeholder="e.g. Sunil Sen"
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${formErrors.parentName ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'}`}
                />
                {formErrors.parentName && <span className="text-[10px] text-rose-600 font-bold block">{formErrors.parentName}</span>}
              </div>

              {/* Parent Phone */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Parent Contact Number <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.parentPhone}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, parentPhone: e.target.value.replace(/\D/g, '') }));
                    if (e.target.value) setFormErrors(prev => ({ ...prev, parentPhone: '' }));
                  }}
                  placeholder="10 digit contact number"
                  maxLength={10}
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${formErrors.parentPhone ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'}`}
                />
                {formErrors.parentPhone && <span className="text-[10px] text-rose-600 font-bold block">{formErrors.parentPhone}</span>}
              </div>
            </div>

            {/* Installment Planner (Requirement 4) */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-800">Installment Schedule Planner</h4>
                  <p className="text-[10px] text-slate-500">Plan a detailed fee breakdown for the student. Paid installments cannot be edited or deleted.</p>
                </div>
                <button
                  type="button"
                  onClick={addInstallmentRow}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  + Add Installment
                </button>
              </div>

              {/* Quick Select & Generator Tool (Requirement 1, 2, 3) */}
              <div className="bg-white border border-slate-200/50 rounded-xl p-3 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Installments</span>
                    {[1, 2, 3, 4, 6].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSelectedInstCount(num)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                          selectedInstCount === num
                            ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedInstCount(0)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                        selectedInstCount === 0
                          ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100'
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoGenerate}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1"
                  >
                    <span>✨ Auto Generate</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">First Due Date</label>
                    <input
                      type="date"
                      value={firstDueDate}
                      onChange={(e) => handleFirstDueDateChange(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => handleFrequencyChange(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs cursor-pointer bg-white"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="2months">Every 2 Months</option>
                      <option value="3months">Every 3 Months</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
              </div>

              {plannedInstallments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold text-[10px] uppercase">
                        <th className="py-2 pr-2 w-16">Inst. #</th>
                        <th className="py-2 px-2 w-32">Amount ({settings?.currencySymbol || '₹'})</th>
                        <th className="py-2 px-2 w-40">Due Date</th>
                        <th className="py-2 px-2">Remarks / Notes</th>
                        <th className="py-2 pl-2 w-16 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {plannedInstallments.map((inst, idx) => (
                        <tr key={idx} className="hover:bg-slate-100/40">
                          <td className="py-2.5 pr-2 font-bold text-slate-700">
                            #{inst.installmentNumber}
                          </td>
                          <td className="py-2.5 px-2">
                            <input
                              type="number"
                              disabled={inst.status === 'Paid'}
                              value={inst.amount || ''}
                              onChange={(e) => updateInstallmentRow(idx, { amount: parseFloat(e.target.value) || 0 })}
                              className={`w-full px-2 py-1 border border-slate-200 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-500 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 ${formErrors[`inst_amount_${idx}`] ? 'border-rose-300 bg-rose-50/10' : ''}`}
                            />
                            {formErrors[`inst_amount_${idx}`] && (
                              <span className="text-[9px] text-rose-600 block mt-0.5 font-bold">
                                {formErrors[`inst_amount_${idx}`]}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2">
                            <input
                              type="date"
                              disabled={inst.status === 'Paid'}
                              value={inst.dueDate}
                              onChange={(e) => updateInstallmentRow(idx, { dueDate: e.target.value })}
                              className={`w-full px-2 py-1 border border-slate-200 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${formErrors[`inst_date_${idx}`] ? 'border-rose-300 bg-rose-50/10' : ''}`}
                            />
                            {formErrors[`inst_date_${idx}`] && (
                              <span className="text-[9px] text-rose-600 block mt-0.5 font-bold">
                                {formErrors[`inst_date_${idx}`]}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2">
                            <input
                              type="text"
                              disabled={inst.status === 'Paid'}
                              value={inst.remarks || ''}
                              onChange={(e) => updateInstallmentRow(idx, { remarks: e.target.value })}
                              placeholder="Remarks"
                              className="w-full px-2 py-1 border border-slate-200 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2.5 pl-2 text-center">
                            {inst.status === 'Paid' ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[9px] uppercase border border-emerald-100">
                                Paid
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => removeInstallmentRow(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-slate-400 bg-white">
                  No installments planned yet. Click "+ Add Installment" to define a payment schedule.
                </div>
              )}

              {/* Planner Summary (Requirement 5) */}
              <div className="space-y-2">
                <div className="bg-white border border-slate-200/60 p-3 rounded-xl text-xs font-semibold space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Course Fee:</span>
                    <span className="font-bold text-slate-800">{settings?.currencySymbol || '₹'}{(formData.totalFees || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Total Planned:</span>
                    <span className="font-bold text-slate-800">{settings?.currencySymbol || '₹'}{totalPlannedInstallments.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                    <span className="text-slate-500 font-medium">Remaining Allocation:</span>
                    <span className={`font-bold ${remainingAllocation === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {settings?.currencySymbol || '₹'}{remainingAllocation.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {remainingAllocation === 0 ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 font-bold uppercase tracking-wider justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Schedule Fully Allocated!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-rose-600 bg-rose-50/50 border border-rose-100 rounded-lg p-2 font-bold uppercase tracking-wider justify-center">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Remaining Allocation must be {settings?.currencySymbol || '₹'}0 to save.</span>
                  </div>
                )}
              </div>
              {formErrors.installmentsTotal && (
                <span className="text-[10px] text-rose-600 font-bold block">{formErrors.installmentsTotal}</span>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Academic Remarks / Profile Notes</label>
              <textarea 
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="e.g. Scholar student, paid half, reference from school principal."
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setActiveTab('directory')}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting || !isAllocationComplete}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmitting ? 'Enrolling...' : 'Enroll Student'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Side Details drawer (Slides in from the right when student clicked) */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white border-l border-slate-100 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col no-print
        ${selectedStudentId ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {selectedStudent ? (
          <>
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-600 uppercase">
                  {selectedStudent.rollNumber}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                  ${selectedStudent.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : ''}
                  ${selectedStudent.status === 'Inactive' ? 'bg-rose-50 text-rose-600 border border-rose-100' : ''}
                  ${selectedStudent.status === 'Completed' ? 'bg-blue-50 text-blue-600 border border-blue-100' : ''}
                `}>
                  {selectedStudent.status}
                </span>
              </div>
              <button 
                onClick={() => { setSelectedStudentId(null); setIsEditing(false); }}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {!isEditing ? (
                /* Detail View */
                <div className="space-y-6">
                  {/* Student Title Profile Card */}
                  <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl border border-blue-100 shadow-inner">
                      {selectedStudent.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 leading-tight">{selectedStudent.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">{selectedStudent.batch}</p>
                    </div>
                  </div>

                  {/* General Info */}
                  <div className="space-y-3.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contact Details</h4>
                    <div className="grid grid-cols-1 gap-2.5 text-xs text-slate-700">
                      <div className="flex items-center gap-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <div className="text-[10px] text-slate-400">Student Phone</div>
                          <div className="font-semibold text-slate-800">{selectedStudent.phone}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <div className="text-[10px] text-slate-400">Email Address</div>
                          <div className="font-semibold text-slate-800">{selectedStudent.email || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <div className="text-[10px] text-slate-400">Enrollment Date</div>
                          <div className="font-semibold text-slate-800">{selectedStudent.enrollmentDate}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <div className="text-[10px] text-slate-400">Parent / Guardian</div>
                          <div className="font-semibold text-slate-800">{selectedStudent.parentName} ({selectedStudent.parentPhone})</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Course Details & Fee Dues summary */}
                  <div className="space-y-3.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Course & Fees Ledger</h4>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <BookOpen className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-800">{selectedStudent.courseName}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">Assigned Batch: {selectedStudent.batch}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                        <div>
                          <div className="text-[10px] text-slate-400">Total Fees</div>
                          <div className="text-sm font-bold text-slate-800 mt-0.5">{settings?.currencySymbol || '₹'}{selectedStudent.totalFees.toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Paid Fees</div>
                          <div className="text-sm font-bold text-emerald-600 mt-0.5">{settings?.currencySymbol || '₹'}{selectedStudent.feesPaid.toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Balance Due</div>
                          <div className="text-sm font-bold text-amber-600 mt-0.5">{settings?.currencySymbol || '₹'}{selectedStudent.feesDue.toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* NEW Fee Summary Widget Section (Task 3) */}
                  <div className="space-y-3.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fee Summary Details</h4>
                    <div className="border border-slate-150 rounded-xl p-4 bg-white space-y-2.5 shadow-xs">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Total Course Fee</span>
                        <span className="font-bold text-slate-800">{settings?.currencySymbol || '₹'}{getFeeSummary(selectedStudent).total.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Amount Paid</span>
                        <span className="font-bold text-emerald-600">{settings?.currencySymbol || '₹'}{getFeeSummary(selectedStudent).paid.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2.5">
                        <span className="text-slate-500 font-medium">Remaining Fee</span>
                        <span className={`font-bold ${getFeeSummary(selectedStudent).due > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {settings?.currencySymbol || '₹'}{getFeeSummary(selectedStudent).due.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Last Payment Date</span>
                        <span className="font-semibold text-slate-700">{getFeeSummary(selectedStudent).lastPaymentDate}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Next Due Month</span>
                        <span className="font-semibold text-amber-605 bg-amber-50 px-2 py-0.5 rounded-md text-[10px]">
                          {getFeeSummary(selectedStudent).nextDueMonth}
                        </span>
                      </div>
                      
                      {/* Installment Schedule Table (Requirement 5) */}
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Installment Schedule</h4>
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                                <th className="py-2 px-3 w-12">Inst.</th>
                                <th className="py-2 px-2 w-20">Amount</th>
                                <th className="py-2 px-2 w-24">Due Date</th>
                                <th className="py-2 px-2 text-center">Status</th>
                                <th className="py-2 px-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {installments
                                .filter(inst => inst.studentId === selectedStudent.id)
                                .sort((a, b) => a.installmentNumber - b.installmentNumber)
                                .map((inst) => (
                                  <tr key={inst.id} className="hover:bg-slate-50/50">
                                    <td className="py-2.5 px-3 font-bold text-slate-700">#{inst.installmentNumber}</td>
                                    <td className="py-2.5 px-2 font-semibold text-slate-800">{settings?.currencySymbol || '₹'}{inst.amount.toLocaleString('en-IN')}</td>
                                    <td className="py-2.5 px-2 text-slate-500">{inst.dueDate}</td>
                                    <td className="py-2.5 px-2 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border
                                        ${inst.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : ''}
                                        ${inst.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : ''}
                                        ${inst.status === 'Overdue' ? 'bg-rose-50 text-rose-600 border-rose-100' : ''}
                                      `}>
                                        {inst.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      {inst.status === 'Paid' ? (
                                        inst.paymentId ? (
                                          <Link
                                            to={`/receipts?id=${inst.paymentId}`}
                                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 underline"
                                          >
                                            Receipt
                                          </Link>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 italic">Paid</span>
                                        )
                                      ) : (
                                        <Link
                                          to={`/payments?student=${selectedStudent.id}`}
                                          className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                                        >
                                          Collect
                                        </Link>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              {installments.filter(inst => inst.studentId === selectedStudent.id).length === 0 && (
                                <tr>
                                  <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                                    No installments scheduled.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Remarks / Profile notes */}
                  {selectedStudent.notes && (
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Academic / Admin Notes</h4>
                      <div className="p-3 bg-blue-50/30 border border-blue-50 text-xs text-slate-600 rounded-xl leading-relaxed flex items-start gap-2">
                        <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <span>{selectedStudent.notes}</span>
                      </div>
                    </div>
                  )}

                  {/* Payment history list */}
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment History</h4>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {studentPayments.length > 0 ? (
                        studentPayments.map(p => (
                          <div key={p.id} className="flex justify-between items-center p-2.5 bg-white border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-colors">
                            <div className="text-left">
                              <span className="text-[10px] font-bold text-slate-500 block">{p.receiptNumber}</span>
                              <span className="text-[10px] text-slate-400 mt-0.5 block">{p.paymentDate} via {p.paymentMethod}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-slate-800">{settings?.currencySymbol || '₹'}{p.amount.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-slate-400 text-xs">No fee payments recorded yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Edit Mode Form */
                <form onSubmit={(e) => handleEditSubmit(e, selectedStudent.id)} className="space-y-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Edit Student details</h4>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Student Name <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs ${formErrors.name ? 'border-rose-300' : 'border-slate-200'}`}
                      />
                      {formErrors.name && <span className="text-[10px] text-rose-600 block font-bold">{formErrors.name}</span>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Email Address</label>
                      <input 
                        type="email" 
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Phone Number <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs ${formErrors.phone ? 'border-rose-300' : 'border-slate-200'}`}
                      />
                      {formErrors.phone && <span className="text-[10px] text-rose-600 block font-bold">{formErrors.phone}</span>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Course Program <span className="text-rose-500">*</span></label>
                      <select 
                        value={formData.courseId}
                        onChange={(e) => handleCourseChange(e.target.value)}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs ${formErrors.courseId ? 'border-rose-300' : 'border-slate-200'}`}
                      >
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {formErrors.courseId && <span className="text-[10px] text-rose-600 block font-bold">{formErrors.courseId}</span>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Batch Assignment <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        value={formData.batch}
                        onChange={(e) => setFormData(prev => ({ ...prev, batch: e.target.value }))}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs ${formErrors.batch ? 'border-rose-300' : 'border-slate-200'}`}
                      />
                      {formErrors.batch && <span className="text-[10px] text-rose-600 block font-bold">{formErrors.batch}</span>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Total Configured Fees ({settings?.currencySymbol || '₹'})</label>
                      <input 
                        type="number" 
                        value={formData.totalFees}
                        onChange={(e) => setFormData(prev => ({ ...prev, totalFees: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Parent / Guardian Name <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        value={formData.parentName}
                        onChange={(e) => setFormData(prev => ({ ...prev, parentName: e.target.value }))}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs ${formErrors.parentName ? 'border-rose-300' : 'border-slate-200'}`}
                      />
                      {formErrors.parentName && <span className="text-[10px] text-rose-600 block font-bold">{formErrors.parentName}</span>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Parent Contact Phone <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        value={formData.parentPhone}
                        onChange={(e) => setFormData(prev => ({ ...prev, parentPhone: e.target.value.replace(/\D/g, '') }))}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs ${formErrors.parentPhone ? 'border-rose-300' : 'border-slate-200'}`}
                      />
                      {formErrors.parentPhone && <span className="text-[10px] text-rose-600 block font-bold">{formErrors.parentPhone}</span>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Status</label>
                      <select 
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Student['status'] }))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs cursor-pointer bg-white"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Academic Remarks</label>
                      <textarea 
                        rows={2}
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>

                    {/* Installment Planner for Edit (Requirement 4) */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-3 mt-1">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[11px] font-bold text-slate-800">Installment Planner</h5>
                        <button
                          type="button"
                          onClick={addInstallmentRow}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          + Add Row
                        </button>
                      </div>

                      {/* Quick Select & Generator Tool (Requirement 1, 2, 3) */}
                      <div className="bg-white border border-slate-200/50 rounded-xl p-2.5 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1">Inst.</span>
                            {[1, 2, 3, 4, 6].map(num => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setSelectedInstCount(num)}
                                className={`px-1.5 py-0.5 text-[9px] font-bold rounded border transition-colors cursor-pointer ${
                                  selectedInstCount === num
                                    ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                                    : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setSelectedInstCount(0)}
                              className={`px-1.5 py-0.5 text-[9px] font-bold rounded border transition-colors cursor-pointer ${
                                selectedInstCount === 0
                                  ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                                  : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100'
                              }`}
                            >
                              Custom
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={handleAutoGenerate}
                            className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[9px] font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-0.5"
                          >
                            <span>✨ Auto Generate</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5">
                          <div className="space-y-0.5">
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">First Due Date</label>
                            <input
                              type="date"
                              value={firstDueDate}
                              onChange={(e) => handleFirstDueDateChange(e.target.value)}
                              className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-xs"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Frequency</label>
                            <select
                              value={frequency}
                              onChange={(e) => handleFrequencyChange(e.target.value)}
                              className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-xs cursor-pointer bg-white"
                            >
                              <option value="monthly">Monthly</option>
                              <option value="2months">Every 2 Months</option>
                              <option value="3months">Every 3 Months</option>
                              <option value="custom">Custom</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {plannedInstallments.length > 0 ? (
                        <div className="space-y-2 overflow-x-auto max-h-[220px] overflow-y-auto pr-1">
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
                                <th className="py-1 pr-1 w-10">Inst.</th>
                                <th className="py-1 px-1 w-24">Amount ({settings?.currencySymbol || '₹'})</th>
                                <th className="py-1 px-1 w-32">Due Date</th>
                                <th className="py-1 px-1">Notes</th>
                                <th className="py-1 pl-1 text-center w-8">Del</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {plannedInstallments.map((inst, idx) => (
                                <tr key={idx} className="hover:bg-slate-100/40">
                                  <td className="py-1.5 pr-1 font-bold text-slate-700">#{inst.installmentNumber}</td>
                                  <td className="py-1.5 px-1">
                                    <input
                                      type="number"
                                      disabled={inst.status === 'Paid'}
                                      value={inst.amount || ''}
                                      onChange={(e) => updateInstallmentRow(idx, { amount: parseFloat(e.target.value) || 0 })}
                                      className={`w-full px-1.5 py-0.5 border border-slate-200 rounded bg-white disabled:bg-slate-100 disabled:text-slate-500 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 ${formErrors[`inst_amount_${idx}`] ? 'border-rose-300 bg-rose-50/10' : ''}`}
                                    />
                                  </td>
                                  <td className="py-1.5 px-1">
                                    <input
                                      type="date"
                                      disabled={inst.status === 'Paid'}
                                      value={inst.dueDate}
                                      onChange={(e) => updateInstallmentRow(idx, { dueDate: e.target.value })}
                                      className={`w-full px-1.5 py-0.5 border border-slate-200 rounded bg-white disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${formErrors[`inst_date_${idx}`] ? 'border-rose-300 bg-rose-50/10' : ''}`}
                                    />
                                  </td>
                                  <td className="py-1.5 px-1">
                                    <input
                                      type="text"
                                      disabled={inst.status === 'Paid'}
                                      value={inst.remarks || ''}
                                      onChange={(e) => updateInstallmentRow(idx, { remarks: e.target.value })}
                                      placeholder="Remarks"
                                      className="w-full px-1.5 py-0.5 border border-slate-200 rounded bg-white disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </td>
                                  <td className="py-1.5 pl-1 text-center">
                                    {inst.status === 'Paid' ? (
                                      <span className="text-[9px] text-emerald-600 font-bold">Paid</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => removeInstallmentRow(idx)}
                                        className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-4 border border-dashed border-slate-200 rounded-lg text-slate-400 text-[10px] bg-white">
                          No installments planned.
                        </div>
                      )}

                      {/* Planner Summary (Requirement 5) */}
                      <div className="space-y-2">
                        <div className="bg-white border border-slate-200/60 p-2.5 rounded-lg text-[10px] font-semibold space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Course Fee:</span>
                            <span className="font-bold text-slate-800">{settings?.currencySymbol || '₹'}{(formData.totalFees || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Total Planned:</span>
                            <span className="font-bold text-slate-800">{settings?.currencySymbol || '₹'}{totalPlannedInstallments.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-100 pt-1.5">
                            <span className="text-slate-500 font-medium">Remaining Allocation:</span>
                            <span className={`font-bold ${remainingAllocation === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {settings?.currencySymbol || '₹'}{remainingAllocation.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        {remainingAllocation === 0 ? (
                          <div className="flex items-center gap-1 text-[9px] text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded p-1.5 font-bold uppercase justify-center">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Schedule Fully Allocated!</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[9px] text-rose-600 bg-rose-50/50 border border-rose-100 rounded p-1.5 font-bold uppercase justify-center">
                            <AlertCircle className="w-3 h-3" />
                            <span>Remaining Allocation must be {settings?.currencySymbol || '₹'}0 to save.</span>
                          </div>
                        )}
                      </div>
                      {formErrors.installmentsTotal && (
                        <span className="text-[9px] text-rose-600 font-bold block">{formErrors.installmentsTotal}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setIsEditing(false)}
                      className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-655 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting || !isAllocationComplete}
                      className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting && <Loader2 className="w-3 animate-spin" />}
                      <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Drawer Footer Actions */}
            {!isEditing && (
              <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex gap-2">
                <button 
                  onClick={() => startEdit(selectedStudent)}
                  className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-slate-400" />
                  <span>Edit Profile</span>
                </button>
                <button 
                  onClick={() => handleDelete(selectedStudent.id, selectedStudent.name)}
                  className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 font-semibold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Delete Student</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs">Select a student from the directory.</div>
        )}
      </div>
    </div>
  );
};
