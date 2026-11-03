import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider, useData } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Admissions } from './pages/Admissions';
import { Payments } from './pages/Payments';
import { Receipts } from './pages/Receipts';
import { Reminders } from './pages/Reminders';
import { Courses } from './pages/Courses';
import { Settings } from './pages/Settings';
import { Menu, RotateCcw, Bell, LogOut } from 'lucide-react';
import { resetToDefault } from './data/mockData';
import { isSupabaseConfigured } from './lib/supabase';
import { AuthLoading, AuthPage, CreateInstitutePage, SelectInstitutePage } from './pages/AuthPages';
import { TeacherWorkspace } from './pages/TeacherWorkspace';

function AppContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { confirmAction } = useData();
  const auth = useAuth();

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
            {auth.configured && auth.activeMembership && (
              <div className="hidden sm:flex items-center gap-2">
                {auth.memberships.length > 1 && (
                  <select
                    aria-label="Active institute"
                    value={auth.activeMembership.instituteId}
                    onChange={event => auth.selectInstitute(event.target.value)}
                    className="max-w-44 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600"
                  >
                    {auth.memberships.map(item => <option key={item.instituteId} value={item.instituteId}>{item.instituteName}</option>)}
                  </select>
                )}
                <span className="hidden lg:inline text-xs text-slate-500" title={auth.email ?? undefined}>{auth.email}</span>
                <button onClick={() => void auth.signOut()} title="Sign out" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Reset only affects local demo data. */}
            {!auth.configured && <button 
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
            </button>}

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
            <Route path="/settings" element={auth.activeMembership?.role === 'owner' || !auth.configured ? <Settings /> : <Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Global Layout Footer */}
        <footer className="w-full py-5 mt-auto bg-white border-t border-slate-100 text-center text-xs text-slate-400 no-print select-none">
          <div className="max-w-7xl mx-auto px-6 space-y-1">
            <div className="text-slate-500 font-semibold">EduLedger ERP v1.0.0</div>
            <div className="text-slate-400">
              © 2026 EduLedger ERP
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function AppEntry() {
  const auth = useAuth();

  if (!auth.configured) {
    if (import.meta.env.PROD) {
      return (
        <main className="min-h-screen bg-slate-50 px-4 flex items-center justify-center">
          <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">Workspace setup required</h1>
            <p role="alert" className="mt-3 text-sm leading-6 text-slate-600">
              EduLedger is not connected to its authentication and database service. Please contact your administrator.
            </p>
          </section>
        </main>
      );
    }
    return <DataProvider><AppContent /></DataProvider>;
  }

  if (auth.status === 'loading' || auth.status === 'verifying' || auth.status === 'loading-memberships') {
    return <AuthLoading />;
  }

  if (auth.status === 'signed-out') return <AuthPage />;

  if (auth.status === 'error') {
    return (
      <main className="min-h-screen bg-slate-50 px-4 flex items-center justify-center">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Could not open your workspace</h1>
          <p role="alert" className="mt-3 text-sm leading-6 text-slate-600">{auth.error}</p>
          <button onClick={() => void auth.refreshMemberships()} className="mt-6 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">Try again</button>
          <button onClick={() => void auth.signOut()} className="ml-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 hover:text-slate-800">Sign out</button>
        </section>
      </main>
    );
  }

  if (auth.memberships.length === 0) return <CreateInstitutePage />;
  if (!auth.activeMembership) return <SelectInstitutePage />;
  if (auth.activeMembership.role === 'teacher') return <TeacherWorkspace />;

  return <DataProvider key={auth.activeMembership.instituteId}><AppContent /></DataProvider>;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppEntry />
      </AuthProvider>
    </Router>
  );
}

export default App;

