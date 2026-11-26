# ClassBandhu — Legal, Consent & Privacy Engineering Implementation Specification
**Version:** 0.4 — consistency and naming revision — development implementation plan  
**Prepared:** 25 November 2026; revised 26 November 2026 (v0.4)  
**Status:** READY FOR TECHNICAL REVIEW; NOT AUTHORISATION TO CHANGE PRODUCTION  
**Repository:** `tirthpatel3118-del/Tuition-MS`  
**Working branch:** `development`  
**Development Supabase:** `avplvplzhaqpnclgzmel`  
**Production Supabase:** `lcuheihzphekphgeszbt` — DO NOT MODIFY  
**Official contact:** info.classbandhu@gmail.com

> **Product names.** *ClassBandhu* is the parent brand. These documents cover **ClassBandhu Tuition**, the ERP for tuition centres, coaching institutes and similar institutes. **ClassBandhu School** (a school ERP) is a separate product and is **not covered** unless and until school-specific versions of these documents are approved and presented. Unless the context requires otherwise, “ClassBandhu” in these documents means the brand and, where the software is meant, ClassBandhu Tuition.

## 1. Objective
Implement a versioned, auditable legal acceptance and privacy workflow in the existing ClassBandhu ERP, based on approved policy documents and verified product behaviour. This specification covers legal acceptance, institute declarations, policy-version enforcement, privacy request intake and engineering controls. The separate public marketing website is deliberately deferred until this workstream is completed.

## 2. Non-negotiable environment controls
- Work only on `development` branch and development Supabase/Netlify first.
- Use synthetic test data only.
- Do not modify production Supabase, production Netlify or `main`.
- Do not merge, release or deploy production without explicit approval.
- Inspect current branch, commit, PR status, migrations, source and development preview before coding.
- Never expose Supabase service-role keys in frontend variables or commit them.
- Do not blindly replay development migrations into production.
- Report each item as source-implemented, migrated to development, tested, preview-deployed or production-released. These are separate states.

## 3. Required legal documents and version registry
Create a server-managed registry for required documents, for example:
- Privacy Policy
- Terms & Conditions
- Acceptable Use Policy
- Institute DPA (mandatory for every Institute workspace)
- Institute creation declarations / Institute terms

Each registry entry should include:
- stable document key;
- semantic version (e.g. `0.1.0` for draft, later approved version);
- title;
- publication/effective date;
- content hash (SHA-256 or an approved equivalent);
- URL/route or stored immutable content reference;
- status (`draft`, `active`, `superseded`, `withdrawn`);
- scope (`account`, `institute`, `platform_admin`);
- whether acceptance is required;
- created/activated by and timestamp.

Only approved documents may be activated. Draft documents must never be presented as binding published terms.

## 4. Acceptance evidence model
Use append-only acceptance records. Suggested schema (adapt after reviewing existing tables and naming conventions):

### `legal_documents`
- `id` UUID primary key
- `document_key` text
- `version` text
- `title` text
- `content_hash` text
- `document_url` text or immutable content reference
- `scope` text
- `status` text
- `effective_at` timestamptz
- `created_at` timestamptz
- `created_by` UUID nullable

Unique constraint: (`document_key`, `version`, `scope`).

### `legal_acceptances`
- `id` UUID primary key
- `user_id` UUID not null
- `institute_id` UUID nullable
- `document_key` text not null
- `document_version` text not null
- `document_hash` text not null
- `acceptance_type` text not null (`terms_acceptance`, `aup_acceptance`, `privacy_acknowledgement`, `dpa_acceptance`, `institute_authority`, `data_authority_attestation`). The first checkbox action creates document-level evidence for each listed document, including the mandatory Institute DPA; this is one user action and one checkbox, not four separate UI controls.
- `accepted` boolean not null
- `actor_role` text nullable
- `source` text (`signup`, `login_gate`, `institute_creation`, `settings`, `admin`)
- `accepted_at` timestamptz server-generated
- `metadata_minimal` jsonb nullable (strict allowlist only)
- no password, auth token, full document copy or unnecessary device fingerprint.

Append-only: authenticated clients must not update/delete acceptance evidence. Inserts should be mediated through a validated RPC or server-side function that verifies current user, document status/version, required scope, institute membership/authority and action. Super Admin may view only minimal acceptance status for platform administration where needed; avoid exposing full personal details unnecessarily.

Do not store IP/device metadata unless counsel and security review demonstrate a need and define a retention period.

