import {
  clearDemoModeSession,
  enableDemoModeSession,
  supabaseAnonKey,
  supabaseUrl,
} from '../lib/supabase';

const SESSION_KEY = 'classbandhu.demo.session';
const FUNCTION_URL = (supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl) + '/functions/v1/demo-access';

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

let activationInFlight: { token: string; promise: Promise<void> } | null = null;

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
    // The demo remains blocked because the session marker is also cleared.
  }
  clearDemoModeSession();
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

async function activateInvitationOnce(invitationToken: string): Promise<void> {
  const current = readSessionToken();
  if (current) {
    const existing = await validateDemoSession(current);
    if (existing.valid) {
      if (!enableDemoModeSession()) throw new Error('Your browser could not open a secure demo session. Enable site storage and try again.');
      return;
    }
    clearDemoSession();
  }

  const result = await callDemoAccess({ action: 'activate', token: invitationToken });
  if (!result.success || !result.sessionToken) {
    throw new Error('This demo invitation is invalid, expired or already used. Request a new invitation.');
  }

  try {
    localStorage.setItem(SESSION_KEY, result.sessionToken);
  } catch {
    throw new Error('Your browser could not save the secure demo session. Enable site storage and reopen your invitation.');
  }
  if (!enableDemoModeSession()) {
    clearDemoSession();
    throw new Error('Your browser could not initialise a secure demo session. Enable site storage and try again.');
  }
}

export function activateDemoInvitation(invitationToken: string): Promise<void> {
  const token = invitationToken.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return Promise.reject(new Error('This demo invitation is invalid or expired.'));
  }
  if (activationInFlight?.token === token) return activationInFlight.promise;

  const promise = activateInvitationOnce(token).finally(() => {
    if (activationInFlight?.token === token) activationInFlight = null;
  });
  activationInFlight = { token, promise };
  return promise;
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
