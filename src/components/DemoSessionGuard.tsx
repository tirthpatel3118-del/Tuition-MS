import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearDemoSession, getDemoSessionToken, validateDemoSession } from '../services/demoAccessClient';

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes.toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0');
}

export function DemoSessionGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState('--:--');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let active = true;
    let validating = false;

    const expire = () => {
      clearDemoSession();
      if (active) navigate('/demo-expired', { replace: true });
    };

    const verify = async () => {
      if (!active || validating) return;
      validating = true;
      setVerifying(true);
      try {
        const token = getDemoSessionToken();
        if (!token) {
          expire();
          return;
        }
        const result = await validateDemoSession(token);
        if (!active) return;
        if (!result.valid || !result.expiresAt || Date.parse(result.expiresAt) <= Date.now()) {
          expire();
          return;
        }
        setExpiresAt(Date.parse(result.expiresAt));
        setError('');
        setReady(true);
      } catch (value) {
        if (!active) return;
        // Fail closed: hide ERP content while the server is unreachable, but retain
        // the session token to let the visitor retry after a transient outage.
        setReady(false);
        setError(value instanceof Error ? value.message : 'The demo session could not be verified.');
      } finally {
        validating = false;
        if (active) setVerifying(false);
      }
    };

    void verify();
    const interval = window.setInterval(() => { void verify(); }, 10_000);
    const onFocus = () => { if (document.visibilityState === 'visible') void verify(); };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [navigate]);

  useEffect(() => {
    if (!expiresAt || !ready) return;
    const tick = () => {
      const next = expiresAt - Date.now();
      setRemaining(formatRemaining(next));
      if (next <= 0) setReady(false);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, ready]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF7F8] px-4">
        <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#6B1F38]" />
          <h1 className="mt-4 text-lg font-bold text-slate-900">{error ? 'Demo session locked' : 'Verifying demo access'}</h1>
          <p role={error ? 'alert' : 'status'} className="mt-2 text-sm leading-6 text-slate-600">{error || 'Checking your active invitation with the ClassBandhu server…'}</p>
          {error && <button type="button" disabled={verifying} onClick={() => window.dispatchEvent(new Event('focus'))} className="mt-5 min-h-10 rounded-xl bg-[#6B1F38] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{verifying ? 'Verifying…' : 'Retry verification'}</button>}
        </section>
      </main>
    );
  }

  return (
    <div>
      <div role="status" className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-950">
        <span>Approved browser-only demo</span>
        <span aria-hidden="true">·</span>
        <span>Time remaining: <strong className="tabular-nums">{remaining}</strong></span>
        <span>Edits reset on refresh. No institute database is connected.</span>
      </div>
      {children}
    </div>
  );
}
