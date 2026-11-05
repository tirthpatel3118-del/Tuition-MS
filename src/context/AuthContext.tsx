import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { setActiveInstituteId as setRequestInstituteId } from '../lib/tenant';

export type InstituteRole = 'owner' | 'accountant' | 'teacher';

export interface InstituteMembership {
  instituteId: string;
  instituteName: string;
  role: InstituteRole;
}

type AuthStatus =
  | 'demo'
  | 'loading'
  | 'signed-out'
  | 'verifying'
  | 'loading-memberships'
  | 'ready'
  | 'error';

interface AuthContextValue {
  configured: boolean;
  status: AuthStatus;
  session: Session | null;
  email: string | null;
  memberships: InstituteMembership[];
  activeMembership: InstituteMembership | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectInstitute: (instituteId: string) => void;
  createInstitute: (name: string, slug: string) => Promise<void>;
  refreshMemberships: () => Promise<void>;
  acceptInvitation: (token: string) => Promise<void>;
}

const ACTIVE_INSTITUTE_KEY = 'eduledger.activeInstituteId';
const LEGACY_ACTIVE_INSTITUTE_KEY = 'edulegder.activeInstituteId';
const AUTH_REQUEST_TIMEOUT_MS = 20_000;
const AuthContext = createContext<AuthContextValue | null>(null);

function withTimeout<T>(request: PromiseLike<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), AUTH_REQUEST_TIMEOUT_MS);
    Promise.resolve(request).then(
      value => { window.clearTimeout(timeout); resolve(value); },
      error => { window.clearTimeout(timeout); reject(error); },
    );
  });
}

function readSessionValue(key: string): string | null {
  try {
    return sessionStorage.getItem(key) || sessionStorage.getItem(LEGACY_ACTIVE_INSTITUTE_KEY);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
    sessionStorage.setItem(LEGACY_ACTIVE_INSTITUTE_KEY, value);
  } catch {
    // Persisting the active institute is optional; React state remains authoritative.
  }
}

function removeSessionValue(key: string) {
  try {
    sessionStorage.removeItem(key);
    sessionStorage.removeItem(LEGACY_ACTIVE_INSTITUTE_KEY);
  } catch {
    // Storage can be disabled by browser privacy settings.
  }
}

