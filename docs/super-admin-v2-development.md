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
