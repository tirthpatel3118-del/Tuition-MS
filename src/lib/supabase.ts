import { createClient } from '@supabase/supabase-js';

// These are browser-safe project coordinates and a publishable key. RLS and
// database policies enforce access; never place a service_role key here.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lcuheihzphekphgeszbt.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_qwFiJbh9DOgWsMwy2wqtSQ_BnhlaF44';

// A browser-only demo is enabled only after the server exchanges a valid invitation
// for a short-lived session capability. A query string alone never grants access.
const DEMO_SESSION_STORAGE_KEY = 'classbandhu.demo.session';
let storedDemoSession = false;
try {
  storedDemoSession = Boolean(localStorage.getItem(DEMO_SESSION_STORAGE_KEY));
} catch {
  storedDemoSession = false;
}
export const isDemoMode = storedDemoSession;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey) && !isDemoMode;

// In a verified demo, all normal client calls are deliberately pointed at a local
// inert endpoint. The dedicated demo-access Edge Function is called by the
// demo-access client with the configured public URL and publishable key.
export const supabase = createClient(
  isDemoMode ? 'http://127.0.0.1:54321' : (supabaseUrl || 'http://127.0.0.1:54321'),
  isDemoMode ? 'demo-only-key' : (supabaseAnonKey || 'demo-only-key')
);
