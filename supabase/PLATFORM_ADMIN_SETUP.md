# EduLedger Platform Administration (Development)

This feature is implemented in source code and a database migration. It is not active until the migration and Edge Function are deployed to a dedicated development Supabase environment and the first platform administrator is provisioned.

## Security model

- Exactly one platform administrator is allowed by the singleton primary key in private.platform_admins.
- Platform admin access is checked server-side by private.is_platform_admin() and private.require_platform_admin().
- Platform admin RPCs return institute metadata and aggregate counts only. They do not return student, guardian, attendance, fee, payment, receipt, or staff email details.
- Private platform tables have RLS enabled and no direct grants to anon or authenticated. Management is through guarded SECURITY DEFINER RPCs.
- The service-role key is used only inside the platform-admin-invitation Edge Function. It must never be added to browser environment variables.
- New Auth users are accepted only when an unexpired invitation exists. Existing institute invitations are retained for owner-managed team onboarding.
- A platform-issued owner invitation with no institute grants permission to create one institute. Teacher/accountant invitations always require a target institute.
- Institute suspension or subscription expiry is enforced through the central private.is_member_of() helper used by existing tenant RLS policies.

## Dashboard information and privacy

The dashboard shows:
- Institute name/workspace slug and creation date.
- Aggregate student count.
- Aggregate owner, teacher, accountant and total team-member counts.
- Unique team accounts active in the previous 30 days, including role breakdowns.
- Subscription plan/status, expiry, access status and optional plan limits.
- Whole-project PostgreSQL database size and whole-project Storage object size/count.

The dashboard does not expose student names, guardian details, student contact details, individual staff email addresses, fee/payment/receipt records, attendance content, or uploaded file contents.

Supabase database and Storage usage are shared at project level. The dashboard does not claim exact per-institute storage or bandwidth attribution. Student sign-in counts are not available because students do not currently have login accounts. Member activity is tracked when a signed-in owner, teacher or accountant loads the app.

## Development deployment steps

1. Use a dedicated development Supabase project or Supabase development branch. Do not apply this migration to the production project during development.
2. Apply migrations in sequence, including 20261118170000_platform_admin_and_invite_only_onboarding.sql.
3. Deploy supabase/functions/platform-admin-invitation/index.ts with JWT verification enabled.
4. Configure the Edge Function secret EDULEDGER_APP_URL to the exact development app origin (for example, the development Netlify URL). SUPABASE_URL, SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY must be supplied by Supabase function runtime secrets. Never copy service-role credentials into the client.
5. Provision the single administrator using the exact existing Supabase Auth user ID (UUID). The administrator account must already exist in that development Auth project.
6. Confirm the RPC is_platform_admin() returns true only for that one account and false for a normal account.
7. Test invitation creation, link activation, password creation, owner institute setup, team invitation acceptance, expiry/revocation, subscription changes, suspension and RLS access using only synthetic development data.
8. Verify a non-admin receives access denied from every platform admin RPC and Edge Function.
9. Run the app build, lint, and test scripts before considering production release.

## Provisioning the one platform administrator

Run this only in the intended DEVELOPMENT database after the administrator's account has been created in that same Supabase Auth project. Replace the placeholder with the exact email address belonging to the designated admin account. This statement cannot create a user and inserts zero rows if the email is not found.

```sql
INSERT INTO private.platform_admins (singleton, user_id)
SELECT true, u.id
FROM auth.users AS u
WHERE lower(u.email) = lower('REPLACE_WITH_EXACT_ADMIN_EMAIL')
ON CONFLICT (singleton) DO NOTHING;

SELECT a.singleton, a.user_id, u.email, a.created_at
FROM private.platform_admins AS a
JOIN auth.users AS u ON u.id = a.user_id;
```

The verification query must return exactly one row for the designated account. If it returns no row, stop and verify the email and project. If it returns a different account, stop; do not replace the row without a controlled admin recovery procedure.

## Current development limitations

There is no separate Supabase development database connected in the current environment. The production project is not a safe test target for this migration. Consequently, repository CI and source-level security tests can be run now, but database/Edge Function end-to-end tests must wait until a development Supabase environment is connected and the single development admin is provisioned.

The migration intentionally does not create test institutes, users, students, fees, payments or attendance records.
