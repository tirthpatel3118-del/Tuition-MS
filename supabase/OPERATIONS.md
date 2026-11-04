# EduLedger database backup and cutover runbook

This runbook is for the legacy Supabase project that already contains EduLedger data. The v2.4 migrations are candidates until the backup, isolated restore, parity checks, and security checks below pass. **Do not run them against production as the first validation.**

## 1. Capture a restorable backup

1. Schedule a maintenance window and record the source project ref and backup time. Avoid schema or data changes during the export so the schema and data dumps describe the same baseline.
2. Use the Supabase Dashboard's **Connect** page to obtain the database connection string. Keep the database password in a secret manager or a temporary environment variable; never commit it, paste it into a ticket, or include it in command output.
3. On a trusted workstation with the Supabase CLI, Docker, and `psql` installed, create a private backup directory outside the repository. The CLI runs `pg_dump` in a container and excludes Supabase-managed schemas such as `auth` and `storage`.
4. Export the application schema and data as separate files:

   ```sh
   supabase db dump --db-url "$EDULEDGER_SOURCE_DB_URL" -f ./private-backup/schema.sql
   supabase db dump --db-url "$EDULEDGER_SOURCE_DB_URL" --data-only --use-copy -f ./private-backup/data.sql
   ```

5. Keep these files access-restricted and encrypted at rest. Record file sizes and SHA-256 checksums in a separate backup manifest. The dumps contain student and financial personal data. Do not place them in Git, cloud preview services, or this repository.
6. This database dump does not include Storage objects. Inventory buckets and objects separately; the last verified live inventory was empty. Recheck before treating that as current.

The current linked project is on the Free plan, so do not assume a scheduled downloadable backup is available. Supabase documents daily dashboard backups for Pro, Team, and Enterprise; for Free projects it recommends the CLI dump. Its “restore to a new project” workflow requires paid-plan physical backups and has separate project costs. A Supabase development branch is not a data clone.

## 2. Restore into an isolated environment

Use either a local Supabase stack on a trusted workstation or a separately approved, isolated Supabase project. Never use the production project as the restore target. If using a cloud project, confirm its ongoing cost and restrict access before sending any data to it.

Restore `schema.sql` and `data.sql` to the isolated database using `psql` with `ON_ERROR_STOP` and a single transaction where supported. Use the Supabase CLI's documented restore procedure for the chosen target. The destination must be a clean Supabase environment with its managed `auth` and `storage` schemas intact; the CLI dump intentionally excludes those schemas. Create a disposable, confirmed test Auth user in that environment for owner-bootstrap testing rather than copying production credentials.

Keep the production export, restore, and test environment on a machine and account authorized to hold student records. Delete the temporary export and isolated project only after the verification evidence has been retained and reviewed; retain an encrypted backup manifest and checksums according to the institution's retention policy.

## 3. Verify baseline parity before migrations

Run [`preflight/202611_v2_4_baseline.sql`](preflight/202611_v2_4_baseline.sql) against both the source and isolated restore. Compare its aggregate counts, integrity checks, payment-link classifications, installment status counts, and policy definitions. It does not return student or payment rows. Stop if any count or financial total differs; restore again from a consistent export and investigate before proceeding.

A previous read-only production check found legacy application tables and no migration history. Keep all live row counts, financial totals, and student-level details in access-controlled audit records; do not commit production-specific data to this repository. Re-run the aggregate baseline report against both source and isolated restore, and compare the results privately before proceeding.

## 4. Reconcile the migration baseline on the isolated copy

The legacy schema already exists even though the live Supabase migration history is empty. Therefore:

