import React from 'react';

type BrandLogoProps = { compact?: boolean; light?: boolean; className?: string };

export function BrandLogo({ compact = false, light = false, className = '' }: BrandLogoProps) {
  const size = compact ? 'h-10 w-10' : 'h-12 w-12';
  const bg = light ? 'transparent' : '#4B001B';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl ${size} ${className}`} style={{ backgroundColor: bg }} aria-label="Saturn ERP logo">
      <svg viewBox="0 0 512 512" role="img" aria-hidden="true" className="h-full w-full">
        <defs>
          <linearGradient id="saturn-orb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFF8FB"/><stop offset=".42" stopColor="#E9A8BB"/><stop offset="1" stopColor="#A10F45"/>
          </linearGradient>
          <linearGradient id="saturn-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFFFFF"/><stop offset="1" stopColor="#F5DCE6"/>
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="72" fill={bg}/>
        <path d="M147 294C112 207 153 105 246 83c88-21 164 34 179 117-43 69-134 117-278 94Z" fill="url(#saturn-orb)"/>
        <path d="M83 275c79-85 267-147 363-102-40 13-87 33-127 58-82 51-163 92-236 100-22 2-31-25 0-56Z" fill="none" stroke="url(#saturn-ring)" strokeWidth="29" strokeLinecap="round"/>
        <path d="M100 356c55-49 119-73 177-67 54 5 99 32 138 77l-24 42c-37-38-77-56-117-56-43 0-85 20-126 58l-48-54Z" fill="#FFFFFF"/>
        <path d="M112 392c50-32 105-48 164-48 58 0 111 17 159 52l-29 29c-39-27-82-41-130-41-49 0-96 14-140 43l-24-35Z" fill="#F7E8EE"/>
        <path d="M256 350v111" stroke="#FFFFFF" strokeWidth="18" strokeLinecap="round"/>
        <path d="M394 42l15 38 38 15-38 15-15 38-15-38-38-15 38-15z" fill="#FFFFFF"/>
      </svg>
    </span>
  );
}
