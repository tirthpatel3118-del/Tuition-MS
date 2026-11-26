import React from 'react';
import { ClassBandhuMark } from './ClassBandhuMark';
import { APP_VERSION } from '../lib/appVersion';

export function BrandLoading({ message = 'Preparing your institute workspace...' }: { message?: string }) {
  return (
    <main className="flex min-h-screen flex-col bg-[linear-gradient(145deg,#fff_0%,#FCF7F8_58%,#F5E9ED_100%)] px-5 py-8 text-[#35101F]">
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex items-center gap-4">
          <ClassBandhuMark className="h-[76px] w-[76px] text-[#6B1F38] sm:h-24 sm:w-24" />
          <div className="border-l border-[#D9C3CB] pl-4 text-left">
            <h1 className="text-3xl font-bold tracking-tight text-[#35101F] sm:text-4xl">ClassBandhu</h1>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8B5368] sm:text-xs">Tuition Management System</p>
          </div>
        </div>
        <div className="relative mt-16 flex h-[68px] w-[68px] items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-[6px] border-[#F1DCE4] border-t-[#8B2145]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#8B2145]" />
        </div>
        <h2 className="mt-6 text-xl font-bold tracking-tight text-[#6B1F38] sm:text-2xl">Loading ClassBandhu</h2>
        <p className="mt-2 max-w-md text-sm text-slate-500 sm:text-base">{message}</p>
      </section>
      <footer className="mx-auto w-full max-w-5xl border-t border-[#E5DDE0] pt-5">
        <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <ClassBandhuMark className="h-10 w-10 text-[#6B1F38]" />
            <div>
              <p className="text-sm font-bold text-[#6B1F38]">ClassBandhu</p>
              <p className="text-xs text-slate-500">Tuition Management Platform</p>
            </div>
          </div>
          <p className="text-xs italic text-slate-500">Empowering Every Classroom.</p>
        </div>
        <div className="mt-4 flex flex-col items-center justify-between gap-2 border-t border-[#E5DDE0] pt-3 text-xs text-slate-500 sm:flex-row">
          <span>© 2026 ClassBandhu. All rights reserved.</span>
          <span className="rounded-full bg-[#F1E7EB] px-3 py-1 font-medium text-[#6B1F38]">v{APP_VERSION}</span>
        </div>
      </footer>
    </main>
  );
}
