import React from 'react';

type BrandLogoProps = {
  compact?: boolean;
  light?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, light = false, className = '' }: BrandLogoProps) {
  const titleColor = light ? '#FFFFFF' : '#19152E';
  return (
    <div className={`inline-flex min-w-0 items-center gap-2.5 ${className}`} aria-label="Saturn ERP">
      <svg viewBox="0 0 96 82" role="img" aria-hidden="true" className={compact ? 'h-10 w-12 shrink-0' : 'h-16 w-[76px] shrink-0'}>
        <defs>
          <linearGradient id="saturn-orbit" x1="8%" y1="15%" x2="92%" y2="85%">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset=".58" stopColor="#D9C6FF" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <path d="M9 48C25 29 57 16 86 23C68 28 37 43 13 59" fill="none" stroke="url(#saturn-orbit)" strokeWidth="4.5" strokeLinecap="round"/>
        <path d="M11 52C30 39 62 25 87 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" opacity=".95"/>
        <path d="M12 62Q29 51 48 67Q67 51 84 62L81 73Q64 64 48 78Q31 64 15 73Z" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinejoin="round"/>
        <path d="M48 67V77" stroke="#C4B5FD" strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M77 5L80 12L87 15L80 18L77 25L74 18L67 15L74 12Z" fill="#A78BFA"/>
        <circle cx="24" cy="31" r="2.3" fill="#FFFFFF"/>
      </svg>
      {!compact && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="whitespace-nowrap text-[1.45rem] font-extrabold tracking-tight" style={{ color: titleColor }}>
            Saturn <span className="text-violet-600">ERP</span>
          </span>
          <span className={`mt-1 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[.18em] ${light ? 'text-white/75' : 'text-slate-500'}`}>
            Tuition Management System
          </span>
        </span>
      )}
    </div>
  );
}
