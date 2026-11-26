import React from 'react';
import { NavLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { ClassBandhuMark } from './ClassBandhuMark';
import {
  LayoutDashboard,
  UserPlus,
  CreditCard,
  Receipt,
  BellRing,
  BookOpen,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Settings,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const { settings, showToast } = useData();
  const auth = useAuth();
  const role = auth.activeMembership?.role;
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admissions', label: 'Admissions', icon: UserPlus },
    { to: '/payments', label: 'Fee Collection', icon: CreditCard },
    { to: '/receipts', label: 'Receipts', icon: Receipt },
    { to: '/reminders', label: 'Dues & Reminders', icon: BellRing },
    { to: '/courses', label: 'Courses & Batches', icon: BookOpen },
    ...(role === 'owner' ? [{ to: '/attendance', label: 'Attendance', icon: ClipboardCheck }] : []),
    ...(role === 'owner' || !auth.configured ? [{ to: '/settings', label: 'Settings', icon: Settings }] : []),
  ];

  const profileLabel = auth.configured
    ? (auth.activeMembership?.role || 'Member')
    : 'Demo workspace';
  const profileEmail = auth.configured
    ? auth.email
    : (settings?.email || 'Sample data');

  React.useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1280px)');
    const closeDrawerOnDesktop = () => {
      if (desktopQuery.matches) setMobileOpen(false);
    };
    closeDrawerOnDesktop();
    desktopQuery.addEventListener('change', closeDrawerOnDesktop);
    return () => desktopQuery.removeEventListener('change', closeDrawerOnDesktop);
  }, [setMobileOpen]);

  const sidebarContent = (
    <div className="flex h-full flex-col select-none bg-[#6B1F38] text-[#FAF7F8]">
      <div className={`flex min-h-[76px] items-center justify-between border-b border-white/10 px-5 py-4 ${collapsed ? 'xl:justify-center xl:px-2' : ''}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
            <ClassBandhuMark className="h-9 w-9 text-[#6B1F38]" />
          </div>
          <div className={`flex min-w-0 flex-col ${collapsed ? 'xl:hidden' : ''}`}>
            <span className="truncate text-base font-bold tracking-tight text-white">{settings.instituteName || 'Your Institute'}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#E8C9D4]">
              Institute workspace
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white xl:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className={`px-5 pb-2 pt-6 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D9AEBE] ${collapsed ? 'xl:hidden' : ''}`}>
        Workspace
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `
                group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium
                transition-colors duration-150
                ${isActive
                  ? 'bg-white text-[#6B1F38] shadow-sm'
                  : 'text-[#F4E7EC] hover:bg-white/10 hover:text-white'}
                ${collapsed ? 'xl:justify-center xl:px-2' : ''}
              `}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span className={`truncate ${collapsed ? 'xl:hidden' : ''}`}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-white/10 p-4">
        <div className={`flex min-w-0 items-center gap-3 rounded-lg bg-black/10 p-2.5 ${collapsed ? 'xl:justify-center xl:px-1' : ''}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F8E9ED] text-xs font-bold uppercase text-[#6B1F38]">
            {(profileLabel.slice(0, 2) || 'CB').toUpperCase()}
          </div>
          <div className={`flex min-w-0 flex-col ${collapsed ? 'xl:hidden' : ''}`}>
            <span className="truncate text-xs font-semibold text-white">{profileLabel}</span>
            <span className="mt-1 truncate text-[10px] text-[#E8C9D4]">{profileEmail}</span>
          </div>
        </div>

        {auth.configured && role === 'owner' && (
          <button
            type="button"
            onClick={() => void auth.signOut().catch(() => showToast('Could not sign out. Please try again.', 'error'))}
            className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-[#F4E7EC] transition-colors hover:bg-white/10 hover:text-white ${collapsed ? 'xl:justify-center xl:px-2' : ''}`}
            title={collapsed ? 'Sign out' : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={collapsed ? 'xl:hidden' : ''}>Sign out</span>
          </button>
        )}

        <div className={`flex items-center gap-3 border-t border-white/15 pt-4 ${collapsed ? 'xl:justify-center' : ''}`}>
          <ClassBandhuMark className="h-10 w-10 shrink-0 text-white" />
          <div className={`min-w-0 border-l border-white/25 pl-3 ${collapsed ? 'xl:hidden' : ''}`}>
            <p className="text-base font-bold leading-tight text-white">ClassBandhu</p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.13em] text-[#E8C9D4]">Tuition Management System</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden min-h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-medium text-[#D9AEBE] transition-colors hover:bg-white/10 hover:text-white xl:flex"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse sidebar</span></>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className={`sticky top-0 hidden h-dvh shrink-0 transition-[width] duration-200 xl:block ${collapsed ? 'w-[76px]' : 'w-[252px]'}`}>
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 xl:hidden"
        />
      )}
      <aside
        aria-label="Mobile navigation"
        className={`fixed inset-y-0 left-0 z-50 w-[280px] shadow-2xl transition-transform duration-200 xl:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-hidden={!mobileOpen}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
