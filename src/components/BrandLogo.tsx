import React from 'react';

type BrandLogoProps = {
  compact?: boolean;
  light?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, light = false, className = '' }: BrandLogoProps) {
  const ink = light ? '#FFFFFF' : '#6B1F38';
  const planetTop = light ? '#FFFFFF' : '#F5DCE5';
  const planetBottom = light ? '#F3DCE5' : '#A32652';
  const page = light ? '#FFFFFF' : '#6B1F38';

  return (
    <div className={`inline-flex min-w-0 items-center gap-3 ${className}`} aria-label="Saturn ERP">
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true" className={compact ? 'h-10 w-10 shrink-0' : 'h-16 w-16 shrink-0'}>
        <defs>
          <linearGradient id="saturn-planet" x1="25%" y1="5%" x2="78%" y2="100%">
            <stop offset="0" stopColor={planetTop}/>
            <stop offset=".52" stopColor={light ? '#F6E8ED' : '#D98AA5'}/>
            <stop offset="1" stopColor={planetBottom}/>
          </linearGradient>
        </defs>
        <path d="M17 65C22 34 40 17 58 19C75 21 85 37 82 55C79 72 65 82 48 81C32 80 20 74 17 65Z" fill="url(#saturn-planet)"/>
        <path d="M9 62C24 49 61 33 91 38C83 49 52 65 16 73" fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round"/>
        <path d="M8 61C24 48 60 34 89 38" fill="none" stroke={light ? '#FFFFFF' : '#8B1E45'} strokeWidth="3" strokeLinecap="round"/>
        <path d="M14 70Q31 62 49 75Q67 62 86 70L82 83Q65 76 49 91Q32 76 17 83Z" fill="none" stroke={page} strokeWidth="4" strokeLinejoin="round"/>
        <path d="M49 75V89" stroke={light ? '#F1D5DF' : '#A32652'} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M80 7L83 15L91 18L83 21L80 29L77 21L69 18L77 15Z" fill={light ? '#E9D5FF' : '#8B5CF6'}/>
      </svg>
      {!compact && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="whitespace-nowrap text-[1.45rem] font-extrabold tracking-tight" style={{ color: light ? '#FFFFFF' : '#321020' }}>
            Saturn <span style={{ color: light ? '#F0D8E2' : '#A32652' }}>ERP</span>
          </span>
          <span className={`mt-1.5 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[.18em] ${light ? 'text-white/75' : 'text-slate-500'}`}>
            Tuition Management System
          </span>
        </span>
      )}
    </div>
  );
}