1. Compare the restored legacy schema with [`migrations/20260706000000_init_schema.sql`](migrations/20260706000000_init_schema.sql). Do not replay that initialization migration over existing tables. The 2026-11-04 read-only production inventory found the two views `student_balances` and `outstanding_students`, but no `settings` table; this migration also creates `settings` and a public CRUD policy for it. That is a verified baseline mismatch. Do not claim exact parity or mark this migration applied until the isolated restore has an explicit, reviewed reconciliation decision for `settings` (either add it through a separate reviewed migration if it is required, or correct the historical migration only after confirming it has not been used by another environment). Never replay this init migration on the existing database.
2. Only after confirming and recording that baseline reconciliation on the isolated target, repair migration bookkeeping there to mark the legacy baseline version as already applied. This is migration-history bookkeeping; it does not create or repair schema objects.
3. Apply the seven v2.4 migrations in timestamp order, from `20261103192012_foundation_and_helpers.sql` through `20261103192020_enforce_strict_rbac_rls.sql`. Stop on the first SQL error and restore a fresh isolated copy before retrying.
4. After migrations 1–5, run [`reports/20261104_historical_reconciliation.sql`](reports/20261104_historical_reconciliation.sql). Verify total payment amounts equal the verified allocation totals, and review aggregate counts for `UNVERIFIED_HISTORICAL_ALLOCATION` and `UNVERIFIED_HISTORICAL_PAID_STATUS`. The migration preserves legacy paid statuses without proof. The payment RPC blocks collection against unresolved installment links or paid balances, and blocks new collections for a student with an unallocated legacy payment until it is reconciled or documented as reversed. Do not force ambiguous history into allocations.
5. Confirm course rates from an authoritative business record. The live schema has no trusted course-level fee source; migration 3 preserves unknown course fees as `NULL`. Never infer or invent rates from sample/demo data.

## 5. Bootstrap and test the owner before the RLS cutover

1. In the isolated environment only, create and confirm a disposable Auth user, then link that user as `owner` to the migrated institute `00000000-0000-0000-0000-000000000001`.
2. Sign in through the app with that user and verify the institute workspace loads before applying migration 7. Migration 7 fails closed unless that institute and an owner membership exist.
3. Exercise the approved role matrix with separate test users: owner, accountant, teacher, and a user with no membership. Verify cross-institute reads and writes are denied; teacher access is limited to the academic roster; direct ledger writes are denied; payment recording is atomic and idempotent; reversal preserves the original ledger; and concurrent receipt allocation remains unique.
4. Review Supabase security and performance advisors after the migrations. Resolve or document each finding, including foreign-key indexes and function exposure.

Do not copy test credentials or test-user IDs into migration files. Do not mark the cutover ready until each test has a recorded result.

## 6. Production release gate and recovery

Production remains unchanged until the following evidence is reviewed together: a verified backup and checksum manifest; source/restore baseline parity; successful isolated migration run; historical reconciliation; confirmed course rates; owner sign-in; role-isolation, ledger, idempotency, reversal, and concurrency results; advisor review; and a successful deployment preview.

Before the eventual production cutover, take a fresh backup, confirm a recovery owner can sign in, and prepare a maintenance window. Resolve the legacy migration-history mismatch deliberately; never run a normal `supabase db push` while it would replay `20260706000000_init_schema.sql`. Apply the reviewed v2.4 migrations in order, then immediately run the aggregate post-migration reconciliation and verify owner login. Keep the app release gated until those checks pass. If production validation fails, stop further changes and restore from the verified pre-cutover backup using the approved recovery procedure; do not improvise inverse SQL against financial history.

## Supabase documentation

- [Database backups](https://supabase.com/docs/guides/platform/backups)
- [Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI `db dump`](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations)

## 7. Current live checkpoint (read-only, 2026-11-04)

A fresh Supabase MCP inspection confirmed that the production project still has the five legacy application tables and an empty migration history. Row-level security is enabled on those tables, but each has a `PUBLIC` `ALL` policy with unrestricted `USING (true)` and `WITH CHECK (true)`. RLS being enabled does not make this access model private. Do not point an unauthenticated app at this project.

The same inspection found no development branches in the Free-plan organization. Security advisors still flag the public `public.rls_auto_enable()` SECURITY DEFINER function and disabled leaked-password protection; performance advisors flag three unindexed legacy foreign keys. These findings are audit evidence only and are not authorization to change production.

No production DDL, data, policies, auth configuration, or migration history was changed during this inspection. Continue with the backup and isolated-restore steps above before applying or validating schema changes. Keep student-level records, amounts, and contact details out of Git; the live preflight should remain aggregate-only.
