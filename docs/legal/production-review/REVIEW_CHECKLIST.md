# ClassBandhu Tuition — Production Legal Pack Review Notes

**Prepared:** 27 November 2026  
**Status:** Internal review checklist; not a customer-facing legal notice  
**Environment:** Development / Testing only  
**Production changes:** None

## Documents prepared
1. Terms & Conditions — 1.0-review
2. Privacy Policy — 1.0-review
3. Acceptable Use Policy — 1.0-review
4. Institute Data Processing Agreement — 1.0-review

All four drafts are to remain database status draft and is_test_only=true. Do not publish them or expose them as current customer terms until approval gates are complete.

## Product facts carried into the drafts
- Product scope is ClassBandhu Tuition only; ClassBandhu School is separate.
- Operator details presently confirmed in the project draft: Tirth Patel, individual operator; contact info.classbandhu@gmail.com. Legal entity and postal/service address are not confirmed.
- Subscription billing is manually collected; monthly and yearly cycles are contemplated. Pricing, tax, refund and invoice-issuer details require approval.
- Project draft describes a seven-calendar-day grace period as a proposed operational rule; confirm the live billing implementation and commercial approval before making it binding.
- WhatsApp reminder workflow is manual/user-initiated. Automatic WhatsApp Business API, email and SMS sending are not represented as current features.
- Face recognition/biometric attendance is not represented as a current feature.
- Known infrastructure: Supabase and Netlify; Gmail is the published support/contact channel; WhatsApp is an external user-initiated messaging service.
- Supabase Primary and Testing project metadata checked 27 November 2026 reports database region ap-northeast-1 (Tokyo). This does not establish all backup, log, support-access or Netlify locations.

## Legal framework timing checked 27 November 2026
- DPDP Act, 2023: G.S.R. 843(E), 13 November 2025, appoints staggered commencement dates. The core sections 3–17 and associated substantive provisions are in the eighteen-month group, calculated as 13 May 2027. Section 6(9), section 27(1)(d) and Rule 4 are in the one-year group calculated as 13 November 2026. Confirm no later Gazette changes before publication.
- DPDP Rules, 2025: G.S.R. 846(E), 13 November 2025, also uses staggered commencement. Rules 3, 5–16, 22 and 23 are in the eighteen-month group calculated as 13 May 2027; Rule 4 is in the one-year group calculated as 13 November 2026.
- DPDP (Removal of Difficulties) Order, 2026, S.O. 5458(E), published 6 October 2026, corrects wording in sections 9(1) and 10(2)(c)(ii). It does not change the staggered commencement schedule.
- IT Act, 2000 section 43A and the 2011 SPDI Rules should be assessed during the transition because the DPDP Act section 44(2) amendment group is scheduled for the eighteen-month commencement phase. Counsel must confirm applicability to the actual Provider/Institute roles and data processed.
- CERT-In Directions of 28 April 2022 include 6-hour incident reporting and 180-day log-retention/location requirements for covered entities. Counsel and security reviewers must decide which obligations apply to ClassBandhu, its providers and its service arrangements. Do not assume a Tokyo database location alone answers where logs must be stored.

## Mandatory review blockers before publishing
1. Confirm the contracting operator's legal identity, business status, service address and required public disclosures.
2. Confirm final canonical public website and application domains.
3. Verify exact product feature list in Production and update any mismatch.
4. Approve pricing, GST/tax treatment, invoice issuer, payment methods, cancellation/refund and grace-period rules.
5. Approve support channels, operating hours, response targets and grievance procedure.
6. Complete data inventory against Production tables, website forms, application telemetry, analytics, cookies and support processes.
7. Confirm Data Fiduciary/Processor allocation for each processing purpose.
8. Obtain and review current Supabase, Netlify, Google/Gmail and other vendor DPAs, sub-processors and regional processing details.
9. Reconcile Tokyo Supabase database region and all logs/backups/support locations with applicable Indian transfer/localisation requirements, including CERT-In where applicable.
10. Approve retention schedule by data category: students, attendance, fees/receipts, enquiries, access requests, invitations, audit/security logs, backups and support communications.
11. Verify security controls before making contractual representations: RLS/tenant isolation, privileged support access, encryption, secrets, logging, backups, incident response and export/deletion.
12. Approve rights-request process, identity verification, escalation and response service levels.
13. Approve DPA processing schedule, sub-processor terms, incident cooperation, audit process, return/deletion and liability.
14. Confirm child-data/parental-authority processes and the exact legal effect of educational-institution exemptions, if any.
15. Legal counsel to review liability, indemnity, governing-law venue, contract formation, e-acceptance, consumer/e-commerce obligations and any statutory disclosures.
16. Recheck the Gazette and applicable law immediately before publication and before 13 May 2027.

## Publication controls
- Do not set status to published or is_test_only to false in this review phase.
- Do not change Primary/Production Supabase legal-document records.
- Do not publish test-only drafts copied from the old v0.4 documents.
- After written approval, create new final versions with an approved effective date and content hash; do not silently overwrite historical versions.
- Test acceptance evidence (actor, document ID/version/hash, scope, timestamp, source) in Development before any Production publication.

## Official / primary legal sources consulted
- Gazette of India, G.S.R. 843(E), 13 November 2025 — https://egazette.gov.in/WriteReadData/2025/267647.pdf
- MeitY, Digital Personal Data Protection Rules, 2025, G.S.R. 846(E), 13 November 2025 — https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa
- Gazette of India, S.O. 5458(E), Digital Personal Data Protection (Removal of Difficulties) Order, 2026 — https://egazette.gov.in/WriteReadData/2026/276885.pdf
- MeitY, IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, G.S.R. 313(E) — https://meity.gov.in/sites/upload_files/dit/files/GSR313E_10511%281%29.pdf
- CERT-In Directions, 28 April 2022 — https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf

This checklist is not a legal opinion. Qualified Indian counsel must approve the final documents and applicability analysis.