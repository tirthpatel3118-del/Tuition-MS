import React from 'react';

type BrandLogoProps = {
  compact?: boolean;
  light?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, light = false, className = '' }: BrandLogoProps) {
  const titleColor = light ? '#FFFFFF' : '#321020';
  const accentColor = light ? '#FFFFFF' : '#8B1E45';
  return (
    <div className={`inline-flex min-w-0 items-center gap-3 ${className}`} aria-label="Saturn ERP">
      <svg viewBox="0 0 100 88" role="img" aria-hidden="true" className={compact ? 'h-10 w-11 shrink-0' : 'h-[4.5rem] w-[5.1rem] shrink-0'}>
        <path d="M12 52C28 31 63 18 88 25C71 30 40 44 15 61" fill="none" stroke={accentColor} strokeWidth="5.5" strokeLinecap="round"/>
        <path d="M16 55C36 43 64 30 87 26" fill="none" stroke={light ? '#FFFFFF' : '#5B1833'} strokeWidth="2" strokeLinecap="round"/>
        <path d="M19 35C25 18 41 10 55 12C70 14 78 26 76 39C64 43 39 47 23 43Z" fill={light ? '#FFFFFF' : '#8B1E45'}/>
        <path d="M13 65Q32 55 50 69Q68 55 87 65L84 77Q66 68 50 83Q33 68 16 77Z" fill="none" stroke={accentColor} strokeWidth="4" strokeLinejoin="round"/>
        <path d="M50 69V82" stroke={light ? '#FFFFFF' : '#B66A87'} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M78 5L81 12L88 15L81 18L78 25L75 18L68 15L75 12Z" fill={light ? '#D8B4FE' : '#8B5CF6'}/>
      </svg>
      {!compact && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="whitespace-nowrap text-[1.45rem] font-extrabold tracking-tight" style={{ color: titleColor }}>
            Saturn <span style={{ color: light ? '#D8B4FE' : '#A32652' }}>ERP</span>
          </span>
          <span className={`mt-1.5 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[.18em] ${light ? 'text-white/75' : 'text-slate-500'}`}>
            Tuition Management System
          </span>
        </span>
      )}
    </div>
  );
}
