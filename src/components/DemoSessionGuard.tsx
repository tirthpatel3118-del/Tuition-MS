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
      try {
        const token = getDemoSessionToken();
        const result = await validateDemoSession(token);
        if (!active) return;
        if (!result.valid || !result.expiresAt) {
          expire();
          return;
        }
        setExpiresAt(new Date(result.expiresAt).getTime());
        setError('');
        setReady(true);
      } catch (value) {
        if (!active) return;
        setError(value instanceof Error ? value.message : 'Your demo session could not be verified.');
        expire();
      } finally {
        validating = false;
      }
    };

    void verify();
    const interval = window.setInterval(() => { void verify(); }, 25_000);
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
    if (!expiresAt) return;
    const tick = () => {
      const next = expiresAt - Date.now();
      setRemaining(formatRemaining(next));
      if (next <= 0) {
        clearDemoSession();
        navigate('/demo-expired', { replace: true });
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, navigate]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF7F8] px-4">
        <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#6B1F38]" />
          <h1 className="mt-4 text-lg font-bold text-slate-900">Verifying demo access</h1>
          <p role="status" className="mt-2 text-sm leading-6 text-slate-600">{error || 'Checking your active invitation with the ClassBandhu server…'}</p>
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
