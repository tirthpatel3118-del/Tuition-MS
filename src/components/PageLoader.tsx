import React from 'react';
import { BrandLogo } from './BrandLogo';

export const PageLoader: React.FC = () => {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[400px] w-full select-none flex-col items-center justify-center p-8 text-center animate-fade-in">
      <BrandLogo className="mb-7" />
      <div className="relative mb-5 h-9 w-9" aria-hidden="true">
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#E8D5DC] border-t-[#6B1F38]" />
        <div className="absolute inset-[13px] rounded-full bg-[#A03B5E]" />
      </div>
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#6B1F38]">Saturn ERP</h3>
      <p className="mt-2 text-xs font-medium text-slate-500">Preparing your institute workspace…</p>
    </div>
  );
};
