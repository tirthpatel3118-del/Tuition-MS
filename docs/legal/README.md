# ClassBandhu Tuition — Legal & Implementation Pack

**Current revision:** v0.4 (Privacy Policy v0.10) — internal working drafts, revised 26 November 2026.
**Not approved for publication or signature. Not legal advice.**

**Operator:** Tirth Patel (individual) · **Contact:** info.classbandhu@gmail.com
**Names:** ClassBandhu = parent brand · **ClassBandhu Tuition** = this ERP (covered) · **ClassBandhu School** = separate product (not covered).

## Documents
| # | Document | Version |
|---|---|---|
| 01 | Terms & Conditions | 0.4 |
| 02 | Institute Data Processing Agreement | 0.4 |
| 03 | Acceptable Use Policy | 0.4 |
| 04 | Data Retention & Deletion Schedule | 0.4 |
| 05 | Legal Consent Implementation Specification | 0.4 |
| 06 | Privacy Policy Draft | 0.10 |

Older versions: `archive_v0.1/`, `archive_v0.2/`, `archive_v0.3/`.

## Changes in v0.4
1. Product names defined; documents scoped to ClassBandhu Tuition.
2. "Gujarat" removed from the business-day definition.
3. DPA route for existing Institutes and owner changes (Terms §8.4, DPA §15.1, Spec §5.5).
4. Privacy Policy renumbered and aligned (DPA mandatory, acceptance records, suspension, platform admins).
5. All versions aligned; Spec duplicate section number fixed.

## Locked decisions (consistent in every document)
Exactly three Institute checkboxes (DPA inside checkbox 1, no fourth) · no "all records accurate" checkbox · 7-day grace period, then suspension, never automatic deletion · deletion requests by email · no student/parent login · manual WhatsApp reminders · manual attendance · no postal address published.

## Still open (needs approval)
Counsel: DPDP roles, child data, bundled DPA acceptance, dispute clause, liability, breach workflow, retention, cross-border, forum. Accountant: GST, invoices, refunds. Operator: prices, billing rules, transition period for existing Institutes, response SLA. Technical: backups, export/deletion, subprocessors, locations. Still to draft/approve: parent/guardian notice, website enquiry notice, cookie policy (if needed). An initial Privacy Requests page is now present in the development website with email links for privacy questions, access/export and deletion requests. Internal request registration, verification/fulfilment workflow and response SLA are not yet operationally approved.

## Development implementation status (26 November 2026)

The v0.4 / Privacy Policy v0.10 draft bundle is staged in Testing Supabase and the development Netlify branch preview. The website includes public Terms, AUP, Privacy Policy and DPA routes; invitation signup acceptance; the three Institute confirmations; current-owner-specific Institute evidence; a 14-day review window for existing owners in development; and an email-based Privacy Requests page. Super Admin legal evidence responses no longer include account email or browser/user-agent fields.

All four documents are marked TEST ONLY. This is a technical staging review, not legal approval or production publication. The development CI build, lint and regression suite passed. The privacy request page is an intake link only; there is no automated request register, export fulfilment or deletion workflow yet.

Production Supabase, production Netlify and GitHub main remain untouched.
