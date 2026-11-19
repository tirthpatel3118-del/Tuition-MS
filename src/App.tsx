import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, NavLink } from 'react-router-dom';
import { DataProvider, useData } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { EduLedgerMark } from './components/EduLedgerMark';
import { PWAControls } from './components/PWAControls';
import { Menu, RotateCcw, Bell, LogOut, LayoutDashboard, UserPlus, CreditCard, ClipboardCheck, BookOpen, ShieldCheck, Mail, MessageCircle } from 'lucide-react';
import { resetToDefault } from './data/mockData';
import { isDemoMode } from './lib/supabase';
import { AuthLoading, AuthPage, CreateInstitutePage, ForgotPasswordPage, PasswordResetPage, PrivacyPolicyPage, SelectInstitutePage, TermsPage } from './pages/AuthPages';
import { InvitationAcceptancePage } from './pages/InvitationAcceptancePage';
import { PlatformInvitationAcceptancePage } from './pages/PlatformInvitationAcceptancePage';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';

const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Admissions = lazy(() => import('./pages/Admissions').then(module => ({ default: module.Admissions })));
const Payments = lazy(() => import('./pages/Payments').then(module => ({ default: module.Payments })));
const Receipts = lazy(() => import('./pages/Receipts').then(module => ({ default: module.Receipts })));
const Reminders = lazy(() => import('./pages/Reminders').then(module => ({ default: module.Reminders })));
const Courses = lazy(() => import('./pages/Courses').then(module => ({ default: module.Courses })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const TeacherWorkspace = lazy(() => import('./pages/TeacherWorkspace').then(module => ({ default: module.TeacherWorkspace })));
const AttendancePage = lazy(() => import('./pages/Attendance').then(module => ({ default: module.AttendancePage })));

function AppContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { confirmAction } = useData();
  const auth = useAuth();

  return (
    <div className="flex min-h-screen bg-[#FAF7F8] font-sans text-slate-800">
      {/* Collapsible Sidebar */}
      <Sidebar 
        collapsed={collapsed} 
        setCollapsed={setCollapsed} 
        mobileOpen={mobileOpen} 
        setMobileOpen={setMobileOpen} 
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {isDemoMode && (
          <div role="status" className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs font-medium text-amber-900">
            Browser demo · Sample data only · Changes stay in this browser and are not saved to the institute database.
          </div>
        )}
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E5DDE0] bg-white/95 px-4 backdrop-blur-sm select-none no-print sm:px-6">
          {/* Left header: mobile toggle & search */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-[#6B1F38] transition-colors hover:bg-[#F8E9ED] lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden items-center gap-1.5 rounded-lg border border-[#E5DDE0] bg-[#FAF7F8] px-3 py-2 text-slate-400 sm:flex">
              <span className="text-[10px] font-semibold tracking-wider uppercase bg-white border border-slate-200 text-slate-500 px-1 rounded">Ctrl</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase bg-white border border-slate-200 text-slate-500 px-1 rounded">K</span>
              <span className="text-xs font-medium text-slate-500 pl-1">Quick Search...</span>
            </div>
          </div>

          {/* Right header actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <PWAControls />
            {auth.platformAdmin && (
              <NavLink to="/super-admin" className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5DDE0] bg-white px-3 py-2 text-xs font-semibold text-[#6B1F38] hover:bg-[#F8E9ED]">
                <ShieldCheck className="h-4 w-4" />Super Admin
              </NavLink>
            )}
            {auth.configured && auth.activeMembership && (
              <div className="hidden items-center gap-2 sm:flex">
                {auth.memberships.length > 1 && (
                  <select
                    aria-label="Active institute"
                    value={auth.activeMembership.instituteId}
                    onChange={event => auth.selectInstitute(event.target.value)}
                    className="max-w-44 rounded-lg border border-[#E5DDE0] bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    {auth.memberships.map(item => <option key={item.instituteId} value={item.instituteId}>{item.instituteName}</option>)}
                  </select>
                )}
                <span className="hidden lg:inline text-xs text-slate-500" title={auth.email ?? undefined}>{auth.email}</span>
                <button onClick={() => void auth.signOut()} title="Sign out" className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-[#F8E9ED] hover:text-[#6B1F38]">
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
              className="flex items-center gap-2 rounded-lg border border-[#E5DDE0] bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-[#F8E9ED] hover:text-[#6B1F38]"
              title="Reset application mock data back to factory defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset System Data</span>
            </button>}

            <div className="h-4 w-[1px] bg-slate-200"></div>

            <div className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-[#F8E9ED] hover:text-[#6B1F38]">
              <Bell className="w-5 h-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#A03B5E]"></span>
            </div>
          </div>
        </header>

        {/* Page Router Body */}
        <main className="mx-auto w-full max-w-[1440px] min-w-0 flex-1 px-3 pb-24 pt-4 sm:px-5 sm:pt-5 lg:px-8 lg:pb-8 lg:pt-7">
          <Suspense fallback={<div className="py-12 text-center text-sm text-slate-500">Loading workspace…</div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/admissions" element={<Admissions />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/receipts" element={<Receipts />} />
              <Route path="/reminders" element={<Reminders />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/attendance" element={auth.activeMembership?.role === 'owner' ? <AttendancePage /> : <Navigate to="/" replace />} />
              <Route path="/settings" element={auth.activeMembership?.role === 'owner' || !auth.configured ? <Settings /> : <Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>

        {/* Mobile primary navigation */}
        <nav aria-label="Mobile primary navigation" className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-[#E5DDE0] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-6px_24px_rgba(31,41,55,0.06)] backdrop-blur lg:hidden">
          {[
            { to: '/', label: 'Home', icon: LayoutDashboard },
            { to: '/admissions', label: 'Admissions', icon: UserPlus },
            { to: '/payments', label: 'Fees', icon: CreditCard },
            ...(auth.activeMembership?.role === 'owner' ? [{ to: '/attendance', label: 'Attendance', icon: ClipboardCheck }] : []),
            { to: '/courses', label: 'Courses', icon: BookOpen },
          ].map(item => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium transition-colors ${isActive ? 'text-[#6B1F38]' : 'text-slate-500'}`}>
                {({ isActive }) => <><Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.2 : 1.8} /><span>{item.label}</span></>}
              </NavLink>
            );
          })}
        </nav>

        {/* EduLedger product footer — fluid layout from phones to wide desktop */}
        <footer className="mt-auto w-full min-w-0 border-t border-[#D8CDD2] bg-white px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-6 text-xs text-[#51404A] no-print sm:px-6 lg:pb-5">
          <div className="mx-auto w-full max-w-7xl">
            <div className="grid min-w-0 grid-cols-1 items-center gap-5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 items-center justify-center gap-3 sm:justify-start xl:pr-4">
                <EduLedgerMark className="h-14 w-14 shrink-0 text-[#790D3D] sm:h-16 sm:w-16" />
                <div className="min-w-0 border-l border-[#D8CDD2] pl-3 sm:pl-4">
                  <p className="text-xl font-bold tracking-tight text-[#790D3D] sm:text-2xl">EduLedger</p>
                  <p className="mt-1 text-[10px] font-semibold text-[#790D3D] sm:text-xs">— Learning Made Organized —</p>
                </div>
              </div>
              <p className="min-w-0 border-y border-[#D8CDD2] px-3 py-4 text-center text-sm leading-relaxed sm:col-span-2 sm:row-start-2 sm:text-base xl:col-span-1 xl:row-start-1 xl:border-y-0 xl:border-x xl:px-5">
                A complete Tuition Management System for Educational Institutes.
              </p>
              <div className="flex min-w-0 flex-col items-center gap-3 sm:items-start sm:justify-self-end sm:pr-1 xl:justify-self-start xl:pl-5">
                <a href="mailto:tirth.freelance31@gmail.com" className="flex min-w-0 max-w-full items-center gap-3 text-sm transition-colors hover:text-[#790D3D] sm:text-base">
                  <Mail className="h-5 w-5 shrink-0 text-[#790D3D] sm:h-6 sm:w-6" aria-hidden="true" />
                  <span className="break-all">tirth.freelance31@gmail.com</span>
                </a>
                <a href="https://wa.me/918160733101" target="_blank" rel="noreferrer" className="flex min-w-0 max-w-full items-center gap-3 text-sm transition-colors hover:text-[#790D3D] sm:text-base">
                  <MessageCircle className="h-5 w-5 shrink-0 text-[#790D3D] sm:h-6 sm:w-6" aria-hidden="true" />
                  <span className="whitespace-nowrap">+91 81607 33101</span>
                </a>
              </div>
            </div>
            <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-[#D8CDD2] pt-4 text-center xl:flex-row xl:text-left">
              <span>© 2026 EduLedger. All rights reserved.</span>
              <span className="font-medium italic text-[#5B2941]">—　Empowering Education. Together.　—</span>
              <span className="rounded-full bg-[#EEE8EC] px-4 py-1.5 text-sm font-semibold text-[#5B2941]">v1.0.0</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function AppEntry() {
  const auth = useAuth();
  const location = useLocation();
  const isInvitationRoute = location.pathname === '/accept-invitation';

  if (location.pathname === '/privacy') return <PrivacyPolicyPage />;
  if (location.pathname === '/terms') return <TermsPage />;

  if (!auth.configured) {
    if (import.meta.env.PROD && !isDemoMode) {
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

  if (location.pathname === '/forgot-password') return <ForgotPasswordPage />;
  if (location.pathname === '/reset-password') return <PasswordResetPage />;
  if (location.pathname === '/accept-platform-invitation') return <PlatformInvitationAcceptancePage />;

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

  if (isInvitationRoute) return <InvitationAcceptancePage />;
  if (location.pathname === '/sign-in' || location.pathname === '/sign-up') return <Navigate to="/" replace />;
  if (location.pathname === '/super-admin') return <SuperAdminDashboard />;
  if (auth.platformAdmin && location.pathname === '/') return <Navigate to="/super-admin" replace />;

  if (auth.memberships.length === 0) {
    if (auth.platformAdmin) return <Navigate to="/super-admin" replace />;
    return <CreateInstitutePage />;
  }
  if (!auth.activeMembership) return <SelectInstitutePage />;
  if (auth.activeMembership.accessStatus !== 'active') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF7F8] px-4 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Workspace access is unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This institute subscription is {auth.activeMembership.accessStatus}. Contact EduLedger administration or your institute owner to restore access.
          </p>
          {auth.memberships.filter(item => item.instituteId !== auth.activeMembership?.instituteId && item.accessStatus === 'active').length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold text-slate-500">Other available workspaces</p>
              {auth.memberships.filter(item => item.instituteId !== auth.activeMembership?.instituteId && item.accessStatus === 'active').map(item => (
                <button key={item.instituteId} onClick={() => auth.selectInstitute(item.instituteId)} className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">{item.instituteName}</button>
              ))}
            </div>
          )}
          <button onClick={() => void auth.signOut()} className="mt-5 w-full rounded-xl bg-[#6B1F38] px-4 py-3 text-sm font-semibold text-white">Sign out</button>
        </section>
      </main>
    );
  }
  if (auth.activeMembership.role === 'teacher') {
    return <Suspense fallback={<AuthLoading />}><TeacherWorkspace /></Suspense>;
  }

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

