import React from 'react';

export function EduLedgerMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      {/* Graduation cap */}
      <path d="M5 19.5L32 7.5L59 19.5L32 31.5L5 19.5Z" fill="currentColor" />
      <path d="M18 26.5C22.5 23.8 27.5 22.5 32 22.5C36.5 22.5 41.5 23.8 46 26.5V35C41.3 32.4 36.6 31.2 32 31.2C27.4 31.2 22.7 32.4 18 35V26.5Z" fill="currentColor" />
      <path d="M58.5 20V35" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="58.5" cy="38" r="2.2" fill="currentColor" />
      {/* Open book */}
      <path d="M6.5 40.5C15 35.8 23.6 36.2 31 41.2V56C22.6 50.5 14.5 50.2 6.5 55V40.5Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M57.5 40.5C49 35.8 40.4 36.2 33 41.2V56C41.4 50.5 49.5 50.2 57.5 55V40.5Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M32 41V56" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M11 43.5C17 41 22.5 41.5 27.5 44.5M53 43.5C47 41 41.5 41.5 36.5 44.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
