# Super Admin v2 development notes

## Added
- Action centre alerts for overdue platform invoices, upcoming subscription expiries and pending invitations.
- Service checks for the authenticated admin session, the platform-admin authorization RPC and the AI Edge Function configuration.
- Read-only OpenAI Responses API Copilot backed only by aggregate platform overview and billing metrics.
- AI request/token/failure usage auditing in the private schema.
- Google OAuth sign-in entry, guarded so Google sessions without the platform-admin role cannot enter an institute workspace.

## Required development secrets and provider setup
1. Configure Google OAuth client ID/secret in Supabase Auth > Providers for the development project. Configure the Supabase callback URL and app redirect URL in Google Cloud and Supabase Auth URL settings.
2. Configure Edge Function secret OPENAI_API_KEY in the development project. Optional OPENAI_MODEL defaults to gpt-5-mini.
3. Confirm EDULEDGER_APP_URL is set to the development app URL. The AI function checks request origin against this URL.
4. Never paste secrets into source control, browser UI, chat, or SQL.

## Limits
- The Copilot is read-only and does not execute actions.
- It sees aggregate platform overview and platform billing overview only.
- Per-admin rate limit: 20 requests/hour.
- No prompt or completion text is persisted.
- OAuth provider activation requires Google credentials and Supabase Auth provider configuration outside repository code.
- Service health currently covers browser auth session, the platform-admin database authorization RPC, and AI function configuration. It is not a full external uptime monitor.

## Before production
- Configure separate production OAuth credentials and redirect allow-list.
- Configure a separate production OpenAI API key/usage budget.
- Review the migration and function source before applying/deploying to production.
- Run build, lint, all regression scripts, browser flows and authorization tests.


## Additional development schema changes
- `20261120125658_platform_ai_service_role_audit_rpcs.sql`: service-role-only audit insert and rate-limit count RPCs. Authenticated users cannot execute these helper functions.
- `20261120130017_platform_admin_monthly_analytics.sql`: Super Admin-only 12-month institute/student registration and collected platform subscription revenue series.

The monthly analytics RPC was executed under the development Super Admin JWT context and returned 12 month buckets (Dec 2025–Nov 2026 at the time of verification). Existing institute management, invitations and platform billing UI/RPCs were reused rather than duplicated.


## Scope decision — Copilot and OAuth removed
OpenAI Copilot and Google OAuth were removed from the product scope by request. The development Edge Function has been retired and returns HTTP 410; its source has been removed from this repository. A cleanup migration drops the development-only AI usage table and helper/reporting functions. Historical migrations that created those objects remain in Git history and are superseded by the cleanup migration. No provider credentials were configured.

## Owner team invitations
The owner-facing Settings > Team Access tab and its TeamSettings panel have been removed. Platform invitations remain managed from the Super Admin dashboard. Existing institute membership records and backend member-management functions are retained; this UI change does not delete memberships or invitation data.