## 5. User-facing acceptance design

### 5.1 Account registration
Display links to current Privacy Policy, Terms & Conditions and Acceptable Use Policy.

Required unchecked checkbox:
> I have read and agree to the Terms & Conditions and Acceptable Use Policy, and acknowledge the Privacy Policy.

Important: this is contractual acceptance plus acknowledgement of notice. It is not blanket consent to every processing purpose. Any optional marketing consent must be separate, optional and unchecked by default.

Record separate evidence rows for:
- Terms acceptance;
- AUP acceptance;
- Privacy Policy acknowledgement.

Do not allow account creation to complete without required acceptance evidence.

### 5.2 Existing users and updated versions
After successful authentication but before loading protected ERP data:
1. Fetch active mandatory documents for the user's scope.
2. Compare with acceptance evidence.
3. If any required version is missing/stale, show a full-page review screen.
4. Keep public policy routes, sign-out and privacy/support request routes accessible.
5. Do not load student, institute, payment, attendance or Super Admin data until required acceptance is recorded.
6. On acceptance, record server timestamp and proceed.
7. If the user declines, sign out or remain in a restricted policy-only state.

A front-end route guard alone is insufficient. Enforce access server-side through RLS/RPC checks for sensitive operations and data reads as appropriate. Avoid breaking service recovery, account deletion requests or legal document access.

### 5.3 Institute creation — exactly three distinct confirmations
Before creating a new Institute, require exactly these three mandatory checkboxes. No fourth checkbox, hidden acceptance control or generic accuracy declaration may be added.

1. **Platform policies and mandatory Institute DPA (single checkbox):** “I have read and agree to the current ClassBandhu Terms & Conditions, Acceptable Use Policy and Institute Data Processing Agreement (DPA), and acknowledge the ClassBandhu Privacy Policy.” The UI must list each included document by title and version and provide the full text before acceptance. The DPA is mandatory for every Institute workspace and is part of this first checkbox bundle, not a fourth checkbox. The server records separate document-level evidence for Terms, AUP, Privacy Policy acknowledgement and the Institute DPA, all linked to the same user action and Institute creation event. There is no “no DPA applies” branch.
2. **Authority to create/manage the Institute:** “I confirm that I am authorised to create and manage this institution's account and to provide the institution's information to ClassBandhu for the ERP service.”
3. **Institute authority to provide student/parent data:** “I confirm that, wherever required by applicable law, the institution has obtained the necessary consent or other lawful authorisation from parents or legal guardians for collecting and sharing student personal information with ClassBandhu to provide the ERP service.”

These are the canonical texts. Use them verbatim in the handover, policy/specification and product UI, subject to counsel review. The declaration is not proof of each parent/guardian's consent. The Institute must maintain underlying evidence. Do not add an additional “all records are accurate” checkbox.

### 5.4 Multiple Institutes and owner changes
- Acceptance of account-level terms applies to the user account and document version.
- Institute-specific declarations and DPA acceptance must include the relevant `institute_id`.
- A user joining a second Institute must not inherit the first Institute's authority declaration.
- A new owner does not inherit another person's personal acceptance. The new owner must accept applicable account terms and make the Institute-specific declarations for their own authority.
- Existing memberships must be preserved; do not reintroduce the removed owner Team Access UI.
- Super Admin invitations remain separate and must not bypass legal acceptance.
- Existing Institutes and owner changes follow §5.5.

### 5.5 Existing Institutes, owner changes and transition (mandatory DPA coverage)
Applies to every Institute workspace created before this workflow is activated and to any Institute whose owner changes.
- **Gate:** on an Institute Owner's first login after activation, before that Institute's protected data loads, show an “Institute legal confirmation” step for that Institute. It presents the **same document bundle and the same three canonical declarations, verbatim**, as §5.3 — still exactly three checkboxes, with the DPA inside checkbox 1.
- **Evidence:** record with `source = 'login_gate'`, the owner's `user_id`, the `institute_id`, and each document key/version/hash and declaration, server-timestamped and append-only.
- **Per Institute:** an owner of several Institutes confirms each one separately; nothing is inherited.
- **Who can accept:** only a user holding the owner role for that Institute. Teachers, accountants and other staff accept account-level Terms/AUP/Privacy only. A Super Admin can never accept or declare on an owner's behalf.
- **Owner change:** the incoming owner makes the three confirmations before gaining owner access to protected data. The previous owner's evidence stays unchanged.
- **Transition (proposal — approval required):** until an owner confirms, show an in-app and email notice to the owner for **[N DAYS — TO BE APPROVED]**; staff may continue working during that window. After it, fail closed for the Institute's protected data. Never delete data because confirmation is missing. Policy pages, sign-out, support/privacy request and export-request routes stay available.
- **Suspended Institutes:** confirmation is not needed to use the privacy, deletion-request or export-request route.
- **Tests:** existing owner gated; staff cannot accept; owner change gated; multi-Institute separate; Super Admin cannot bypass; fail-closed after window; routes stay available.

