import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DataProvider, useData } from './context/DataContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Admissions } from './pages/Admissions';
import { Payments } from './pages/Payments';
import { Receipts } from './pages/Receipts';
import { Reminders } from './pages/Reminders';
import { Courses } from './pages/Courses';
import { Settings } from './pages/Settings';
import { Menu, RotateCcw, Bell } from 'lucide-react';
import { resetToDefault } from './data/mockData';

function AppContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { confirmAction } = useData();

  return (
    <div className="flex min-h-screen bg-slate-50/50 font-sans">
      {/* Collapsible Sidebar */}
      <Sidebar 
        collapsed={collapsed} 
        setCollapsed={setCollapsed} 
        mobileOpen={mobileOpen} 
        setMobileOpen={setMobileOpen} 
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="bg-white border-b border-slate-100 h-16 flex items-center justify-between px-6 sticky top-0 z-30 select-none no-print">
          {/* Left header: mobile toggle & search */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-150/40 px-3 py-1.5 rounded-xl border border-slate-200/10 text-slate-400">
              <span className="text-[10px] font-semibold tracking-wider uppercase bg-white border border-slate-200 text-slate-500 px-1 rounded">Ctrl</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase bg-white border border-slate-200 text-slate-500 px-1 rounded">K</span>
              <span className="text-xs font-medium text-slate-500 pl-1">Quick Search...</span>
            </div>
          </div>

          {/* Right header actions */}
          <div className="flex items-center gap-4">
            {/* Reset Data Button */}
            <button 
              onClick={() => {
                confirmAction({
                  title: 'Reset System Data',
                  message: 'Are you sure you want to reset all data back to original defaults? All your additions, updates, payments, and reminders will be cleared.',
                  confirmText: 'Reset Data',
                  type: 'danger',
                  onConfirm: () => {
                    resetToDefault();
                  }
                });
              }}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              title="Reset application mock data back to factory defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset System Data</span>
            </button>

            <div className="h-4 w-[1px] bg-slate-200"></div>

            <div className="relative p-2 text-slate-400 hover:text-slate-655 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600"></span>
            </div>
          </div>
        </header>

        {/* Page Router Body */}
        <main className="flex-1 p-5 md:p-8 max-w-7xl w-full mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/admissions" element={<Admissions />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/receipts" element={<Receipts />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        {/* Global Layout Footer */}
        <footer className="w-full py-5 mt-auto bg-white border-t border-slate-100 text-center text-xs text-slate-400 no-print select-none">
          <div className="max-w-7xl mx-auto px-6 space-y-1">
            <div className="text-slate-500 font-semibold">EduLedger ERP v1.0.0</div>
            <div className="text-slate-400">
              © 2026 EduLedger ERP • Developed & Maintained by Tirth Patel • <a href="mailto:Tirth.freelancer31@gmail.com" className="text-slate-400 hover:text-blue-600 transition-colors font-medium">Tirth.freelancer31@gmail.com</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function App() {
  return (
    <DataProvider>
      <Router>
        <AppContent />
      </Router>
    </DataProvider>
  );
}

export default App;
