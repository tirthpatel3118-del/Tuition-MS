import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

function AuthFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 flex items-center justify-center">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">E</div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">EduLedger</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}

export function AuthLoading({ message = 'Checking your secure workspace…' }: { message?: string }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        <p className="text-sm font-medium text-slate-600">{message}</p>
      </div>
    </main>
  );
}

export function AuthPage() {
  const { signIn, signUp, error: authError } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setFormError('');
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else {
        const needsConfirmation = await signUp(email, password, fullName);
        if (needsConfirmation) setMessage('Check your email to confirm your account, then return here to sign in.');
      }
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Unable to complete sign-in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title={mode === 'sign-in' ? 'Welcome back' : 'Create your owner account'}
      description={mode === 'sign-in' ? 'Sign in to manage your institute records.' : 'Create an account to set up your tuition institute.'}
    >
      <form className="space-y-4" onSubmit={submit}>
        {mode === 'sign-up' && (
          <label className="block text-sm font-semibold text-slate-700">
            Full name
            <input required autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </label>
        )}
        <label className="block text-sm font-semibold text-slate-700">
          Email address
          <input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Password
          <input required minLength={8} type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
        </label>
        {(formError || authError) && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{formError || authError}</p>}
        {message && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{message}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        {mode === 'sign-in' ? 'New to EduLedger?' : 'Already have an account?'}{' '}
        <button type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setFormError(''); setMessage(''); }} className="font-semibold text-blue-600 hover:text-blue-700">
          {mode === 'sign-in' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </AuthFrame>
  );
}

export function CreateInstitutePage() {
  const { createInstitute, signOut, email, error: authError } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const updateName = (value: string) => {
    setName(value);
    if (!slugEdited) setSlug(value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createInstitute(name, slug);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the institute.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Set up your institute" description={`Signed in as ${email ?? 'your account'}. Add your institute details to continue.`}>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm font-semibold text-slate-700">
          Institute name
          <input required minLength={2} value={name} onChange={event => updateName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Workspace address
          <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
            <span className="pl-3.5 text-sm text-slate-400">eduledger/</span>
            <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={event => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()); }} className="min-w-0 flex-1 rounded-r-xl px-2 py-3 font-normal outline-none" />
          </div>
          <span className="mt-1 block text-xs font-normal text-slate-400">Lowercase letters, numbers, and hyphens.</span>
        </label>
        {(error || authError) && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error || authError}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
          {busy ? 'Creating workspace…' : 'Create institute'}
        </button>
      </form>
      <button onClick={() => void signOut()} className="mt-5 w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">Sign out</button>
    </AuthFrame>
  );
}

export function SelectInstitutePage() {
  const { memberships, selectInstitute, signOut, email } = useAuth();
  return (
    <AuthFrame title="Choose an institute" description={`Select the workspace you want to open${email ? `, ${email}` : ''}.`}>
      <div className="space-y-3">
        {memberships.map(membership => (
          <button key={membership.instituteId} onClick={() => selectInstitute(membership.instituteId)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left hover:border-blue-300 hover:bg-blue-50/40">
            <span>
              <span className="block font-semibold text-slate-800">{membership.instituteName}</span>
              <span className="mt-1 block text-xs capitalize text-slate-500">{membership.role}</span>
            </span>
            <span className="text-blue-600">Open →</span>
          </button>
        ))}
      </div>
      <button onClick={() => void signOut()} className="mt-5 w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">Sign out</button>
    </AuthFrame>
  );
}

