import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  signOut: () => Promise<void>;
  selectInstitute: (instituteId: string) => void;
  createInstitute: (name: string, slug: string) => Promise<void>;
  refreshMemberships: () => Promise<void>;
}

const ACTIVE_INSTITUTE_KEY = 'edulegder.activeInstituteId';
const AuthContext = createContext<AuthContextValue | null>(null);

function clearAppData() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('eduledger_')) localStorage.removeItem(key);
  }
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith('eduledger.pendingPayment:')) sessionStorage.removeItem(key);
  }
  sessionStorage.removeItem(ACTIVE_INSTITUTE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured;
  const [status, setStatus] = useState<AuthStatus>(configured ? 'loading' : 'demo');
  const [session, setSession] = useState<Session | null>(null);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<InstituteMembership[]>([]);
  const [activeInstituteId, setActiveInstituteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;

    // Keep this callback synchronous. Supabase auth callbacks must not await
    // other Supabase operations; verification and membership reads run below.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setError(null);
      if (nextSession) {
        if (event === 'SIGNED_IN') clearAppData();
        setStatus('verifying');
      } else {
        clearAppData();
        setVerifiedUserId(null);
        setMemberships([]);
        setActiveInstituteId(null);
        setRequestInstituteId(null);
        setStatus('signed-out');
      }
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  useEffect(() => {
    if (!configured || !session) return;
    let cancelled = false;

    const verifySession = async () => {
      const { data, error: verifyError } = await supabase.auth.getClaims(session.access_token);
      if (cancelled) return;
      if (verifyError || !data?.claims?.sub) {
        setError('Your sign-in could not be verified. Please sign in again.');
        setStatus('error');
        await supabase.auth.signOut({ scope: 'local' });
        return;
      }

      setVerifiedUserId(String(data.claims.sub));
      setStatus('loading-memberships');
    };

    void verifySession().catch((verificationError: unknown) => {
      if (cancelled) return;
      setError(verificationError instanceof Error ? verificationError.message : 'Unable to verify your sign-in.');
      setStatus('error');
    });

    return () => { cancelled = true; };
  }, [configured, session]);

  const refreshMemberships = useCallback(async () => {
    if (!configured || !verifiedUserId) return;

    setStatus('loading-memberships');
    setError(null);
    const { data, error: membershipError } = await supabase
      .from('institute_members')
      .select('institute_id, role, institutes!inner(id, name)')
      .eq('user_id', verifiedUserId)
      .order('created_at', { ascending: true });

    if (membershipError) {
      setRequestInstituteId(null);
      setError('Could not load your institute memberships. The database setup may be incomplete.');
      setStatus('error');
      return;
    }

    const nextMemberships: InstituteMembership[] = (data ?? []).map((row: any) => {
      const institute = Array.isArray(row.institutes) ? row.institutes[0] : row.institutes;
      return {
        instituteId: row.institute_id,
        instituteName: institute?.name ?? 'Institute',
        role: row.role as InstituteRole,
      };
    });

    setMemberships(nextMemberships);
    const storedInstituteId = sessionStorage.getItem(ACTIVE_INSTITUTE_KEY);
    const storedMembership = nextMemberships.find(item => item.instituteId === storedInstituteId);

    if (storedMembership) {
      setActiveInstituteId(storedMembership.instituteId);
      setRequestInstituteId(storedMembership.instituteId);
    } else if (nextMemberships.length === 1) {
      setActiveInstituteId(nextMemberships[0].instituteId);
      setRequestInstituteId(nextMemberships[0].instituteId);
      sessionStorage.setItem(ACTIVE_INSTITUTE_KEY, nextMemberships[0].instituteId);
    } else {
      setActiveInstituteId(null);
      setRequestInstituteId(null);
      sessionStorage.removeItem(ACTIVE_INSTITUTE_KEY);
    }

    setStatus('ready');
  }, [configured, verifiedUserId]);

  useEffect(() => {
    if (configured && verifiedUserId) void refreshMemberships();
  }, [configured, verifiedUserId, refreshMemberships]);

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
        emailRedirectTo: window.location.origin,
      },
    });
    if (signUpError) throw signUpError;
    return !data.session;
  }, []);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    clearAppData();
  }, []);

  const selectInstitute = useCallback((instituteId: string) => {
    const membership = memberships.find(item => item.instituteId === instituteId);
    if (!membership) throw new Error('You are not a member of that institute.');
    if (activeInstituteId !== instituteId) clearAppData();
    sessionStorage.setItem(ACTIVE_INSTITUTE_KEY, instituteId);
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
      sessionStorage.setItem(ACTIVE_INSTITUTE_KEY, instituteId);
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
    signOut,
    selectInstitute,
    createInstitute,
    refreshMemberships,
  }), [configured, status, session, memberships, activeMembership, error, signIn, signUp, signOut, selectInstitute, createInstitute, refreshMemberships]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}

