import React, { useId } from 'react';

interface BrandLogoProps {
  compact?: boolean;
  light?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false, light = false, className = '' }) => {
  const gradientId = useId().replace(/:/g, '');
  const planetGradient = `saturn-planet-${gradientId}`;
  const ringGradient = `saturn-ring-${gradientId}`;

  return (
    <div className={`inline-flex min-w-0 items-center gap-2.5 ${className}`} aria-label="Saturn ERP">
      <svg viewBox="0 0 72 72" className="h-10 w-10 shrink-0" role="img" aria-hidden="true">
        <defs>
          <linearGradient id={planetGradient} x1="12" y1="9" x2="55" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" />
            <stop offset=".42" stopColor="#6545E8" />
            <stop offset="1" stopColor="#35105F" />
          </linearGradient>
          <linearGradient id={ringGradient} x1="3" y1="25" x2="68" y2="47" gradientUnits="userSpaceOnUse">
            <stop stopColor="#06B6D4" />
            <stop offset=".48" stopColor="#7650F2" />
            <stop offset="1" stopColor="#A855F7" />
          </linearGradient>
        </defs>
        {/* Rear orbit and planet: Saturn grows out of the open book. */}
        <path d="M5 39C19 20 51 15 67 28" fill="none" stroke={ringGradient} strokeWidth="5.2" strokeLinecap="round" />
        <path d="M36 10C49 10 59 20 59 32C59 43 49 51 36 51C23 51 13 43 13 32C13 20 23 10 36 10Z" fill={`url(#${planetGradient})`} />
        <path d="M4 40C20 49 51 48 68 30" fill="none" stroke={ringGradient} strokeWidth="5.2" strokeLinecap="round" />
        {/* Open pages form the base of the planet. */}
        <path d="M10 44C20 39 29 41 36 48C43 41 52 39 62 44V59C52 55 43 56 36 64C29 56 20 55 10 59V44Z" fill="#FFFFFF" stroke="#4C1D75" strokeWidth="2" strokeLinejoin="round" />
        <path d="M36 48V63M13 48C22 45 29 47 36 53M59 48C50 45 43 47 36 53" fill="none" stroke="#B9A4F4" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M53 5L55 10L60 12L55 14L53 19L51 14L46 12L51 10L53 5Z" fill="#8B5CF6" />
      </svg>
      {!compact && (
        <span className={`whitespace-nowrap text-[1.05rem] font-extrabold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
          Saturn<span className="text-rose-700"> ERP</span>
        </span>
      )}
    </div>
  );
};