## 6. Server-side enforcement
Implement a reusable server-side check such as `assert_current_legal_acceptance(user_id, institute_id, required_scope)`.

Enforcement requirements:
- validate user identity from trusted auth context;
- check active required document versions;
- verify acceptance records match exact version and hash;
- verify Institute membership and role before accepting Institute-specific declarations;
- verify owner/authorised administrator permissions for Institute creation and DPA acceptance;
- reject direct client attempts to spoof another user, Institute, document hash or timestamp;
- use server-generated timestamps;
- fail closed for protected data access if required acceptance is absent;
- keep legal document reads and sign-out available;
- ensure Super Admin cannot read Institute student/parent data merely because acceptance status is visible.

Review RLS policies, views, SECURITY DEFINER functions and grants individually. Do not apply blanket policies to all tables.

## 7. Privacy requests and grievance intake
Initial channel: `info.classbandhu@gmail.com`.

Create an internal operational register (or secure ticket workflow) with:
- request reference;
- received timestamp;
- requester type (user / Institute / student / parent-guardian / other);
- verified contact and verification status;
- Institute ID, if applicable;
- request category (access, correction, completion, update, erasure, consent withdrawal, grievance, account closure, other);
- responsible party (Institute / Operator / shared);
- assigned owner;
- due date based on approved legal/operational SLA;
- actions and outcome;
- legal hold/retention exception;
- closure timestamp.

Do not publish an unsupported response SLA. Do not request passwords or unnecessary identity documents. Where Institute controls the record, route the request to the Institute and assist as processor.

## 8. Breach and incident response readiness
Before launch, document:
- incident owner and backup contact;
- how reports are received and acknowledged;
- triage severity and affected tenant/data categories;
- containment and credential/session revocation;
- evidence preservation and access logs;
- Supabase/Netlify provider escalation routes;
- decision-maker for legal notifications;
- Institute/customer communications;
- post-incident review and remediation.

Do not hard-code an unverified statutory deadline. Legal counsel must map the currently effective and future-effective DPDP requirements to the incident playbook and keep it updated.

## 9. Development-first implementation phases

### Phase A — source and schema reconnaissance
- Confirm current `development` commit and clean working tree.
- Review existing auth, institute creation, DataContext, services, RLS, RPCs and migrations.
- Check for existing legal/consent tables to avoid duplicates.
- Review every relevant table/view/function and grants.
- Inspect actual active roles and multi-institute membership behaviour.
- Confirm the development Netlify preview.
- Produce a migration plan before modifying schema.

### Phase B — database foundation
- Add document registry and append-only acceptance table.
- Add constraints, indexes and RLS.
- Add validated RPC(s) for acceptance recording and status checking.
- Add immutable content hashes.
- Add minimal admin reporting for document version coverage.
- Add migration rollback/forward-repair plan and synthetic seed documents.
- Test RLS under owner, teacher, accountant, Super Admin and unauthenticated contexts.

### Phase C — signup and login gate
- Add required signup checkbox and links.
- Record separate acceptance/acknowledgement rows.
- Add stale-version gate after authentication and before protected data loads.
- Ensure direct RPC/API access is also blocked where appropriate.
- Ensure policy routes, sign-out and support remain accessible.
- Test session restoration, refresh, multiple tabs and stale acceptance.

### Phase D — Institute creation declarations
- Add the three agreed declarations.
- Validate authority server-side.
- Record each declaration against the new Institute ID and exact document version.
- Test multi-institute users and owner transfer/change.
- Ensure no fourth “all records accurate” checkbox appears.

### Phase E — request/incident operations
- Define internal process before building a complex dashboard.
- Add a restricted privacy request register only if email-only operations are insufficient.
- Add access controls, retention and audit.
- Prepare incident runbook and provider contacts.

