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

## Authentication and account recovery

The app provides sign-in, account creation, invitation acceptance, forgot-password, and reset-password screens. Before enabling live email flows, configure Supabase Auth’s Site URL and Redirect URLs for the exact production domain and any preview or local origins you intend to use. Allow the site root for account confirmation and `/reset-password` for password recovery. Configure and verify email delivery in the Supabase project. Do not use a preview origin as the production Site URL.

The privacy policy and terms pages are available at `/privacy` and `/terms`. Their current content is an operator-review draft: confirm the data processors, retention and deletion practices, responsible institute identity, legal jurisdiction, and contact details before publishing them as final legal notices.

## Build and lint

```sh
npm run build
npm run lint
```

## Database readiness

Follow [`supabase/OPERATIONS.md`](supabase/OPERATIONS.md) for the backup, isolated restore, baseline parity, owner bootstrap, and production cutover gates. This runbook keeps database verification separate from production and documents the required handling for private backup files.

The app expects the tenant, membership, academic privacy view, reminder, allocation, and payment RPC objects defined by the approved EduLedger v2.4 architecture plan. The existing live project schema has not yet been safely reconciled to that plan. Do not apply the legacy `20260706000000_init_schema.sql` or the v2.4 migrations to production until the live baseline is captured, an isolated restore passes row-count and financial parity checks, and the migrations are reviewed against that baseline.

The payment UI writes through `record_payment_atomic`; database setup must also install the matching `void_payment_atomic` path and strict role policies before production use. WhatsApp/SMS reminders are only queued or opened manually; a delivery service and verified webhooks are not included.

The live project currently reports an empty Supabase migration history even though its legacy tables already exist. The repository's `20260706000000_init_schema.sql` would therefore be treated as pending by a normal migration push and must not be replayed against that database. Establish and verify the baseline in an isolated restore first; only then reconcile the Supabase migration history and apply the tenant migrations in order. Migration 7 is the access cutover and must wait until the intended initial owner is linked and login is verified.

The seven v2.4 migration files are a review candidate, not a deployment package yet. Their SQL has not been executed against an isolated copy of the live database. Confirm existing row counts, orphan references, duplicate roll numbers and receipt numbers, payment-to-installment matches, and the exact legacy RLS policies before applying them. Migration 5 allocates legacy payments only on a single exact amount match; other cases are preserved as anomalies for manual review.

Run [`supabase/preflight/202611_v2_4_baseline.sql`](supabase/preflight/202611_v2_4_baseline.sql) against the verified backup and its isolated restore to capture the aggregate baseline. It returns counts, integrity checks, payment-link classifications, installment statuses, and legacy policy definitions without returning student or payment rows. The live read-only check on 2026-11-03 found 3 courses, 2 students, 2 payments, 2 receipts, and 9 installments; both payments match one installment exactly for a total of 7,500.00. Seven installments have no linked payment, and one of those is past due.

After migrations 1–5 have run on the isolated restore, run [`supabase/reports/20261104_historical_reconciliation.sql`](supabase/reports/20261104_historical_reconciliation.sql). It reports payment allocation parity and unverified history as aggregate counts and totals. A legacy payment is allocated only when it maps to one installment, the amounts match exactly, and that installment was already marked `Paid`; every other case remains unallocated and is recorded for manual review.

The live database has no `public.settings` relation, so the three existing courses will have `course_fee = NULL` after migration unless an isolated backup reveals another verified source. Migration 3 records those missing fees for review rather than inventing prices. Enter the confirmed course rates before using those courses for new admissions; existing student-level fee amounts remain preserved.

