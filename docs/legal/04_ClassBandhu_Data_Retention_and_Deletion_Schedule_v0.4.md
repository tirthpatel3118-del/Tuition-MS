# ClassBandhu — Data Retention & Deletion Schedule
**Version:** 0.4 — consistency and naming revision — proposed operational schedule  
**Prepared:** 25 November 2026; revised 26 November 2026 (v0.4)  
**Status:** INTERNAL DESIGN DRAFT — PERIODS NOT APPROVED  
**Owner:** Tirth Patel  
**Contact:** info.classbandhu@gmail.com

> Important: this schedule intentionally separates proposed operational targets from periods that must be determined by law, accounting advice, Institute instructions or provider configuration. Do not publish a fixed deletion promise or implement automatic deletion until the periods, legal holds, backups and technical deletion paths are verified.

## 1. Principles
1. Collect and retain only what is necessary for a documented purpose.
2. The Institute determines retention for Institute-controlled educational records, subject to law and the service contract.
3. ClassBandhu separately determines retention for its own account, security, subscription, support and business records, subject to law.
4. Do not delete financial or audit history merely to simplify an account closure.
5. Suspension for non-payment is reversible and is not deletion.
6. Deletion from the active database is not necessarily immediate deletion from provider backups, logs or disaster-recovery copies.
7. Apply legal holds and preserve evidence when reasonably necessary for legal claims, fraud/security investigations or statutory obligations.
8. Restrict access to data retained for an exception and delete it when the exception ends.

## 2. Proposed schedule
All periods below are proposals for operational discussion, not approved legal conclusions.

| Data category | Examples / source | Purpose | Proposed trigger and retention | Decision / verification required |
|---|---|---|---|---|
| Student profile and admission data | Name, roll no, parent name/contact, student mobile/email, address field, course/batch, admission date, fee and status | Institute administration | During active Institute use; after termination, export then delete/return according to Institute instruction and applicable law | Institute must choose education-record retention; confirm legal duties and export/deletion support |
| Attendance records | Date, status, student/batch refs, marker and correction audit | Attendance and dispute resolution | Institute-defined period; preserve correction/audit context with the record | Confirm any education-sector retention rules; do not assume one universal period |
| Tuition payment and allocation records | Amount, date, mode, allocation, reversal, remarks | Fee accounting, receipts and reconciliation | Retain for period advised by accountant/tax counsel and any dispute/legal hold | Obtain applicable Indian tax/accounting retention advice; preserve financial integrity |
| Receipts and invoice records | Receipt numbers, invoice data, payment references | Proof of payment and accounting | Same or longer than related financial records where required | Confirm tax status, invoice issuer, applicable statutory retention |
| Fee reminder logs | Student ID, amount due, channel, status, provider ref, timestamps | Reminder history and troubleshooting | Proposed 12 months after last relevant reminder, unless linked to dispute or Institute instruction | Confirm business need; avoid retaining message content/phone data unnecessarily |
| Institute profile | Name, settings, logo/signature URLs | Workspace operation | Active term; delete/return on closure subject to accounting/legal exceptions | Verify external URL hosting and deletion responsibility |
| User account data | Name, email, auth identifier, status | Authentication and account management | While account active; after closure, proposed 24 months for security/dispute records, then delete or anonymise where feasible | Confirm actual account deletion flow and legal basis |
| Invitation records | Invited email, role, token metadata, status, actor/timestamps | Access provisioning and security | Expired/used invitations: proposed 12 months after expiry/use; active invitations until expiry/revocation | Confirm token payload, logs and actual expiry |
| Subscription and platform invoices | Institute, plan, billing period, amount, payment status, billing contact | SaaS billing/accounting | Statutory/accounting period advised by accountant; preserve disputed invoices under legal hold | Confirm tax registration and applicable retention rules |
| Platform admin and security audit events | Actor, action, target, timestamps, minimal metadata | Security, accountability and fraud prevention | Proposed 12 months, longer only for incident/legal hold | Confirm audit fields and whether IP/device data exists; minimise metadata |
| Support and privacy requests | Requester contact, verification outcome, correspondence | Support, rights handling, grievance response | Proposed 24 months after closure of request; longer for dispute/legal hold | Confirm actual ticket/email storage and access |
| Legal acceptance and declaration evidence | User ID, Institute ID where relevant, document key/version/hash, declaration type/result, server timestamp, source and minimal approved metadata | Demonstrate which version of contractual terms/policies/declarations was accepted; resolve disputes and meet legal/accountability duties | Retain only as long as reasonably necessary for the relevant contract, statutory/accountability duties and potential claims. Review at account/Institute closure or when the relevant document is superseded. Keep append-only evidence access-restricted. On a deletion request, assess whether a minimal record must be retained; remove unnecessary metadata and delete/anonymise when no longer necessary. No fixed period is approved. | Counsel to approve lawful basis, retention trigger/period and fields; define access roles and deletion process. No raw passwords, tokens, full device fingerprints or unnecessary IP/location data. |
| Archived or suspended Institute data | Reversibly archived Institute workspace and associated operational records | Preserve data during reversible suspension/archive and enable restoration, export or closure processing | Archive/suspension is not deletion. Retain while reversible state is active and through the approved closure/export period; then apply category-specific deletion/retention rules and legal holds. | Define maximum archive duration, owner notification, restoration and closure workflow; do not equate archive with indefinite retention. |
| Migration anomalies / legacy payloads | Anomaly descriptions, raw payloads, old-to-new mappings | Data migration integrity and troubleshooting | Delete after migration validation and approved reconciliation period; proposed maximum 90 days after sign-off unless unresolved issue/legal hold | High priority: inspect whether raw payloads include personal data; no blanket retention |
| Website demo enquiries | Name, institute, role, email, optional phone/city/message | Respond to demo request | Not currently confirmed implemented. Proposed 12 months after last contact, then delete unless converted to customer or legal hold | Website is deferred; define table, access, email notification and deletion before launch |
| Backups and recovery copies | Provider database backups/snapshots | Recovery and resilience | According to verified provider plan/configuration and backup expiry; no period promised yet | Obtain Supabase/Netlify terms, project settings and restore/deletion behaviour |
| Aggregated/anonymised analytics | Non-identifying counts and metrics | Platform operations | Retain only if truly anonymised and not reasonably re-identifiable | Confirm aggregation method and source fields |

