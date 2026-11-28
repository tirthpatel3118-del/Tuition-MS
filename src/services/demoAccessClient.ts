import { supabaseAnonKey, supabaseUrl } from '../lib/supabase';

const SESSION_KEY = 'classbandhu.demo.session';
const FUNCTION_URL = supabaseUrl.replace(/\\/$/, '') + '/functions/v1/demo-access';

export interface DemoValidation {
  valid: boolean;
  expiresAt: string | null;
  extensionAvailable: boolean;
}

type DemoApiResponse = {
  success?: boolean;
  valid?: boolean;
  sessionToken?: string;
  expiresAt?: string | null;
  extensionAvailable?: boolean;
  error?: string;
};

function readSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function clearDemoSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // The session remains blocked because local storage cannot be read.
  }
}

async function callDemoAccess(body: Record<string, unknown>): Promise<DemoApiResponse> {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Demo access service is unavailable.');
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    credentials: 'omit',
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as DemoApiResponse;
  if (!response.ok) throw new Error(data.error || 'Demo access could not be verified.');
  return data;
}

export async function activateDemoInvitation(invitationToken: string): Promise<void> {
  const current = readSessionToken();
  if (current) {
    const result = await validateDemoSession(current);
    if (result.valid) return;
    clearDemoSession();
    throw new Error('This demo session has expired or been revoked. Request a new demo invitation.');
  }

  const result = await callDemoAccess({ action: 'activate', token: invitationToken });
  if (!result.success || !result.sessionToken) {
    throw new Error('This demo invitation is invalid, expired or already used.');
  }
  try {
    localStorage.setItem(SESSION_KEY, result.sessionToken);
  } catch {
    throw new Error('Your browser could not save the secure demo session. Enable site storage and reopen your invitation.');
  }
}

export async function validateDemoSession(sessionToken = readSessionToken()): Promise<DemoValidation> {
  if (!sessionToken) return { valid: false, expiresAt: null, extensionAvailable: false };
  const result = await callDemoAccess({ action: 'validate', sessionToken });
  return {
    valid: result.valid === true,
    expiresAt: result.expiresAt ?? null,
    extensionAvailable: result.extensionAvailable === true,
  };
}

export function getDemoSessionToken(): string | null {
  return readSessionToken();
}
