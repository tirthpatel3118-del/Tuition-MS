import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ClassBandhuMark } from '../components/ClassBandhuMark';
import { PWAControls } from '../components/PWAControls';
import { BrandLoading } from '../components/BrandLoading';
import { getPublishedLegalDocument, getPublishedRequiredLegalDocuments, type RequiredLegalDocument } from '../services/legalService';
import { LegalPolicyConsentText } from './LegalPages';

export function AuthFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FAF7F8] px-4 py-10">
      <section className="relative w-full max-w-md rounded-2xl border border-[#E5DDE0] bg-white p-6 shadow-[0_18px_60px_-36px_rgba(72,25,43,0.28)] sm:p-8">
        <div className="mb-8">
          <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-3 h-14 w-14">
                <ClassBandhuMark className="h-14 w-14" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A03B5E]">ClassBandhu</p>
              <p className="mt-1 text-[10px] font-medium text-[#8B5368]">Empowering Every Classroom.</p>
            </div>
            <PWAControls />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {children}
        <nav aria-label="Legal" className="mt-8 flex justify-center gap-4 border-t border-slate-100 pt-5 text-xs text-slate-500">
          <Link to="/privacy" className="hover:text-[#6B1F38]">Privacy policy</Link>
          <Link to="/terms" className="hover:text-[#6B1F38]">Terms &amp; Conditions</Link>
          <Link to="/acceptable-use" className="hover:text-[#6B1F38]">Acceptable Use</Link>
        </nav>
      </section>
    </main>
  );
}

export function AuthLoading({ message = 'Preparing your institute workspace...' }: { message?: string }) {
  return <BrandLoading message={message} />;
}

