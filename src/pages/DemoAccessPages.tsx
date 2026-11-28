import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { activateDemoInvitation, clearDemoSession } from '../services/demoAccessClient';
import { ClassBandhuMark } from '../components/ClassBandhuMark';

const marketingSiteUrl = window.location.hostname.startsWith('development--')
  ? 'https://development.classbandhu-website.pages.dev'
  : 'https://classbandhu-website.pages.dev';

export function DemoAccessPage() {
  const invitationToken = useRef(new URLSearchParams(window.location.search).get('token') ?? '');
  const [message, setMessage] = useState('Verifying your private demo invitation…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    // Strip the one-time token from browser history immediately, including on refresh.
    window.history.replaceState(null, '', window.location.pathname);

    void activateDemoInvitation(invitationToken.current).then(() => {
      if (active) {
        setMessage('Access approved. Opening your temporary ClassBandhu workspace…');
        // A fresh load reads the server-activated session marker before mounting ERP auth.
        window.location.replace('/');
      }
    }).catch((value: unknown) => {
      if (!active) return;
      clearDemoSession();
      setFailed(true);
      setMessage(value instanceof Error ? value.message : 'This demo invitation could not be verified.');
    });

    return () => { active = false; };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF7F8] px-4 py-10 text-slate-800">
      <section className="w-full max-w-lg rounded-3xl border border-[#E5DDE0] bg-white p-7 text-center shadow-sm sm:p-9">
        <ClassBandhuMark className="mx-auto h-14 w-14 text-[#790D3D]" />
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#A03B5E]">Private interactive demo</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{failed ? 'Demo access unavailable' : 'ClassBandhu Demo Access'}</h1>
        <div className="mt-5 flex items-center justify-center gap-2 text-sm leading-6 text-slate-600">
          {!failed && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#6B1F38]" />}
          {failed && <ShieldCheck className="h-5 w-5 text-rose-600" />}
          <span role={failed ? 'alert' : 'status'}>{message}</span>
        </div>
        {failed && (
          <div className="mt-6 space-y-3">
            <a href={marketingSiteUrl + '/#demo'} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6B1F38] px-4 py-3 text-sm font-semibold text-white">
              Request another demo <ArrowRight className="h-4 w-4" />
            </a>
            <Link to="/request-demo" className="block text-sm font-semibold text-[#6B1F38] hover:underline">More about demo access</Link>
          </div>
        )}
        <p className="mt-7 text-xs leading-5 text-slate-500">A valid invitation starts a 20-minute session. The server controls expiry and can revoke access. The same browser can reopen its active session.</p>
      </section>
    </main>
  );
}

export function DemoExpiredPage() {
  useEffect(() => { clearDemoSession(); }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF7F8] px-4 py-10 text-slate-800">
      <section className="w-full max-w-lg rounded-3xl border border-[#E5DDE0] bg-white p-7 text-center shadow-sm sm:p-9">
        <ClassBandhuMark className="mx-auto h-14 w-14 text-[#790D3D]" />
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#A03B5E]">Demo session ended</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Your demo access is no longer active.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">The invitation may have expired, the 20-minute session may have ended, or an administrator may have revoked access. Request a new invitation to explore ClassBandhu again.</p>
        <a href={marketingSiteUrl + '/#demo'} className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6B1F38] px-4 py-3 text-sm font-semibold text-white">Request another demo <ArrowRight className="h-4 w-4" /></a>
        <a href="mailto:info.classbandhu@gmail.com?subject=ClassBandhu%20demo%20access" className="mt-4 inline-block text-sm font-semibold text-[#6B1F38] hover:underline">Contact ClassBandhu</a>
      </section>
    </main>
  );
}
