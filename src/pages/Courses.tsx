import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { 
  BookOpen, 
  Plus, 
  Clock, 
  Award, 
  Flame, 
  BookMarked, 
  Code,
  AlertCircle,
  PlusCircle,
  Loader2,
  Trash2,
  X,
  Edit3,
  Users
} from 'lucide-react';
import { PageLoader } from '../components/PageLoader';
import { Batch } from '../types';

export const Courses: React.FC = () => {
  const { 
    courses, 
    students, 
    addCourse, 
    deleteCourse, 
    showToast, 
    settings, 
    confirmAction,
    batches,
    addBatch,
    updateBatch,
    deleteBatch
  } = useData();

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form toggle & state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    duration: '',
    fees: ''
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Batch Form & Modal States
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchFormData, setBatchFormData] = useState({
    courseId: '',
    name: '',
    timing: '',
    capacity: '',
    courseFee: '',
    status: 'Active' as 'Active' | 'Inactive'
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) errors.name = 'Course name is required';
    if (!formData.subject.trim()) errors.subject = 'Subject or category category is required';
    if (!formData.duration.trim()) errors.duration = 'Duration is required (e.g. 10 Months)';
    
    const feesNum = parseFloat(formData.fees);
    if (isNaN(feesNum) || feesNum <= 0) {
      errors.fees = 'Please enter a valid course fee greater than 0';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const feesNum = parseFloat(formData.fees);
      addCourse({
        name: formData.name,
        subject: formData.subject,
        duration: formData.duration,
        fees: feesNum
      });

      showToast(`Course program "${formData.name}" created successfully!`, 'success');

      // Reset Form
      setFormData({ name: '', subject: '', duration: '', fees: '' });
      setFormErrors({});
      setIsSubmitting(false);
      setShowAddForm(false);
    }, 600);
  };

  const handleDeleteCourse = (courseId: string, courseName: string) => {
    confirmAction({
      title: 'Delete Course Package',
      message: `Are you sure you want to delete the course "${courseName}"? This action cannot be undone.`,
      confirmText: 'Delete Course',
      type: 'danger',
      onConfirm: async () => {
        await deleteCourse(courseId);
      }
    });
  };

  const validateBatchForm = () => {
    if (!batchFormData.courseId) {
      showToast('Mapped course is required', 'error');
      return false;
    }
    if (!batchFormData.name.trim()) {
      showToast('Batch name is required', 'error');
      return false;
    }
    if (!batchFormData.timing.trim()) {
      showToast('Timing is required', 'error');
      return false;
    }
    const cap = parseInt(batchFormData.capacity);
    if (isNaN(cap) || cap <= 0) {
      showToast('Capacity must be a positive number', 'error');
      return false;
    }
    return true;
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBatchForm()) return;

    const data = {
      courseId: batchFormData.courseId,
      name: batchFormData.name,
      timing: batchFormData.timing,
      capacity: parseInt(batchFormData.capacity),
      courseFee: batchFormData.courseFee ? parseFloat(batchFormData.courseFee) : undefined,
      status: batchFormData.status
    };

    if (editingBatchId) {
      await updateBatch(editingBatchId, data);
    } else {
      await addBatch(data);
    }

    setShowBatchModal(false);
    setEditingBatchId(null);
    setBatchFormData({
      courseId: '',
      name: '',
      timing: '',
      capacity: '',
      courseFee: '',
      status: 'Active'
    });
  };

  const handleEditBatch = (batch: Batch) => {
    setEditingBatchId(batch.id);
    setBatchFormData({
      courseId: batch.courseId || '',
      name: batch.name,
      timing: batch.timing,
      capacity: String(batch.capacity),
      courseFee: batch.courseFee ? String(batch.courseFee) : '',
      status: batch.status
    });
    setShowBatchModal(true);
  };

  const handleDeleteBatch = (batchId: string, batchName: string) => {
    confirmAction({
      title: 'Delete Batch',
      message: `Are you sure you want to delete the batch "${batchName}"? This action cannot be undone.`,
      confirmText: 'Delete Batch',
      type: 'danger',
      onConfirm: async () => {
        await deleteBatch(batchId);
      }
    });
  };

  // Helper to map subject name to a premium icon
  const getSubjectIcon = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes('math')) return <Award className="w-5 h-5 text-blue-600" />;
    if (s.includes('phys')) return <Flame className="w-5 h-5 text-violet-600" />;
    if (s.includes('chem')) return <BookMarked className="w-5 h-5 text-emerald-600" />;
    if (s.includes('comp') || s.includes('python') || s.includes('code')) {
      return <Code className="w-5 h-5 text-sky-600" />;
    }
    return <BookOpen className="w-5 h-5 text-amber-600" />;
  };

  // Calculate stats for each course
  const courseStats = courses.map(course => {
    const enrolledStudents = students.filter(s => s.courseId === course.id);
    const activeCount = enrolledStudents.filter(s => s.status === 'Active').length;
    const courseBatches = Array.from(new Set(enrolledStudents.map(s => s.batch))).filter(Boolean);

    return {
      ...course,
      totalEnrolled: enrolledStudents.length,
      activeEnrolled: activeCount,
      batches: courseBatches
    };
  });

  // Calculate Batch summary metrics
  const batchesList = (batches || []).map(batch => {
    const enrolledStudents = students.filter(s => 
      s.batchId === batch.id || 
      s.batch === batch.name || 
      s.batch.includes(batch.name)
    );
    const activeCount = enrolledStudents.filter(s => s.status === 'Active').length;
    const coursesMapped = Array.from(new Set(enrolledStudents.map(s => s.courseName))).filter(Boolean);
    const course = courses.find(c => c.id === batch.courseId);

    return {
      ...batch,
      count: enrolledStudents.length,
      activeCount,
      courses: coursesMapped,
      courseName: course ? course.name : 'General'
    };
  });



  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Courses & Batches</h1>
          <p className="text-sm text-slate-500 mt-1">Configure curriculum offerings, manage tuition packages, and audit batch occupancy.</p>
        </div>

        <button 
          onClick={() => {
            setShowAddForm(!showAddForm);
            setFormErrors({});
          }}
          className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? 'Hide Form' : 'Create Course'}</span>
        </button>
      </div>

      {/* Add Course Form (Expandable) */}
      {showAddForm && (
        <div className="max-w-xl bg-white border border-slate-150 rounded-2xl shadow-sm p-5 transition-all animate-slide-in">
          <h3 className="text-sm font-bold text-slate-800 mb-3.5 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-blue-600" />
            <span>Add New Course Package</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Course Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Course Name <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, name: e.target.value }));
                    if (e.target.value) setFormErrors(prev => ({ ...prev, name: '' }));
                  }}
                  placeholder="e.g. Science Board Prep"
                  className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${formErrors.name ? 'border-rose-300 bg-rose-50/10' : 'border-slate-200'}`}
                />
                {formErrors.name && <span className="text-[9px] text-rose-600 font-bold block">{formErrors.name}</span>}
              </div>

              {/* Subject Category */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Subject Category <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.subject}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, subject: e.target.value }));
                    if (e.target.value) setFormErrors(prev => ({ ...prev, subject: '' }));
                  }}
                  placeholder="e.g. Physics, Chemistry, Math"
                  className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${formErrors.subject ? 'border-rose-300 bg-rose-50/10' : 'border-slate-200'}`}
                />
                {formErrors.subject && <span className="text-[9px] text-rose-600 font-bold block">{formErrors.subject}</span>}
              </div>

              {/* Duration */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Duration <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.duration}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, duration: e.target.value }));
                    if (e.target.value) setFormErrors(prev => ({ ...prev, duration: '' }));
                  }}
                  placeholder="e.g. 10 Months, 1 Year"
                  className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${formErrors.duration ? 'border-rose-300 bg-rose-50/10' : 'border-slate-200'}`}
                />
                {formErrors.duration && <span className="text-[9px] text-rose-600 font-bold block">{formErrors.duration}</span>}
              </div>

              {/* Tuition Fees */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tuition Fee ({settings?.currencySymbol || '₹'}) <span className="text-rose-500">*</span></label>
                <input 
                  type="number" 
                  value={formData.fees}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, fees: e.target.value }));
                    if (e.target.value) setFormErrors(prev => ({ ...prev, fees: '' }));
                  }}
                  placeholder="Total base fee amount"
                  className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${formErrors.fees ? 'border-rose-300 bg-rose-50/10' : 'border-slate-200'}`}
                />
                {formErrors.fees && <span className="text-[9px] text-rose-600 font-bold block">{formErrors.fees}</span>}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setShowAddForm(false)}
                className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-655 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-3 animate-spin shrink-0" />}
                <span>{isSubmitting ? 'Saving...' : 'Save Course'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Courses Listing */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active Curriculum Packages</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courseStats.map(course => (
              <div 
                key={course.id}
                className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                      {getSubjectIcon(course.subject)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200/50">
                        {course.subject}
                      </span>
                      <button 
                        onClick={() => handleDeleteCourse(course.id, course.name)}
                        title="Delete Course"
                        className="p-1.5 border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight truncate" title={course.name}>{course.name}</h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-405 mt-1.5 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Duration: {course.duration}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Course Fee</span>
                    <span className="text-sm font-bold text-blue-600">{settings?.currencySymbol || '₹'}{course.fees.toLocaleString('en-IN')}</span>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Enrollments</span>
                    <span className="text-xs font-bold text-slate-700">{course.activeEnrolled} active / {course.totalEnrolled} total</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Batches occupancy */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Batch occupancy & management</h3>
            <button
              onClick={() => {
                setEditingBatchId(null);
                setBatchFormData({
                  courseId: '',
                  name: '',
                  timing: '',
                  capacity: '',
                  courseFee: '',
                  status: 'Active'
                });
                setShowBatchModal(true);
              }}
              className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Batch</span>
            </button>
          </div>
          
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4">
            {batchesList.length > 0 ? (
              <div className="space-y-4">
                {batchesList.map((batch, index) => (
                  <div key={batch.id || index} className="space-y-2 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-850 leading-tight">{batch.name}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${batch.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                            {batch.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-505 mt-1 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{batch.timing}</span>
                        </div>
                        <div className="text-[9px] text-slate-450 mt-0.5 block max-w-[200px] truncate">
                          Course: {batch.courseName}
                        </div>
                        {batch.courseFee && (
                          <div className="text-[9px] text-blue-650 font-bold mt-0.5">
                            Batch Fee: {settings?.currencySymbol || '₹'}{batch.courseFee.toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end shrink-0 gap-1.5">
                        <div className="text-right">
                          <span className="text-xs font-bold text-blue-600">{batch.activeCount} Active</span>
                          <span className="text-[10px] text-slate-400 block font-medium">/ {batch.count} registered (Cap: {batch.capacity})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditBatch(batch as any)}
                            title="Edit Batch"
                            className="p-1 border border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteBatch(batch.id, batch.name)}
                            title="Delete Batch"
                            className="p-1 border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-650 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (batch.activeCount / batch.capacity) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs font-medium">
                No active batches found. Click "Add Batch" to register.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white border border-slate-150 rounded-2xl shadow-xl p-6 w-full max-w-md animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800">
                {editingBatchId ? 'Edit Batch details' : 'Add New Batch'}
              </h3>
              <button 
                onClick={() => {
                  setShowBatchModal(false);
                  setEditingBatchId(null);
                }}
                className="text-slate-400 hover:text-slate-650 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBatchSubmit} className="space-y-4">
              {/* Batch Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Batch Name *</label>
                <input 
                  type="text" 
                  value={batchFormData.name}
                  onChange={(e) => setBatchFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Evening Batch A"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  required
                />
              </div>

              {/* Timing */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Timing *</label>
                <input 
                  type="text" 
                  value={batchFormData.timing}
                  onChange={(e) => setBatchFormData(prev => ({ ...prev, timing: e.target.value }))}
                  placeholder="e.g. 04:00 PM - 06:00 PM"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  required
                />
              </div>

              {/* Capacity & Course Fee */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Capacity *</label>
                  <input 
                    type="number" 
                    value={batchFormData.capacity}
                    onChange={(e) => setBatchFormData(prev => ({ ...prev, capacity: e.target.value }))}
                    placeholder="e.g. 30"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Fee (Optional)</label>
                  <input 
                    type="number" 
                    value={batchFormData.courseFee}
                    onChange={(e) => setBatchFormData(prev => ({ ...prev, courseFee: e.target.value }))}
                    placeholder="Inherit course fee"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                <select
                  value={batchFormData.status}
                  onChange={(e) => setBatchFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowBatchModal(false);
                    setEditingBatchId(null);
                  }}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-655 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  {editingBatchId ? 'Save Changes' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
