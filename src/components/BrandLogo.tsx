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
          <linearGradient id="saturn-planet" x1="8%" y1="10%" x2="92%" y2="90%">
            <stop offset="0" stopColor="#06B6D4" />
            <stop offset=".48" stopColor="#2563EB" />
            <stop offset="1" stopColor="#6D28D9" />
          </linearGradient>
          <linearGradient id="saturn-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#06B6D4" />
            <stop offset=".55" stopColor="#4F46E5" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        <path d="M8 49C27 25 68 16 88 26C68 28 37 42 15 59" fill="none" stroke="url(#saturn-ring)" strokeWidth="7" strokeLinecap="round"/>
        <circle cx="49" cy="30" r="23" fill="url(#saturn-planet)"/>
        <path d="M7 53C26 39 66 22 88 25C74 43 40 59 12 62" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M12 65Q29 54 48 70Q67 54 85 65L82 74Q65 65 48 79Q30 65 15 74Z" fill="#FFFFFF" stroke="#6D28D9" strokeWidth="2"/>
        <path d="M48 70V78" stroke="#6D28D9" strokeWidth="2"/>
        <path d="M78 4L81 12L89 15L81 18L78 26L75 18L67 15L75 12Z" fill="#6D28D9"/>
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
