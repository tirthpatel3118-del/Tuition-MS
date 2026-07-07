import React from 'react';
import { useData } from '../context/DataContext';

export const PageLoader: React.FC = () => {
  const { settings } = useData();
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full p-10 select-none animate-fade-in">
      <div className="relative flex items-center justify-center">
        {/* Animated Spin Ring */}
        <div className="w-14 h-14 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
        {/* Small Center Dot */}
        <div className="absolute w-2 h-2 bg-blue-600 rounded-full"></div>
      </div>
      <h3 className="text-slate-700 text-xs font-bold uppercase tracking-widest mt-4">Loading {settings?.instituteName || 'EduLedger'}</h3>
      <p className="text-[10px] text-slate-400 font-semibold mt-1">Retrieving database state...</p>
    </div>
  );
};
