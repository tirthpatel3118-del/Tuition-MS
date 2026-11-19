import React from 'react';
import { NavLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';
import {
  LayoutDashboard, UserPlus, CreditCard, Receipt, BellRing, BookOpen,
  ChevronLeft, ChevronRight, X, Settings, LogOut
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
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
    ...(role === 'owner' || !auth.configured ? [{ to: '/settings', label: 'Settings', icon: Settings }] : []),
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col border-r border-[#5A1732] bg-[#681D3B] text-white select-none">
      <div className={`flex items-center justify-between border-b border-white/10 px-4 py-5 ${collapsed ? 'justify-center px-2' : ''}`}>
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo compact light />
          {!collapsed && <div className="min-w-0"><p className="truncate text-sm font-bold text-white">Saturn ERP</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-rose-100/75">Institute workspace</p></div>}
        </div>
        <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1 text-rose-100 hover:bg-white/10 md:hidden" aria-label="Close navigation"><X className="h-5 w-5" /></button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className={`mb-3 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-rose-100/65 ${collapsed ? 'text-center' : ''}`}>{collapsed ? '•' : 'Workspace'}</p>
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive ? 'bg-white text-[#681D3B] shadow-sm' : 'text-rose-50/90 hover:bg-white/10 hover:text-white'} ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? item.label : undefined}>
              <Icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-white/10 p-4">
        <div className={`flex items-center gap-3 rounded-xl bg-black/10 p-2 ${collapsed ? 'justify-center p-1' : ''}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm font-bold text-white"> {auth.configured ? (auth.email?.slice(0,1).toUpperCase() || 'U') : 'D'} </div>
          {!collapsed && <div className="flex min-w-0 flex-col overflow-hidden"><span className="truncate text-xs font-semibold leading-none text-white">{auth.configured ? auth.activeMembership?.role : 'Demo'}</span><span className="mt-1 truncate text-[10px] text-rose-100/70">{auth.configured ? auth.email : (settings?.email || 'Demo mode')}</span></div>}
        </div>
        {auth.configured && role === 'owner' && <button type="button" onClick={() => void auth.signOut().catch(() => showToast('Could not sign out. Please try again.', 'error'))} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-50/90 transition-colors hover:bg-white/10 hover:text-white ${collapsed ? 'justify-center px-2' : ''}`} title={collapsed ? 'Sign out' : undefined}><LogOut className="h-4 w-4 shrink-0" />{!collapsed && <span>Sign out</span>}</button>}
        <button onClick={() => setCollapsed(!collapsed)} className="hidden w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-rose-100/70 transition-colors hover:bg-white/10 hover:text-white md:flex">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse Sidebar</span></>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className={`sticky top-0 hidden h-screen shrink-0 transition-all duration-300 md:block ${collapsed ? 'w-20' : 'w-64'}`}>{sidebarContent}</div>
      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 md:hidden" />}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 md:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>{sidebarContent}</div>
    </>
  );
};
