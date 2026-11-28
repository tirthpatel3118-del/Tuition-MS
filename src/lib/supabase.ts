import { createClient } from '@supabase/supabase-js';

// These are browser-safe coordinates and a publishable key. RLS and server-side
// demo validation protect backend access; never place a service_role key here.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lcuheihzphekphgeszbt.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_qwFiJbh9DOgWsMwy2wqtSQ_BnhlaF44';

const DEMO_MODE_SESSION_KEY = 'classbandhu.demo.mode';
let storedDemoSession = false;
try {
  // This marker is set only after the server successfully activates an invitation.
  // A query parameter by itself never enables demo mode.
  storedDemoSession = sessionStorage.getItem(DEMO_MODE_SESSION_KEY) === '1';
} catch {
  storedDemoSession = false;
}

export const isDemoMode = storedDemoSession;

export function enableDemoModeSession(): boolean {
  try {
    sessionStorage.setItem(DEMO_MODE_SESSION_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export function clearDemoModeSession(): void {
  try {
    sessionStorage.removeItem(DEMO_MODE_SESSION_KEY);
  } catch {
    // The app remains locked because the server token is validated on every entry.
  }
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey) && !isDemoMode;

// Demo UI data is strictly local. The only network calls made while in demo mode
// are the narrowly scoped demo-access activation/validation calls.
export const supabase = createClient(
  isDemoMode ? 'http://127.0.0.1:54321' : (supabaseUrl || 'http://127.0.0.1:54321'),
  isDemoMode ? 'demo-only-key' : (supabaseAnonKey || 'demo-only-key')
);
