import React from 'react';

export const PageLoader: React.FC = () => (
  <div role="status" aria-live="polite" className="flex min-h-[240px] w-full flex-col items-center justify-center p-8 text-center select-none">
    <div className="relative flex h-10 w-10 items-center justify-center">
      <div className="absolute inset-0 animate-spin rounded-full border-[4px] border-[#F1DCE4] border-t-[#8B2145]" />
      <div className="h-1.5 w-1.5 rounded-full bg-[#8B2145]" />
    </div>
    <p className="mt-4 text-sm font-medium text-slate-500">Loading workspace...</p>
  </div>
);