### 2.1 Legal acceptance evidence — specific rule
Legal acceptance evidence is not ordinary student/Institute content and must not be deleted automatically just because an account or Institute requests erasure. Keep only the minimum evidence needed to demonstrate the actor, Institute (where applicable), exact document version/hash, declaration type/result, server timestamp and acceptance source. Do not preserve raw passwords, authentication tokens, full device fingerprints or unnecessary IP/location metadata. At closure or on a deletion request, conduct a documented necessity and legal-basis review: retain a minimal, access-restricted record only while needed for a legal/accountability purpose; remove unnecessary metadata; and delete or irreversibly anonymise the record when that purpose and any legal hold end. The final retention period and lawful basis require Indian counsel approval. Append-only at the application level does not mean data must be retained forever or that statutory erasure duties can be ignored.

Evidence of a previous Institute Owner's acceptance and declarations is kept as part of the Institute's history when ownership changes; a new owner's acceptance is recorded separately and never overwrites it. This schedule covers ClassBandhu Tuition only; ClassBandhu School needs its own schedule, including stricter child-data review.

## 3. Account and Institute closure workflow
1. Receive request at `info.classbandhu@gmail.com` from the registered Institute Owner email or other verified authorised contact.
2. Verify requester identity and authority. Do not request passwords. Avoid unnecessary identity documents.
3. Identify all linked Institute workspaces, users, subscriptions, invoices, student data and pending disputes.
4. Ask the Institute to export records it needs, where export is available. Do not promise a format until verified.
5. Check legal/accounting retention, security investigations, disputes and legal holds.
6. Disable invitations and revoke user access as appropriate.
7. Distinguish:
   - **Suspension:** reversible access restriction; data preserved.
   - **Archive:** reversible operational state; not permanent deletion.
   - **Termination:** end of service; export/return/deletion handled under contract.
   - **Permanent deletion:** irreversible deletion after verification, retention review and approved workflow.
8. Delete or return eligible active-system data according to approved timetable.
9. Record completion, exceptions, retained categories and deletion job result.
10. Handle backup copies according to verified provider expiry/deletion capabilities; do not claim immediate erasure from all backups.

## 4. Student/parent data request workflow
1. Direct the request to the Institute where it controls the student record.
2. Verify identity and parental/lawful-guardian authority proportionately.
3. Record request type, date, Institute, affected data categories and verification status.
4. The Institute decides the legal response; ClassBandhu assists where acting as processor.
5. Apply corrections/deletion only after authorised instructions and checks for financial/audit/legal exceptions.
6. Record completion or reason for refusal/limitation.

## 5. Legal hold
A legal hold may pause deletion for identified data where reasonably necessary for litigation, a complaint, fraud investigation, security incident, regulatory inquiry or statutory retention. The hold must:
- identify the data categories and reason;
- be approved by the responsible person/counsel;
- restrict access to those who need it;
- be reviewed periodically;
- be lifted when no longer required, followed by normal deletion.

## 6. Required technical controls before activation
- Inventory every table, view, storage bucket, log, email store, provider backup and export path.
- Map each data category to database tables/columns and owning Institute.
- Implement deletion/retention jobs only after legal and technical review.
- Use tenant-scoped deletion with foreign-key and financial-ledger safeguards.
- Preserve immutable/append-only legal acceptance and financial audit evidence where necessary.
- Add dry-run mode, row counts, audit records and reversible staging where possible.
- Ensure service-role credentials remain server-side.
- Verify backup retention and restore behaviour with provider settings.
- Test with synthetic development data only.
- Never run destructive retention jobs in production without separate written approval.

## 7. Approvals required
- [ ] Accountant confirms tax/accounting retention for invoices, receipts and payment records.
- [ ] Indian counsel confirms applicable statutory retention, child-data requirements and rights process.
- [ ] Institute contract defines who selects student/attendance retention.
- [ ] Operator approves proposed 12/24-month operational targets or replacements.
- [ ] Supabase and Netlify backup/log retention verified.
- [ ] Migration anomaly payload review completed.
- [ ] Email/support mailbox retention reviewed.
- [ ] Counsel approves legal-acceptance evidence lawful basis, minimum fields, retention trigger/period and deletion exception.
- [ ] Suspension workflow preserves a verified privacy/deletion-request route and an available export-request route.
- [ ] Deletion and export workflows tested in development.
