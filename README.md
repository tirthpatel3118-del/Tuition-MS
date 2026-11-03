# EduLedger ERP

EduLedger is a tuition and institute management app built with React, TypeScript, Vite, and Supabase. It supports a local demo workspace and an authenticated, multi-institute Supabase workspace.

## Local development

Requirements: Node.js 20.19+ and npm.

```sh
npm ci
npm run dev
```

Without Supabase credentials, the development server uses browser-local demo data. The production build fails closed with a setup screen if Supabase is not configured.

## Supabase browser configuration

Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<public-publishable-key>
```

Only a public publishable key belongs in browser configuration. Never use a `service_role` or secret key in a `VITE_` variable or commit environment files.

## Build and lint

```sh
npm run build
npm run lint
```

## Database readiness

The app expects the tenant, membership, academic privacy view, reminder, allocation, and payment RPC objects defined by the approved EduLedger v2.4 architecture plan. The existing live project schema has not yet been safely reconciled to that plan. Do not apply the legacy `20260706000000_init_schema.sql` or the v2.4 migrations to production until the live baseline is captured, an isolated restore passes row-count and financial parity checks, and the migrations are reviewed against that baseline.

The payment UI writes through `record_payment_atomic`; database setup must also install the matching `void_payment_atomic` path and strict role policies before production use. WhatsApp/SMS reminders are only queued or opened manually; a delivery service and verified webhooks are not included.

