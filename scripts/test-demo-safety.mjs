import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const supabase = read('../src/lib/supabase.ts');
const pwa = read('../src/components/PWAControls.tsx');
const dataContext = read('../src/context/DataContext.tsx');
const reminders = read('../src/pages/Reminders.tsx');
const mockData = read('../src/data/mockData.ts');
const reminderService = read('../src/services/reminderService.ts');
const mockStorage = read('../src/data/mockData.ts');
const serviceWorker = read('../public/sw.js');
const requestDemo = read('../src/pages/RequestDemoPage.tsx');
const app = read('../src/App.tsx');
const authContext = read('../src/context/AuthContext.tsx');
const authPages = read('../src/pages/AuthPages.tsx');
const demoClient = read('../src/services/demoAccessClient.ts');
const demoGuard = read('../src/components/DemoSessionGuard.tsx');
const demoPages = read('../src/pages/DemoAccessPages.tsx');
const demoEdge = read('../supabase/functions/demo-access/index.ts');

// Demo mode must force Supabase to a local inert endpoint and mark it unconfigured.
assert.ok(supabase.includes("export const isDemoMode = storedDemoSession"));
assert.ok(supabase.includes("sessionStorage.getItem(DEMO_MODE_SESSION_KEY) === '1'"));
assert.ok(supabase.includes('export function enableDemoModeSession()'));
assert.ok(!supabase.includes("get('demo') === '1'"));
assert.ok(supabase.includes("Boolean(supabaseUrl && supabaseAnonKey) && !isDemoMode"));
assert.ok(supabase.includes('export const supabaseUrl'));
assert.ok(supabase.includes('export const supabaseAnonKey'));
assert.ok(supabase.includes('isDemoMode ? \'demo-only-key\''));
assert.ok(supabase.includes("isDemoMode ? 'http://127.0.0.1:54321'"));
assert.ok(supabase.includes("isDemoMode ? 'demo-only-key'"));
assert.ok(mockStorage.includes('if (isDemoMode) return fallback;'));
assert.ok(mockStorage.includes('if (isDemoMode) return true;'));
assert.ok(reminderService.includes('if (!isSupabaseConfigured) {'));
assert.ok(reminderService.includes('return inputs.map(input => ({'));

// Public demo must not register or expose normal PWA update/install controls.
assert.ok(pwa.includes("import { isDemoMode } from '../lib/supabase'"));
assert.ok(pwa.includes('if (isDemoMode) return;'));
assert.ok(pwa.includes('if (isDemoMode) return null;'));

// Bulk reminder records in demo are explicitly simulated, never described as dispatched.
assert.ok(mockData.includes("'queued' | 'simulated' | 'manual_opened'"));
assert.ok(dataContext.includes("status: isDemoMode ? 'simulated' : 'queued'"));
assert.ok(dataContext.includes('if (itemsToQueue.length === 0) return 0;'));
assert.ok(dataContext.includes('return newReminders.length;'));
assert.ok(reminders.includes('No WhatsApp, SMS or email will be sent'));
assert.ok(reminders.includes('No message was sent and no server queue was created.'));
assert.ok(reminders.includes('createdCount === 0'));
assert.ok(reminders.includes('Simulated · not sent'));
assert.ok(reminders.includes("{isDemoMode ? 'Simulate' : 'Queue'}"));
assert.ok(reminders.includes('event.preventDefault();'));
assert.ok(reminders.includes('Demo mode: no WhatsApp message was sent.'));

// The static app shell must never cache backend API paths.
assert.ok(serviceWorker.includes("url.pathname.startsWith('/rest/')"));
assert.ok(serviceWorker.includes("url.pathname.startsWith('/auth/')"));
assert.ok(serviceWorker.includes("url.pathname.startsWith('/storage/')"));

// The public explainer has no backend integration, and is routed outside AuthProvider.
assert.ok(!requestDemo.includes('supabase'));
assert.ok(app.includes("if (location.pathname === '/request-demo') return <RequestDemoPage />"));
assert.ok(app.includes("new URLSearchParams(location.search).get('demo') === '1'"));
assert.ok(app.includes('<DemoSessionGuard>'));
assert.ok(demoClient.includes('enableDemoModeSession()'));
assert.ok(demoClient.includes("action: 'activate'"));
assert.ok(demoClient.includes("action: 'validate'"));
assert.ok(demoGuard.includes('window.setInterval(() => { void verify(); }, 10_000)'));
assert.ok(demoGuard.includes('if (!result.valid || !result.expiresAt'));
assert.ok(demoPages.includes('window.history.replaceState(null'));
assert.ok(!demoPages.includes("window.location.replace('/?demo=1')"));
assert.ok(demoEdge.includes('website_demo_activate'));
assert.ok(demoEdge.includes('website_demo_validate'));
assert.ok(app.includes('return (\n    <AuthProvider>'));

// Demo mode starts with a non-configured AuthProvider and skips Supabase auth listeners.
// New public account creation remains invitation-only.
assert.ok(authContext.includes('const configured = isSupabaseConfigured;'));
assert.ok(authContext.includes("useState<AuthStatus>(configured ? 'loading' : 'demo')"));
assert.ok(authContext.includes('if (!configured) return;'));
assert.ok(authPages.includes('Access is provided by invitation.'));
assert.ok(authPages.includes("invitationFlow ? 'sign-up' : 'sign-in'"));

console.log('Demo safety regression checks passed.');
