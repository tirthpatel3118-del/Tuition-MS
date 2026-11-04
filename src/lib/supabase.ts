import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || '';

// The explicit browser demo mode always uses local sample data and must never
// send requests to the configured Supabase project.
const DEMO_SESSION_KEY = 'eduledger_demo_mode';
const requestedDemoMode = new URLSearchParams(window.location.search).get('demo') === '1';
if (requestedDemoMode) sessionStorage.setItem(DEMO_SESSION_KEY, '1');

export const isDemoMode = requestedDemoMode || sessionStorage.getItem(DEMO_SESSION_KEY) === '1';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey) && !isDemoMode;

// Keep the demo build usable without credentials. No request is made unless a
// service is explicitly enabled by isSupabaseConfigured.
export const supabase = createClient(
  supabaseUrl || 'http://127.0.0.1:54321',
  supabaseAnonKey || 'demo-only-key'
);