function clearAppData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('eduledger_')) localStorage.removeItem(key);
    }
  } catch {
    // Clearing cached data must not interrupt sign-in or sign-out.
  }

  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('eduledger.pendingPayment:')) sessionStorage.removeItem(key);
    }
  } catch {
    // Storage cleanup is best-effort; server-side tenant access is still enforced by RLS.
  }
  removeSessionValue(ACTIVE_INSTITUTE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured;
  const [status, setStatusState] = useState<AuthStatus>(configured ? 'loading' : 'demo');
  const [session, setSessionState] = useState<Session | null>(null);
  const [verifiedUserId, setVerifiedUserIdState] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<InstituteMembership[]>([]);
  const [activeInstituteId, setActiveInstituteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Synchronous refs to prevent stale closure reads during concurrent async operations
  const statusRef = useRef<AuthStatus>(status);
  const sessionRef = useRef<Session | null>(session);
  const verifiedUserIdRef = useRef<string | null>(verifiedUserId);

  const setStatus = useCallback((nextStatus: AuthStatus) => {
    statusRef.current = nextStatus;
    setStatusState(nextStatus);
  }, []);

  const setSession = useCallback((nextSession: Session | null) => {
    sessionRef.current = nextSession;
    setSessionState(nextSession);
  }, []);

  const setVerifiedUserId = useCallback((nextUserId: string | null) => {
    verifiedUserIdRef.current = nextUserId;
    setVerifiedUserIdState(nextUserId);
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    verifiedUserIdRef.current = verifiedUserId;
  }, [verifiedUserId]);

  const bootstrapSeqRef = useRef(0);
  const membershipRequests = useRef(new Map<string, { id: number; promise: Promise<void> }>());
  const membershipRequestId = useRef(0);

  // Apply loaded memberships to state and activate appropriate tenant
  const applyMemberships = useCallback((nextMemberships: InstituteMembership[]) => {
    setMemberships(nextMemberships);
    const storedInstituteId = readSessionValue(ACTIVE_INSTITUTE_KEY);
    const storedMembership = nextMemberships.find(item => item.instituteId === storedInstituteId);

    if (storedMembership) {
      setActiveInstituteId(storedMembership.instituteId);
      setRequestInstituteId(storedMembership.instituteId);
    } else if (nextMemberships.length === 1) {
      setActiveInstituteId(nextMemberships[0].instituteId);
      setRequestInstituteId(nextMemberships[0].instituteId);
      writeSessionValue(ACTIVE_INSTITUTE_KEY, nextMemberships[0].instituteId);
    } else {
      setActiveInstituteId(null);
      setRequestInstituteId(null);
      removeSessionValue(ACTIVE_INSTITUTE_KEY);
    }
  }, []);

  // Complete, unified bootstrap: verifies claims and loads memberships in a single guaranteed flow
  const runBootstrap = useCallback(async (sessionToVerify: Session) => {
    const seq = ++bootstrapSeqRef.current;
    setStatus('verifying');
    setError(null);

    try {
      const { data, error: verifyError } = await withTimeout(
        supabase.auth.getClaims(sessionToVerify.access_token),
        'Sign-in verification timed out. Please try again.',
      );

      if (seq !== bootstrapSeqRef.current) return;

      const sub = data?.claims?.sub;
      if (verifyError || !sub) {
        setError('Your sign-in could not be verified. Please sign in again.');
        setStatus('error');
        await supabase.auth.signOut({ scope: 'local' });
        return;
      }

      const userId = String(sub);
      setVerifiedUserId(userId);
      setStatus('loading-memberships');

      const { data: memberRows, error: membershipError } = await withTimeout(
        supabase
          .from('institute_members')
          .select('institute_id, role, institutes!inner(id, name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
        'Loading your institute memberships timed out. Please try again.',
      );

      if (seq !== bootstrapSeqRef.current) return;

      if (membershipError) throw membershipError;

      const nextMemberships: InstituteMembership[] = (memberRows ?? []).map((row: any) => {
        const institute = Array.isArray(row.institutes) ? row.institutes[0] : row.institutes;
        return {
          instituteId: row.institute_id,
          instituteName: institute?.name ?? 'Institute',
          role: row.role as InstituteRole,
        };
      });

      applyMemberships(nextMemberships);
      setStatus('ready');
      setError(null);
    } catch (bootstrapError: unknown) {
      if (seq !== bootstrapSeqRef.current) return;
      setRequestInstituteId(null);
      const message = bootstrapError instanceof Error && bootstrapError.message.includes('timed out')
        ? bootstrapError.message
        : (bootstrapError instanceof Error ? bootstrapError.message : 'Could not load your institute workspace. The database setup may be incomplete.');
      setError(message);
      setStatus('error');
    }
  }, [applyMemberships, setStatus, setVerifiedUserId]);

  const refreshMemberships = useCallback(async () => {
    if (!configured) return;
    const currentSession = sessionRef.current;
    if (!currentSession) {
      setStatus('signed-out');
      return;
    }

    const userId = verifiedUserIdRef.current;
    if (!userId) {
      // User claims not yet verified; run full bootstrap
      await runBootstrap(currentSession);
      return;
    }

    const existingRequest = membershipRequests.current.get(userId);
    if (existingRequest) return existingRequest.promise;

    const requestId = ++membershipRequestId.current;
    // Only transition visual status if currently in an error state
    if (statusRef.current === 'error') {
      setStatus('loading-memberships');
    }
    setError(null);

    const request = (async () => {
      try {
        const { data, error: membershipError } = await withTimeout(
          supabase
            .from('institute_members')
            .select('institute_id, role, institutes!inner(id, name)')
            .eq('user_id', userId)
            .order('created_at', { ascending: true }),
          'Loading your institute memberships timed out. Please try again.',
        );

        if (requestId !== membershipRequestId.current) return;
        if (membershipError) throw membershipError;

        const nextMemberships: InstituteMembership[] = (data ?? []).map((row: any) => {
          const institute = Array.isArray(row.institutes) ? row.institutes[0] : row.institutes;
          return {
            instituteId: row.institute_id,
            instituteName: institute?.name ?? 'Institute',
            role: row.role as InstituteRole,
          };
        });

        applyMemberships(nextMemberships);
        setStatus('ready');
        setError(null);
      } catch (membershipLoadError) {
        if (requestId !== membershipRequestId.current) return;
        setRequestInstituteId(null);
        setError(membershipLoadError instanceof Error && membershipLoadError.message.includes('timed out')
          ? membershipLoadError.message
          : 'Could not load your institute memberships. The database setup may be incomplete.');
        setStatus('error');
      } finally {
        if (membershipRequests.current.get(userId)?.id === requestId) {
          membershipRequests.current.delete(userId);
        }
      }
    })();

    membershipRequests.current.set(userId, { id: requestId, promise: request });
    return request;
  }, [configured, applyMemberships, runBootstrap, setStatus]);

  useEffect(() => {
    if (!configured) return;
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      if (!nextSession) {
        bootstrapSeqRef.current += 1;
        membershipRequestId.current += 1;
        membershipRequests.current.clear();
        clearAppData();
        setSession(null);
        setVerifiedUserId(null);
        setMemberships([]);
        setActiveInstituteId(null);
        setRequestInstituteId(null);
        setError(null);
        setStatus('signed-out');
        return;
      }

      const currentStatus = statusRef.current;
      const currentVerifiedUserId = verifiedUserIdRef.current;
      const nextUserId = nextSession.user.id;

      // When the user is already authenticated and active in 'ready' status,
      // and the auth event belongs to the same user (such as TOKEN_REFRESHED,
      // tab switch sync, or storage sync), do NOT reset status or unmount the UI!
      if (currentStatus === 'ready' && currentVerifiedUserId === nextUserId) {
        setSession(nextSession);
        return;
      }

      // If we are already running bootstrap/verification for this user, keep session fresh
      if ((currentStatus === 'verifying' || currentStatus === 'loading-memberships') && currentVerifiedUserId === nextUserId) {
        setSession(nextSession);
        return;
      }

      // If a different user signed in, clear previous app storage
      if (event === 'SIGNED_IN' && currentVerifiedUserId !== nextUserId) {
        clearAppData();
      }

      setSession(nextSession);
      void runBootstrap(nextSession);
    });

    // Fallback: If onAuthStateChange has not yet initialized the status from 'loading'
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        if (statusRef.current === 'loading') {
          setStatus('signed-out');
        }
        return;
      }
      if (statusRef.current === 'loading') {
        if (data.session) {
          setSession(data.session);
          void runBootstrap(data.session);
        } else {
          setStatus('signed-out');
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured, runBootstrap, setSession, setStatus, setVerifiedUserId]);

  // Browsers can suspend network work while a tab is in the background. Re-read
  // the persisted session on return only if a previous bootstrap was suspended.
  useEffect(() => {
    if (!configured) return;
    let active = true;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== 'visible') return;

      // If the app is already in a steady state ('ready', 'signed-out', 'demo'),
      // do not interrupt the user. Supabase's client handles background token
      // refresh automatically without tearing down the UI.
      const currentStatus = statusRef.current;
      if (currentStatus === 'ready' || currentStatus === 'signed-out' || currentStatus === 'demo') {
        return;
      }

      // Only attempt session recovery if bootstrap was suspended mid-load
      void withTimeout(supabase.auth.getSession(), 'Session restoration timed out. Please try again.')
        .then(({ data, error: sessionError }) => {
          if (!active) return;
          if (sessionError) throw sessionError;
          const currentSession = sessionRef.current;
          const restored = data.session;
          if (restored && (!currentSession || currentSession.access_token !== restored.access_token)) {
            setSession(restored);
            void runBootstrap(restored);
          }
        })
        .catch(() => {
          if (!active) return;
          const activeStatus = statusRef.current;
          if (activeStatus === 'loading' || activeStatus === 'verifying' || activeStatus === 'loading-memberships') {
            setError('Session restoration timed out. Please try again.');
            setStatus('error');
          }
        });
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [configured, runBootstrap, setSession, setStatus]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) throw signInError;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (signUpError) throw signUpError;
    return !data.session;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) throw resetError;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw updateError;
  }, []);

  const acceptInvitation = useCallback(async (token: string) => {
    const { data, error: acceptError } = await supabase.rpc('accept_institute_invitation', { p_raw_token: token });
    if (acceptError) throw acceptError;
    const instituteId = String(data?.institute_id ?? '');
    if (!instituteId) throw new Error('The invitation did not return a valid institute.');
    await refreshMemberships();
    writeSessionValue(ACTIVE_INSTITUTE_KEY, instituteId);
    setActiveInstituteId(instituteId);
    setRequestInstituteId(instituteId);
  }, [refreshMemberships]);

  const signOut = useCallback(async () => {
    bootstrapSeqRef.current += 1;
    membershipRequestId.current += 1;
    membershipRequests.current.clear();
    try {
      await supabase.auth.signOut();
    } catch {
      // Best effort; proceed to clear local state
    }
    clearAppData();
    setSession(null);
    setVerifiedUserId(null);
    setMemberships([]);
    setActiveInstituteId(null);
    setRequestInstituteId(null);
    setError(null);
    setStatus('signed-out');
  }, [setSession, setStatus, setVerifiedUserId]);

  const selectInstitute = useCallback((instituteId: string) => {
    const membership = memberships.find(item => item.instituteId === instituteId);
    if (!membership) throw new Error('You are not a member of that institute.');
    if (activeInstituteId !== instituteId) clearAppData();
    writeSessionValue(ACTIVE_INSTITUTE_KEY, instituteId);
    setActiveInstituteId(instituteId);
    setRequestInstituteId(instituteId);
  }, [activeInstituteId, memberships]);

  const createInstitute = useCallback(async (name: string, slug: string) => {
    const { data, error: createError } = await supabase.rpc('create_institute_atomic', {
      p_name: name.trim(),
      p_slug: slug.trim().toLowerCase(),
      p_currency_symbol: '₹',
      p_receipt_prefix: 'REC',
    });
    if (createError) throw createError;
    await refreshMemberships();
    if (data) {
      const instituteId = String(data);
      writeSessionValue(ACTIVE_INSTITUTE_KEY, instituteId);
      setActiveInstituteId(instituteId);
      setRequestInstituteId(instituteId);
    }
  }, [refreshMemberships]);

  const activeMembership = memberships.find(item => item.instituteId === activeInstituteId) ?? null;
  const value = useMemo<AuthContextValue>(() => ({
    configured,
    status,
    session,
    email: session?.user.email ?? null,
    memberships,
    activeMembership,
    error,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    signOut,
    selectInstitute,
    createInstitute,
    refreshMemberships,
    acceptInvitation,
  }), [configured, status, session, memberships, activeMembership, error, signIn, signUp, requestPasswordReset, updatePassword, signOut, selectInstitute, createInstitute, refreshMemberships, acceptInvitation]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
