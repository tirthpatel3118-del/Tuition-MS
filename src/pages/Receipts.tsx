import React, { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Search, 
  Printer, 
  ChevronLeft, 
  Sparkles,
  Download,
  CheckCircle2,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { TableSkeleton } from '../components/TableSkeleton';

// Number to words helper for currencies
const numberToWords = (num: number, currencySymbol = '₹'): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  
  const g = ['', 'Thousand', 'Lakh', 'Crore'];
  let words = '';
  
  const helper = (n: number): string => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + 'Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str;
  };

  let i = 0;
  while (num > 0) {
    if (i === 0) {
      const rem = num % 1000;
      if (rem > 0) {
        words = helper(rem) + words;
      }
      num = Math.floor(num / 1000);
    } else {
      const rem = num % 100;
      if (rem > 0) {
        words = helper(rem) + g[i] + ' ' + words;
      }
      num = Math.floor(num / 100);
    }
    i++;
  }
  
  const currencyName = currencySymbol === '$' ? 'Dollars' : currencySymbol === '€' ? 'Euros' : currencySymbol === '£' ? 'Pounds' : 'Rupees';
  return words.trim() + ` ${currencyName} Only`;
};

export const Receipts: React.FC = () => {
  const { payments, students, showToast, settings } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  // Sorting state
  const [sortField, setSortField] = useState<'receipt' | 'name' | 'date' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  // Get active receipt from URL query params
  const activeReceiptId = searchParams.get('id');

  // Sync search state if URL has a search param but no active receipt
  const activePayment = payments.find(p => p.id === activeReceiptId);
  const correspondingStudent = activePayment ? students.find(s => s.id === activePayment.studentId) : null;

  // Trigger simulated loader when parameters change
  useEffect(() => {
    setCurrentPage(1);
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 450);
    return () => clearTimeout(timer);
  }, [search, activeReceiptId]);

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Download PDF simulation
  const handleDownloadPDF = (receiptNo: string) => {
    showToast(`Receipt PDF (${receiptNo}) downloaded successfully.`, 'success');
  };

  // Filtered receipts list
  const filteredReceipts = payments.filter(p => {
    return (
      p.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.studentName.toLowerCase().includes(search.toLowerCase()) ||
      p.courseName.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Sorting logic
  const sortedReceipts = [...filteredReceipts].sort((a, b) => {
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

  const handleSort = (field: 'receipt' | 'name' | 'date' | 'amount') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Pagination bounds
  const totalPages = Math.ceil(sortedReceipts.length / itemsPerPage);
  const paginatedReceipts = sortedReceipts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Print styles inserted directly to restrict prints strictly to the receipt card */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          /* Hide everything except the receipt box */
          nav, header, sidebar, button, .no-print {
            display: none !important;
          }
          #print-receipt-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Page Header (no-print) */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Fee Receipts</h1>
          <p className="text-sm text-slate-500 mt-1">Browse, view details, print or download official tuition fee receipts.</p>
        </div>

        {activeReceiptId && (
          <button 
            onClick={() => setSearchParams({})}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to list</span>
          </button>
        )}
      </div>

      {activeReceiptId && activePayment ? (
        /* Detailed Receipt Print View */
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Printable Receipt Card */}
          <div 
            id="print-receipt-area"
            className="flex-1 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden max-w-3xl w-full"
          >
            {/* Stamp decoration */}
            <div className="absolute right-8 top-28 border-4 border-emerald-500/20 text-emerald-500/40 rounded-full font-bold text-xs uppercase tracking-widest px-4 py-1.5 rotate-12 select-none pointer-events-none flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>PAID</span>
            </div>

            {/* Receipt Header Banner */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-100 gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-200 overflow-hidden shrink-0">
                  {settings?.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base leading-none">{settings?.instituteName || 'EduLedger Coaching'}</h3>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1 block">{settings?.website || 'ERP Academy Suite'}</span>
                </div>
              </div>
              
              <div className="text-left sm:text-right">
                <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest leading-none">Official Fee Receipt</h2>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Receipt No: <span className="text-slate-800 font-bold">{activePayment.receiptNumber}</span></p>
              </div>
            </div>

            {/* Meta Dates Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-5 border-b border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Payment Date</span>
                <span className="font-bold text-slate-800 mt-1 block">{activePayment.paymentDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Payment Method</span>
                <span className="font-bold text-slate-800 mt-1 block">{activePayment.paymentMethod}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Transaction Reference</span>
                <span className="font-mono font-semibold text-slate-800 mt-1 block truncate" title={activePayment.transactionId}>
                  {activePayment.transactionId || 'CASH TRANSACTION'}
                </span>
              </div>
            </div>

            {/* Student details section */}
            <div className="py-6 space-y-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Student & Enrollment Details</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2.5">
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-500">Student Name:</span>
                    <span className="font-bold text-slate-800">{activePayment.studentName}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-500">Roll Number:</span>
                    <span className="font-bold text-slate-700">{correspondingStudent?.rollNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-500">Contact Number:</span>
                    <span className="font-bold text-slate-700">{correspondingStudent?.phone || 'N/A'}</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-500">Enrolled Course:</span>
                    <span className="font-bold text-slate-800 text-right max-w-[180px] truncate" title={activePayment.courseName}>
                      {activePayment.courseName}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-500">Batch details:</span>
                    <span className="font-bold text-slate-700">{correspondingStudent?.batch || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-500">Parent / Guardian:</span>
                    <span className="font-bold text-slate-700">{correspondingStudent?.parentName || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial ledger statement */}
            <div className="mt-2 rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-right">Amount ({settings?.currencySymbol || '₹'})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 font-medium text-slate-700">
                      Coaching Tuition & Examination fee - {activePayment.courseName}
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-800">
                      {settings?.currencySymbol || '₹'}{activePayment.amount.toLocaleString('en-IN')}.00
                    </td>
                  </tr>
                  <tr className="font-bold text-sm text-slate-800">
                    <td className="pt-3 pb-1">Total Paid Amount</td>
                    <td className="pt-3 pb-1 text-right text-blue-600">{settings?.currencySymbol || '₹'}{activePayment.amount.toLocaleString('en-IN')}.00</td>
                  </tr>
                </tbody>
              </table>

              <div className="border-t border-slate-200/50 pt-3 text-[10px] italic text-slate-500">
                Amount in words: <span className="font-bold not-italic text-slate-700 capitalize">{numberToWords(activePayment.amount, settings?.currencySymbol)}</span>
              </div>
            </div>

            {/* Remarks if any */}
            {activePayment.remarks && (
              <div className="mt-4 p-3 bg-blue-50/20 border border-blue-100/50 text-[11px] text-slate-600 rounded-xl">
                <span className="font-bold">Remarks: </span>{activePayment.remarks}
              </div>
            )}

            {/* Balance Dues summary */}
            {correspondingStudent && (
              <div className="mt-5 grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Course Ledger Total</span>
                  <span className="font-bold text-slate-700 mt-1 block">{settings?.currencySymbol || '₹'}{correspondingStudent.totalFees.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Remaining Dues Balance</span>
                  <span className={`font-bold mt-1 block ${correspondingStudent.feesDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {settings?.currencySymbol || '₹'}{correspondingStudent.feesDue.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}

            {/* Footer Signatures */}
            <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-6">
              <p className="text-center sm:text-left text-[10px]">
                {settings?.receiptFooter || "This is a computer generated receipt. Signature is not mandatory."}
              </p>
              <div className="text-center sm:text-right shrink-0">
                <div className="w-32 border-b border-slate-300 mx-auto sm:mr-0 h-10 flex items-center justify-center overflow-hidden">
                  {settings?.authorizedSignatureUrl && (
                    <img src={settings.authorizedSignatureUrl} alt="Signature Stamp" className="max-h-full max-w-full object-contain" />
                  )}
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-500 mt-1 block">Authorized Signatory</span>
              </div>
            </div>
          </div>

          {/* Action buttons sidebar (no-print) */}
          <div className="w-full lg:w-60 space-y-3 no-print">
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3.5">
              <h4 className="text-xs font-bold text-slate-700">Receipt Actions</h4>
              
              <button 
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm shadow-blue-100 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
              
              <button 
                onClick={() => handleDownloadPDF(activePayment.receiptNumber)}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span>Download PDF</span>
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-2 text-xs">
              <h5 className="font-bold text-slate-700">Audit Info</h5>
              <div className="text-slate-500 space-y-1.5">
                <p>Status: <span className="text-emerald-600 font-bold">Cleared</span></p>
                <p>Created by: admin_demo</p>
                <p>Channel: Web ERP Portal</p>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Receipts Listing Directory */
        <div className="space-y-4">
          
          {/* Search bar & Sorting bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div className="relative max-w-md w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Search receipt ID, student, course..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50"
              />
            </div>

            {/* Column sorting dropdown trigger (mobile style helper) */}
            <div className="flex gap-2 text-xs font-semibold text-slate-500 select-none">
              <span className="self-center">Sort By:</span>
              <button 
                onClick={() => handleSort('date')}
                className={`px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${sortField === 'date' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white border-slate-200'}`}
              >
                Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
              <button 
                onClick={() => handleSort('amount')}
                className={`px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${sortField === 'amount' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white border-slate-200'}`}
              >
                Amount {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
              <button 
                onClick={() => handleSort('name')}
                className={`px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${sortField === 'name' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white border-slate-200'}`}
              >
                Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          </div>

          {/* Receipts grid or loader */}
          {isLoading ? (
            <TableSkeleton columnCount={3} rowCount={2} />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginatedReceipts.length > 0 ? (
                  paginatedReceipts.map(p => (
                    <div key={p.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {p.receiptNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">{p.paymentDate}</span>
                        </div>

                        <div className="py-4 space-y-1.5">
                          <h4 className="text-sm font-bold text-slate-800">{p.studentName}</h4>
                          <p className="text-xs text-slate-500 truncate">{p.courseName}</p>
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-[10px] text-slate-400 font-medium">Method: {p.paymentMethod}</span>
                            <span className="text-sm font-bold text-blue-600">{settings?.currencySymbol || '₹'}{p.amount.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>

                      <Link 
                        to={`/receipts?id=${p.id}`}
                        className="w-full flex items-center justify-center gap-1 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 font-semibold py-2 rounded-xl text-xs transition-colors border border-slate-100 cursor-pointer"
                      >
                        <span>Open Invoice</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-xs">
                    <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                      <AlertCircle className="w-7 h-7 text-slate-300" />
                      <span>No receipts matching search parameters.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-505 no-print pt-2">
                  <div>
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedReceipts.length)} of {sortedReceipts.length} receipts
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
      )}
    </div>
  );
};

