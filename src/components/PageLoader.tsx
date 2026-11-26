import React from 'react';
import { useData } from '../context/DataContext';
import { ClassBandhuMark } from './ClassBandhuMark';

export const PageLoader: React.FC = () => {
  const { settings } = useData();
  return (
    <div role="status" aria-live="polite" className="flex min-h-[400px] w-full flex-col items-center justify-center p-8 text-center select-none animate-fade-in">
      <ClassBandhuMark className="h-16 w-16 text-[#6B1F38]" />
      <div className="relative mt-5 flex h-11 w-11 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-[4px] border-[#F1DCE4] border-t-[#8B2145]" />
        <div className="h-1.5 w-1.5 rounded-full bg-[#8B2145]" />
      </div>
      <h3 className="mt-4 text-sm font-bold tracking-tight text-[#6B1F38]">Loading {settings?.instituteName || 'ClassBandhu'}</h3>
      <p className="mt-1 text-xs text-slate-500">Preparing your institute workspace...</p>
    </div>
  );
};
