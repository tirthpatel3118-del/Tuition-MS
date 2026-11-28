import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import {
  activateDemoInvitation,
  clearDemoSession,
  getDemoSessionToken,
  validateDemoSession,
} from '../services/demoAccessClient';
import { ClassBandhuMark } from '../components/ClassBandhuMark';

const marketingSiteUrl = window.location.hostname.startsWith('development--')
  ? 'https://development.classbandhu-website.pages.dev'
  : 'https://classbandhu-website.pages.dev';

export function DemoAccessPage() {
  const [message, setMessage] = useState('Verifying your private demo invitation…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const token = new URLSearchParams(window.location.search).get('token') ?? '';

    const openDemo = async () => {
      try {
        const existingSession = getDemoSessionToken();
        if (existingSession) {
          const validation = await validateDemoSession(existingSession);
          if (!validation.valid) {
            clearDemoSession();
            throw new Error('This demo session has expired or been revoked. Please request a new invitation.');
          }
        } else {
          if (!/^[a-f0-9]{64}$/i.test(token)) {
            throw new Error('This invitation link is incomplete or invalid.');
          }
          await activateDemoInvitation(token);
        }
        if (active) {
          setMessage('Access approved. Opening the temporary ClassBandhu workspace…');
          window.location.replace('/?demo=1');
        }
      } catch (value) {
        if (!active) return;
        clearDemoSession();
        setFailed(true);
        setMessage(value instanceof Error ? value.message : 'This demo invitation could not be verified.');
      }
    };

    void openDemo();
    return () => { active = false; };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF7F8] px-4 py-10 text-slate-800">
      <section className="w-full max-w-lg rounded-3xl border border-[#E5DDE0] bg-white p-7 text-center shadow-sm sm:p-9">
        <ClassBandhuMark className="mx-auto h-14 w-14 text-[#790D3D]" />
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#A03B5E]">Private interactive demo</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">ClassBandhu Demo Access</h1>
        <div className="mt-5 flex items-center justify-center gap-2 text-sm leading-6 text-slate-600">
          {!failed && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#6B1F38]" />}
          {failed && <ShieldCheck className="h-5 w-5 text-rose-600" />}
          <span>{message}</span>
        </div>
        {failed && (
          <div className="mt-6 space-y-3">
            <a href={marketingSiteUrl} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6B1F38] px-4 py-3 text-sm font-semibold text-white">
              Request another demo <ArrowRight className="h-4 w-4" />
            </a>
            <Link to="/request-demo" className="block text-sm font-semibold text-[#6B1F38] hover:underline">More about demo access</Link>
          </div>
        )}
        <p className="mt-7 text-xs leading-5 text-slate-500">A valid invitation starts a 20-minute session. Your session is checked by the server and can be revoked by ClassBandhu administration.</p>
      </section>
    </main>
  );
}

export function DemoExpiredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF7F8] px-4 py-10 text-slate-800">
      <section className="w-full max-w-lg rounded-3xl border border-[#E5DDE0] bg-white p-7 text-center shadow-sm sm:p-9">
        <ClassBandhuMark className="mx-auto h-14 w-14 text-[#790D3D]" />
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#A03B5E]">Demo session ended</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Your demo access is no longer active.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">The invitation may have expired, the 20-minute session may have ended, or an administrator may have revoked access. Request a new invitation to explore ClassBandhu again.</p>
        <a href="https://classbandhu-website.pages.dev/#demo" className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6B1F38] px-4 py-3 text-sm font-semibold text-white">Request another demo <ArrowRight className="h-4 w-4" /></a>
        <a href="mailto:info.classbandhu@gmail.com?subject=ClassBandhu%20demo%20access" className="mt-4 inline-block text-sm font-semibold text-[#6B1F38] hover:underline">Contact ClassBandhu</a>
      </section>
    </main>
  );
}
