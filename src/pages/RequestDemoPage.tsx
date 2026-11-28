import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw, ShieldCheck, Users, WalletCards } from 'lucide-react';
import { ClassBandhuMark } from '../components/ClassBandhuMark';

const marketingSiteUrl = window.location.hostname.startsWith('development--')
  ? 'https://development.classbandhu-website.pages.dev'
  : 'https://classbandhu-website.pages.dev';

export function RequestDemoPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F8] px-4 py-8 text-slate-800 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <ClassBandhuMark className="h-12 w-12 text-[#790D3D]" />
            <span>
              <span className="block text-lg font-bold tracking-tight text-[#790D3D]">ClassBandhu</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8B5368]">Tuition Management System</span>
            </span>
          </Link>
          <Link to="/" className="text-sm font-semibold text-[#6B1F38] hover:underline">Sign in</Link>
        </header>

        <section className="mt-10 overflow-hidden rounded-3xl border border-[#E5DDE0] bg-white shadow-sm">
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A03B5E]">Interactive product demo</p>
              <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Explore the ClassBandhu ERP yourself.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                ClassBandhu provides a private, time-limited ERP demonstration after reviewing your request. Submit the demo form on our website; approved visitors receive a unique invitation link by email.
              </p>
              <a href={marketingSiteUrl + '/#demo'} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#6B1F38] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#57172D]">\n                Request a private demo <ArrowRight className="h-4 w-4" />
              </a>
              <p className="mt-3 text-xs leading-5 text-slate-500">Submit a request on our website. After review, approved visitors receive a unique invitation that opens a 20-minute demo.</p>
            </div>

            <div className="rounded-2xl bg-[#FAF7F8] p-5 sm:p-6">
              <p className="text-sm font-bold text-slate-900">What you can try</p>
              <div className="mt-4 space-y-4">
                <div className="flex gap-3">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-[#790D3D]" />
                  <div><p className="text-sm font-semibold">Admissions</p><p className="mt-1 text-xs leading-5 text-slate-600">Add and edit sample students, assign courses and batches.</p></div>
                </div>
                <div className="flex gap-3">
                  <WalletCards className="mt-0.5 h-5 w-5 shrink-0 text-[#790D3D]" />
                  <div><p className="text-sm font-semibold">Fees and receipts</p><p className="mt-1 text-xs leading-5 text-slate-600">Record pretend payments, see balances and preview receipts.</p></div>
                </div>
                <div className="flex gap-3">
                  <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-[#790D3D]" />
                  <div><p className="text-sm font-semibold">Temporary changes</p><p className="mt-1 text-xs leading-5 text-slate-600">Try freely. Refreshing the page restores the original sample data.</p></div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-[#E5DDE0] bg-[#FCFAFB] p-6 sm:grid-cols-3 sm:p-8">
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" />
              <div><p className="text-xs font-semibold text-slate-800">Server-validated access</p><p className="mt-1 text-xs leading-5 text-slate-500">The invitation is checked by the ClassBandhu server before the demo opens.</p></div>
            </div>
            <div className="flex gap-3">
              <RefreshCw className="h-5 w-5 shrink-0 text-[#790D3D]" />
              <div><p className="text-xs font-semibold text-slate-800">Clears on refresh</p><p className="mt-1 text-xs leading-5 text-slate-500">Edits exist in memory only and disappear after a reload or when the tab closes.</p></div>
            </div>
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#790D3D]" />
              <div><p className="text-xs font-semibold text-slate-800">Sample use only</p><p className="mt-1 text-xs leading-5 text-slate-500">Use fictional names and figures. Do not enter real student or parent information.</p></div>
            </div>
          </div>
        </section>

        <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
          <Link to="/terms" className="hover:text-[#6B1F38]">Terms</Link>
          <Link to="/privacy" className="hover:text-[#6B1F38]">Privacy</Link>
          <a href="mailto:info.classbandhu@gmail.com?subject=ClassBandhu%20Guided%20Demo" className="hover:text-[#6B1F38]">Request a guided demo</a>
        </footer>
      </div>
    </main>
  );
}
