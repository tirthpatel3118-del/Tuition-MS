import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthFrame } from './AuthPages';

export function InvitationAcceptancePage() {
  const { acceptInvitation, email, signOut } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const accept = async () => {
    setBusy(true); setError('');
    try { await acceptInvitation(token); navigate('/', { replace: true }); }
    catch (acceptError) { setError(acceptError instanceof Error ? acceptError.message : 'This invitation could not be accepted.'); }
    finally { setBusy(false); }
  };

  return <AuthFrame title="Join an institute" description={`Signed in as ${email ?? 'your account'}. The invitation must match this email address.`}>
    {!token ? <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">This invitation link is missing its token.</p> : <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">Accepting adds this account to the institute with the role assigned by its owner.</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
      <button onClick={() => void accept()} disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? 'Accepting invitation…' : 'Accept invitation'}</button>
    </div>}
    <button onClick={() => void signOut()} className="mt-5 w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">Sign out and use another account</button>
  </AuthFrame>;
}