### Phase F — verification and release candidate
- Unit tests for version registry and acceptance comparison.
- Integration tests for insert-only evidence and server timestamp.
- RLS tests for cross-tenant and role boundaries.
- Tests for accepted, unaccepted, stale version, changed hash, declined terms, sign-out, multiple Institutes, owner change, invitation acceptance, session restoration and direct API bypass.
- Regression tests for fee, attendance, reminders, Super Admin and billing.
- Run typecheck, lint, test suite and production build.
- Browser-test mobile and desktop preview.
- Verify no legacy EduLedger email/contact details are surfaced in the changed legal UI.
- Keep production untouched.

## 10. Acceptance criteria
The work is complete in development only when:
- [ ] Active approved document versions are centrally registered and immutable.
- [ ] Signup cannot finish without required contractual acceptance.
- [ ] Privacy acknowledgement is distinct from optional consent.
- [ ] Existing users with stale versions are gated before protected data loads.
- [ ] Policy routes and sign-out remain available while gated.
- [ ] Institute creation presents exactly the three agreed declarations.
- [ ] Institute declarations are recorded per Institute and actor.
- [ ] Acceptance evidence is append-only and server-timestamped.
- [ ] Client cannot spoof actor, Institute, version, hash or timestamp.
- [ ] RLS/RPC checks prevent protected-data access without current acceptance.
- [ ] Super Admin access remains restricted from Institute personal data.
- [ ] Multi-Institute, owner-change and invitation flows pass.
- [ ] Existing Institutes: the owner sees a per-Institute three-confirmation gate and DPA evidence is recorded (§5.5).
- [ ] Teachers, accountants and Super Admins cannot accept the DPA or make Institute declarations.
- [ ] Transition period is approved, implemented and tested; no data is deleted for missing confirmation.
- [ ] Regression suite, lint, typecheck and build pass.
- [ ] Development preview is tested and evidence recorded.
- [ ] No production resources are modified.

## 11. Out of scope in this implementation pass
- Public marketing website and demo enquiry form (explicitly last).
- Automated WhatsApp Business Cloud API, automated email or SMS.
- Face recognition or biometric attendance.
- Student/parent portal or direct student login.
- New school/college product lines.
- Production database migrations, production deployment or branch merge.

## 12. Open decisions before activation
- Final counsel-approved policy versions and hashes.
- Operator contracting/invoice identity and tax treatment.
- Applicable privacy/grievance response SLA.
- DPA subprocessor list and provider terms.
- Data retention periods, financial-record retention and backup expiry.
- Export formats and deletion timetable.
- Counsel confirmation that mandatory DPA acceptance bundled into checkbox 1 is legally appropriate and enforceable for every Institute workspace.
- Governing law/forum and liability terms.


- Approve the transition period and notices for existing Institutes and owner changes (§5.5).
- Decide the effective date and wording of the product-name statement for ClassBandhu School.

## 13. Subscription grace-period and suspended-account access requirements (v0.2 reconciliation)
The product rule remains seven calendar days after the subscription due date. Proposed precise calculation for review: due date is day zero; deadline is 23:59:59 IST (Asia/Kolkata) on the seventh calendar day after the due date; weekends/holidays count. Confirm timezone and invoice timestamp semantics before implementation.

- A successful transfer/credit by the deadline, with sufficient transaction evidence submitted by the deadline, must prevent suspension solely due to later manual verification.
- A mere unverified payment claim or screenshot without a verifiable successful transaction is not sufficient proof.
- Partial payment leaves a balance due unless an approved written arrangement applies; identify the balance and notify before suspension.
- A bona fide invoice dispute submitted with reasons before the deadline is routed for review; undisputed amounts remain payable. Pause suspension based only on the disputed portion while review is pending, subject to counsel-approved exceptions.
- Target reminders: around three calendar days before the deadline and on the deadline day where operationally available. Do not claim this is implemented until tested.
- After suspension, ordinary ERP operations may be restricted, but the Institute Owner must retain a verified channel to submit privacy/deletion requests and request an available data export. Define and test an export path; do not promise an unverified format or instant fulfilment.
- Suspension and reversible archive are not deletion. Data remains subject to the approved retention schedule, legal holds and later verified closure/deletion workflow.

These are proposed policy/engineering defaults, not final legal or accounting advice. The Operator, accountant and Indian counsel must approve the timezone, payment evidence rule, partial-payment/dispute handling, notices and export limitations before activation.
