import React from 'react';
import { NavLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  UserPlus, 
  CreditCard, 
  Receipt, 
  BellRing, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight,
  X,
  Sparkles,
  Settings
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
  setMobileOpen
}) => {
  const { settings } = useData();
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
    <div className="flex flex-col h-full bg-white border-r border-slate-100 select-none">
      {/* Header / Logo */}
      <div className={`flex items-center justify-between p-5 border-b border-slate-50 ${collapsed ? 'justify-center px-2' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200 shrink-0 overflow-hidden">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-slate-800 text-sm leading-none tracking-tight truncate max-w-[130px]">{settings?.instituteName || 'EduLedger'}</span>
              <span className="text-[9px] text-blue-600 font-semibold tracking-wider uppercase mt-0.5">ERP Suite</span>
            </div>
          )}
        </div>
        
        {/* Mobile close button only */}
        <button 
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                ${isActive 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                ${collapsed ? 'justify-center px-2' : ''}
              `}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-105`} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / User Profile & Collapse Toggle */}
      <div className="p-4 border-t border-slate-50 space-y-3">
        {/* Profile Card */}
        <div className={`flex items-center gap-3 p-2 rounded-xl bg-slate-50 ${collapsed ? 'justify-center p-1' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
            AD
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-semibold text-slate-800 truncate leading-none">{auth.configured ? auth.activeMembership?.role : 'Demo'}</span>
                <span className="text-[10px] text-slate-500 truncate mt-1">{auth.configured ? auth.email : (settings?.email || 'Demo mode')}</span>
            </div>
          )}
        </div>

        {/* Collapse Button - Desktop Only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center justify-center w-full py-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-xs font-medium gap-1"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={`hidden md:block transition-all duration-300 h-screen sticky top-0 shrink-0 ${collapsed ? 'w-20' : 'w-64'}`}>
        {sidebarContent}
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity duration-300"
        />
      )}

      {/* Mobile Drawer Menu */}
      <div className={`
        md:hidden fixed inset-y-0 left-0 w-64 z-50 transition-transform duration-300 transform
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {sidebarContent}
      </div>
    </>
  );
};

