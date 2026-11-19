import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
  light?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false, light = false, className = '' }) => (
  <div className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Saturn ERP">
    <svg viewBox="0 0 64 64" className="h-10 w-10 shrink-0" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="saturn-planet" x1="12" y1="10" x2="50" y2="55" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset=".55" stopColor="#5B4BE8" />
          <stop offset="1" stopColor="#168BDB" />
        </linearGradient>
        <linearGradient id="saturn-ring" x1="3" y1="22" x2="61" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset=".55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="31" r="17" fill="url(#saturn-planet)" />
      <path d="M5 37.5C17 23.5 46 18.5 59 28.5C49 42.5 19 49 5 37.5Z" fill="none" stroke="url(#saturn-ring)" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M7 39.5C20 46 43 43 57 31.5" fill="none" stroke="#A5B4FC" strokeWidth="1.5" strokeLinecap="round" opacity=".9" />
      <path d="M47 8.5L49 13.5L54 15.5L49 17.5L47 22.5L45 17.5L40 15.5L45 13.5L47 8.5Z" fill="#8B5CF6" />
      <circle cx="14" cy="17" r="1.8" fill="#38BDF8" />
    </svg>
    {!compact && (
      <span className={`whitespace-nowrap text-[1.05rem] font-extrabold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
        Saturn<span className="text-violet-600">ERP</span>
      </span>
    )}
  </div>
);
