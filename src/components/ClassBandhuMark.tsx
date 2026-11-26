import React from 'react';

export function ClassBandhuMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label="ClassBandhu logo" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="20" fill="#6B1F38" stroke="#D8B3C2" strokeOpacity=".35" strokeWidth="1" />
      <g fill="none" stroke="#FFF9F3" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="50" cy="39" r="25" />
        <path d="M50 14 C38 26 38 52 50 64 M50 14 C62 26 62 52 50 64" />
        <path d="M27 30 C39 38 61 38 73 30 M25 47 C39 54 61 54 75 47" />
        <path d="M11 50 C27 72 68 62 84 33" strokeWidth="5" />
        <path d="M12 71 C26 66 39 69 50 77 C61 69 74 66 88 71 V88 C74 84 61 86 50 94 C39 86 26 84 12 88 Z" strokeWidth="3.2" />
        <path d="M50 77 V94" strokeWidth="2.6" />
      </g>
      <circle cx="84" cy="32" r="4.5" fill="#FFF9F3" />
    </svg>
  );
}
