# Super Admin development notes

## Current scope
- Platform institute management and platform-admin invitations remain in the Super Admin dashboard.
- Subscription and platform billing workflows remain in the Super Admin dashboard.
- Action Centre alerts cover overdue invoices, upcoming subscription expiries and pending platform invitations.
- Monthly platform analytics report institute registrations, student registrations and recorded platform subscription revenue.
- Service checks cover the signed-in administrator session and platform-admin database authorization.

## Removed by product decision
- OpenAI Copilot is not part of the product.
- Google OAuth is not part of the product; standard invited email/password sign-in remains.
- The development AI Edge Function endpoint is retired and returns HTTP 410. Its source has been removed from this repository.
- Development-only AI usage table and helper/reporting functions were dropped by migration `20261120134231_remove_platform_ai_copilot.sql`.
- Historical migrations that created the AI objects remain in migration history and are superseded by the cleanup migration.

## Owner-facing team invitations
The owner-facing Settings > Team Access tab and its TeamSettings panel have been removed. Platform invitations are managed by the Super Admin. Existing institute membership records and backend member-management functions are retained; this UI change does not delete memberships or invitation data.

## Analytics
Migration `20261120130017_platform_admin_monthly_analytics.sql` provides a Super Admin-only 12-month series of institute registrations, student registrations and collected platform subscription revenue. The RPC was verified under the development Super Admin JWT context and returned 12 month buckets.

## Before production
- Review the complete release diff and migration history.
- Run build, lint, all regression scripts, browser flows and authorization tests.
- Verify the Super Admin-only institute invitation and platform billing workflows.
- Confirm that institute owners do not see the Team Access invitation tab.