export function AuthPage() {
  const { signIn, signUp, error: authError } = useAuth();
  const location = useLocation();
  const invitationToken = location.pathname === '/accept-invitation'
    ? (new URLSearchParams(location.hash.replace(/^#/, '')).get('token') ?? new URLSearchParams(location.search).get('token') ?? '')
    : '';
  const invitationFlow = Boolean(invitationToken);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(invitationFlow ? 'sign-up' : 'sign-in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [legalDocuments, setLegalDocuments] = useState<RequiredLegalDocument[]>([]);
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalLoadError, setLegalLoadError] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [productUpdates, setProductUpdates] = useState(false);

  useEffect(() => {
    if (mode !== 'sign-up') return;
    let active = true;
    setLegalLoading(true);
    setLegalLoadError('');
    void getPublishedRequiredLegalDocuments()
      .then(documents => { if (active) setLegalDocuments(documents); })
      .catch(error => { if (active) setLegalLoadError(error instanceof Error ? error.message : 'Legal documents could not be loaded.'); })
      .finally(() => { if (active) setLegalLoading(false); });
    return () => { active = false; };
  }, [mode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setFormError('');
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else {
        if (!invitationToken) throw new Error('A valid institute invitation link is required to create an account.');
        const terms = legalDocuments.find(document => document.slug === 'terms-of-service');
        const aup = legalDocuments.find(document => document.slug === 'acceptable-use-policy');
        const privacy = legalDocuments.find(document => document.slug === 'privacy-policy');
        if (!terms || !aup || !privacy) throw new Error('Account creation is unavailable until the current Terms, Acceptable Use Policy and Privacy Policy are published.');
        if (!acceptedLegal) throw new Error('Please agree to the Terms and AUP, and acknowledge the Privacy Policy, to continue.');
        const needsConfirmation = await signUp(email, password, fullName, invitationToken, {
          termsDocumentId: terms.id,
          aupDocumentId: aup.id,
          privacyDocumentId: privacy.id,
          productUpdates,
          userAgent: navigator.userAgent,
        });
        if (needsConfirmation) setMessage('Check your email to confirm your account, then reopen the original invitation link.');
      }
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Unable to complete this request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title={mode === 'sign-in' ? 'Welcome back' : 'Create your invited account'}
      description={mode === 'sign-in'
        ? (invitationFlow ? 'Sign in using the email address that received this institute invitation.' : 'Sign in to your institute workspace.')
        : 'Use the email address that received this invitation and choose your own password.'}
    >
      <form className="space-y-4" onSubmit={submit}>
        {mode === 'sign-up' && (
          <label className="block text-sm font-semibold text-slate-700">
            Full name
            <input required autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-[#A03B5E] focus:ring-4 focus:ring-[#F8E9ED]" />
          </label>
        )}
        <label className="block text-sm font-semibold text-slate-700">
          Email address
          <input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-[#A03B5E] focus:ring-4 focus:ring-[#F8E9ED]" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Password
          <div className="relative mt-1.5"><input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 pr-12 font-normal outline-none focus:border-[#A03B5E] focus:ring-4 focus:ring-[#F8E9ED]" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 hover:text-[#6B1F38]">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
        </label>
        {mode === 'sign-up' && (
          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-bold text-slate-900">Legal documents</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Review the current versions before creating your account.</p>
            </div>
            {legalLoading && <p className="text-xs text-slate-500">Loading published policies…</p>}
            {!legalLoading && legalDocuments.length < 3 && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Signup is temporarily unavailable until the current Terms, AUP and Privacy Policy are published by the ClassBandhu administrator.</p>}
            {legalLoadError && <p role="alert" className="text-xs text-red-700">{legalLoadError}</p>}
            {legalDocuments.some(document => document.is_test_only) && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-800">Development test documents are active. This signup is for staging tests only, not production use.</p>}
            {legalDocuments.length >= 3 && <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
              <input type="checkbox" checked={acceptedLegal} onChange={event => setAcceptedLegal(event.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-[#6B1F38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B1F38]" />
              <span><LegalPolicyConsentText /></span>
            </label>}
            <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-600">
              <input type="checkbox" checked={productUpdates} onChange={event => setProductUpdates(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#6B1F38]" />
              <span>Optional: Send me ClassBandhu product news and release updates by email. This is not required to use the service.</span>
            </label>
          </section>
        )}
        {(formError || authError) && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{formError || authError}</p>}
        {message && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{message}</p>}
        <button disabled={busy || (mode === 'sign-up' && (legalLoading || legalDocuments.length < 3 || !acceptedLegal))} className="w-full rounded-xl bg-[#6B1F38] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#57172D] disabled:cursor-wait disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      {invitationFlow ? (
        <p className="mt-6 text-center text-sm text-slate-500">
          {mode === 'sign-in' ? "New to ClassBandhu? Use your invitation to " : 'Already have an account? '}
          <button type="button" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} className="font-semibold text-blue-600 hover:text-[#6B1F38]">
            {mode === 'sign-in' ? 'create your account' : 'sign in'}
          </button>
        </p>
      ) : (
        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-center text-sm leading-6 text-slate-600">
          <p>Access is provided by invitation. Already part of an institute? Ask your institute owner for an invitation.</p>
          <p className="mt-2">Setting up a new institute or requesting a product demo? Email ClassBandhu at{" "}
            <a href="mailto:info.classbandhu@gmail.com?subject=ClassBandhu%20Institute%20Access%20or%20Demo%20Request" className="font-semibold text-[#6B1F38] underline underline-offset-2">info.classbandhu@gmail.com</a>.
          </p>
        </div>
      )}
      {mode === 'sign-in' && !invitationFlow && <p className="mt-3 text-center"><Link to="/forgot-password" className="text-sm font-semibold text-blue-600 hover:text-[#6B1F38]">Forgot your password?</Link></p>}
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await requestPasswordReset(email); setSent(true); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not send the recovery email. Please try again.'); }
    finally { setBusy(false); }
  };
  return <AuthFrame title="Reset your password" description="Enter your account email and we’ll send a secure password reset link.">
    {sent ? <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">If an account matches that email, a recovery link is on its way. Check your inbox and spam folder.</div> : <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-semibold text-slate-700">Email address<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-[#A03B5E] focus:ring-4 focus:ring-[#F8E9ED]" /></label>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-[#6B1F38] px-4 py-3 text-sm font-semibold text-white hover:bg-[#57172D] disabled:opacity-60">{busy ? 'Sending…' : 'Send reset link'}</button>
    </form>}
    <p className="mt-5 text-center text-sm"><Link to="/sign-in" className="font-semibold text-blue-600 hover:text-[#6B1F38]">Back to sign in</Link></p>
  </AuthFrame>;
}

export function PasswordResetPage() {
  const { session, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false); const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try { await updatePassword(password); setDone(true); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not update the password. Request a new reset link and try again.'); }
    finally { setBusy(false); }
  };
  if (!session) return <AuthFrame title="Reset link unavailable" description="This link may have expired or already been used. Request a new password reset link to continue."><Link to="/forgot-password" className="block w-full rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white">Request a new link</Link></AuthFrame>;
  if (done) return <AuthFrame title="Password updated" description="Your password has been changed. Sign in with your new password to continue."><button onClick={async () => { await signOut(); navigate('/sign-in', { replace: true }); }} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">Continue to sign in</button></AuthFrame>;
  return <AuthFrame title="Choose a new password" description="Use at least 8 characters for your new password."><form onSubmit={submit} className="space-y-4">
    <label className="block text-sm font-semibold text-slate-700">New password<div className="relative mt-1.5"><input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 pr-12 font-normal outline-none focus:border-[#A03B5E] focus:ring-4 focus:ring-[#F8E9ED]" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 hover:text-[#6B1F38]">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></label>
    <label className="block text-sm font-semibold text-slate-700">Confirm new password<div className="relative mt-1.5"><input required minLength={8} type={showConfirm ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 pr-12 font-normal outline-none focus:border-[#A03B5E] focus:ring-4 focus:ring-[#F8E9ED]" /><button type="button" onClick={() => setShowConfirm(value => !value)} aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 hover:text-[#6B1F38]">{showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></label>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Updating…' : 'Update password'}</button>
  </form></AuthFrame>;
}

export function PrivacyPolicyPage() {
  return <AuthFrame title="Privacy policy" description="How ClassBandhu handles information when you use the tuition management workspace.">
    <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-2 text-sm leading-6 text-slate-600">
      <p><strong>Last updated: November 4, 2026.</strong> This policy is a product disclosure draft. The institute operating ClassBandhu should publish its legal name and contact details before inviting real students.</p>
      <h2 className="font-bold text-slate-900">Information in the workspace</h2><p>Depending on enabled features, the service may hold account details, institute and staff records, student and guardian details, course enrolments, attendance, fee balances, payment entries, receipts, and reminder notes. Do not enter sensitive personal data that is not needed to run the institute.</p>
      <h2 className="font-bold text-slate-900">How information is used</h2><p>Workspace information is used to provide institute administration, display records to authorized users, maintain receipts and payment history, and support account security. Payments recorded in the app are administrative records; this does not itself process a card or bank transfer.</p>
      <h2 className="font-bold text-slate-900">Storage, access and security</h2><p>When connected, data is intended to be stored in the institute’s configured Supabase database with access controlled by account membership and database policies. The current deployment may be unconnected or use browser demo data. Final hosting, backup, retention, and security practices must be confirmed by the operator before production use.</p>
      <h2 className="font-bold text-slate-900">Sharing and retention</h2><p>We do not describe or promise specific third-party processing or retention periods here because the production hosting and operational configuration have not been verified. The institute administrator should set retention rules and explain any provider disclosures applicable to their deployment.</p>
      <h2 className="font-bold text-slate-900">Your choices and contact</h2><p>Ask your institute administrator to access, correct, export, or delete records held in its workspace. Account deletion and data deletion may be separate. Add the responsible institute’s contact details here before public launch.</p>
      <p>Questions about this policy should be directed to the institute operating this ClassBandhu workspace.</p>
    </div>
  </AuthFrame>;
}

export function TermsPage() {
  return <AuthFrame title="Terms of use" description="Rules for using the ClassBandhu tuition management workspace.">
    <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-2 text-sm leading-6 text-slate-600">
      <p><strong>Last updated: November 4, 2026.</strong> These terms are a draft for the institute operator to review and adopt with its legal and contact details before public use.</p>
      <h2 className="font-bold text-slate-900">Workspace access</h2><p>Use an account assigned to you and keep your credentials secure. Institute owners are responsible for inviting appropriate staff, assigning access, and removing access when it is no longer needed.</p>
      <h2 className="font-bold text-slate-900">Accurate records</h2><p>Keep student, attendance, fee, and payment records accurate. Verify financial entries against the institute’s source records. ClassBandhu is an administrative tool and does not replace accounting, tax, or legal advice.</p>
      <h2 className="font-bold text-slate-900">Acceptable use</h2><p>Do not access another institute’s information, misuse personal data, interfere with the service, or upload information you do not have authority to use. Follow applicable privacy and education requirements.</p>
      <h2 className="font-bold text-slate-900">Availability and data</h2><p>Availability, support, backups, export, and retention depend on the final deployment and are not guaranteed by this draft. Keep independent records until the operator has verified its backup and recovery process.</p>
      <h2 className="font-bold text-slate-900">Operator details</h2><p>The institute operating this workspace should add its legal identity, contact information, jurisdiction, and any service-specific commitments before accepting these terms.</p>
    </div>
  </AuthFrame>;
}

export function CreateInstitutePage() {
  const { createInstitute, signOut, email, error: authError } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [documents, setDocuments] = useState<RequiredLegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [bundleAccepted, setBundleAccepted] = useState(false);
  const [authorityAccepted, setAuthorityAccepted] = useState(false);
  const [dataAuthorityAccepted, setDataAuthorityAccepted] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const legalSlugs = ['terms-of-service', 'acceptable-use-policy', 'privacy-policy', 'data-processing-agreement'] as const;

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all(legalSlugs.map(item => getPublishedLegalDocument(item)))
      .then(items => {
        if (!active) return;
        const found = items.filter((item): item is RequiredLegalDocument => Boolean(item));
        setDocuments(found);
        if (found.length !== 4) setLoadError('The complete current Institute legal document bundle is not published. Workspace creation is unavailable.');
      })
      .catch(value => { if (active) setLoadError(value instanceof Error ? value.message : 'The current Institute legal documents could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const updateName = (value: string) => {
    setName(value);
    if (!slugEdited) setSlug(value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (documents.length !== 4 || !bundleAccepted || !authorityAccepted || !dataAuthorityAccepted) {
      setError('Review all current documents and complete exactly the three required Institute confirmations.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const documentIds = Object.fromEntries(documents.map(document => [document.slug, document.id]));
      await createInstitute(name, slug, documentIds, authorityAccepted, dataAuthorityAccepted);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not create the institute.');
    } finally {
      setBusy(false);
    }
  };

  const testOnly = documents.some(document => document.is_test_only);
  return (
    <AuthFrame title="Set up your institute" description={`Signed in as ${email ?? 'your account'}. Review the legal bundle and complete the three Institute confirmations.`}>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm font-semibold text-slate-700">
          Institute name
          <input required minLength={2} value={name} onChange={event => updateName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-[#A03B5E] focus:ring-4 focus:ring-[#F8E9ED]" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Workspace address
          <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 focus-within:border-[#A03B5E] focus-within:ring-4 focus-within:ring-[#F8E9ED]">
            <span className="pl-3.5 text-sm text-slate-400">classbandhu/</span>
            <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={event => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()); }} className="min-w-0 flex-1 rounded-r-xl px-2 py-3 font-normal outline-none" />
          </div>
          <span className="mt-1 block text-xs font-normal text-slate-400">Lowercase letters, numbers, and hyphens.</span>
        </label>

        <section className="space-y-4 rounded-xl border border-slate-200 p-4">
          <div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#6B1F38]"/><h2 className="text-sm font-bold text-slate-900">1. Platform policies and mandatory Institute DPA</h2></div>
            <p className="mt-1 text-xs leading-5 text-slate-500">One checkbox covers Terms, AUP, Privacy Policy acknowledgement and the mandatory Institute DPA. The DPA is not a fourth checkbox.</p>
          </div>
          {loading && <p className="text-xs text-slate-500">Loading the current legal bundle…</p>}
          {loadError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">{loadError}</p>}
          {testOnly && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-800">DEVELOPMENT TEST COPY — these documents are internal drafts for staging review only. They are not approved legal agreements or production policies.</p>}
          <p className="text-xs leading-5 text-slate-500">Open the linked documents below in a new tab to review the current version before confirming.</p>
          {documents.length === 4 && <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <input type="checkbox" checked={bundleAccepted} onChange={event => setBundleAccepted(event.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-[#6B1F38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B1F38]"/>
            <span><LegalPolicyConsentText includeDpa /></span>
          </label>}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-900">2. Authority to create/manage the Institute</h2>
          <label className="flex cursor-pointer items-start gap-4 text-sm leading-6 text-slate-700">
            <input type="checkbox" checked={authorityAccepted} onChange={event => setAuthorityAccepted(event.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-[#6B1F38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B1F38]"/>
            <span>I confirm that I am authorised to create and manage this institution's account and to provide the institution's information to ClassBandhu for the ERP service.</span>
          </label>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-900">3. Authority to provide student/parent data</h2>
          <label className="flex cursor-pointer items-start gap-4 text-sm leading-6 text-slate-700">
            <input type="checkbox" checked={dataAuthorityAccepted} onChange={event => setDataAuthorityAccepted(event.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-[#6B1F38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B1F38]"/>
            <span>I confirm that, wherever required by applicable law, the institution has obtained the necessary consent or other lawful authorisation from parents or legal guardians for collecting and sharing student personal information with ClassBandhu to provide the ERP service.</span>
          </label>
          <p className="text-[11px] leading-5 text-slate-500">This is an Institute Owner attestation. It is not itself a student's or parent's consent and does not prove that a particular parent/guardian consent was obtained.</p>
        </section>

        {(error || authError) && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error || authError}</p>}
        <button disabled={busy || loading || documents.length !== 4 || !bundleAccepted || !authorityAccepted || !dataAuthorityAccepted} className="w-full rounded-xl bg-[#6B1F38] px-4 py-3 text-sm font-semibold text-white hover:bg-[#57172D] disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? 'Creating workspace and recording legal declarations…' : 'Confirm three declarations & Create institute'}
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
          <button key={membership.instituteId} onClick={() => selectInstitute(membership.instituteId)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left hover:border-[#D8B7C3] hover:bg-[#FCF6F8]">
            <span>
              <span className="block font-semibold text-slate-800">{membership.instituteName}</span>
              <span className="mt-1 block text-xs capitalize text-slate-500">{membership.role}</span>
            </span>
            <span className="text-[#6B1F38]">Open →</span>
          </button>
        ))}
      </div>
      <button onClick={() => void signOut()} className="mt-5 w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">Sign out</button>
    </AuthFrame>
  );
}

