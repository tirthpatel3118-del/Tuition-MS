# ClassBandhu — Institute Data Processing Agreement (DPA)
**Version:** 0.4 — consistency and naming revision — internal working draft  
**Prepared:** 25 November 2026; revised 26 November 2026 (v0.4)  
**Status:** NOT APPROVED FOR SIGNATURE  
**Proposed provider:** Tirth Patel, individual operator of ClassBandhu  
**Contact:** info.classbandhu@gmail.com

> This draft assumes a common SaaS arrangement in which the Institute determines the purposes and essential means of processing student/parent/staff records and ClassBandhu processes those records to provide the ERP. This is not automatically true for every data category or purpose. Indian counsel must validate the roles, statutory terminology, contract structure and actual provider terms before signature.

## 1. Parties and relationship
This DPA is between:
- **Institute / Customer:** the organisation identified in the applicable order, workspace or acceptance record (**Institute**); and
- **Service Provider:** Tirth Patel, operating ClassBandhu (including ClassBandhu Tuition) as an individual (**Provider**).

This DPA covers **ClassBandhu Tuition** only. ClassBandhu School, if launched, requires its own or an updated DPA.

The Institute and Provider are each a **Party** and together the **Parties**.

This DPA supplements the ClassBandhu Terms & Conditions. It applies only to personal data the Provider processes on behalf of the Institute for providing the subscribed Platform services (**Customer Personal Data**). It does not automatically govern data for which the Provider independently determines the purpose and means, such as its own account administration, platform subscription billing, security and direct support records.

## 2. Roles and scope
2.1 The Institute is expected to act as the Data Fiduciary/controller for Institute Data where it decides why and how student, parent/guardian, staff and educational-administration information is processed.

2.2 The Provider acts as a Data Processor/service provider only to the extent it processes Customer Personal Data on the Institute's documented instructions and does not determine an independent purpose.

2.3 If the Provider determines purposes for a particular processing activity, the Parties must document that activity and the Provider's independent role in the Privacy Policy or a separate notice. Labels in this DPA do not override the actual facts or applicable law.

2.4 The Provider will process Customer Personal Data to host, operate, secure, maintain and support the Platform; enable authorised Institute users to manage courses, batches, student admissions, profiles, fees, payments, receipts, attendance and reminders; and perform other functions expressly enabled and instructed by the Institute.

## 3. Processing details
The processing particulars are set out in Annex 1 and may be updated by written agreement or a versioned annex.

## 4. Institute instructions and responsibilities
4.1 The Provider will process Customer Personal Data only on documented instructions from the Institute, including instructions arising from authorised user actions and configuration of the Platform, unless applicable law requires otherwise. If legally permitted, the Provider will inform the Institute of such legal requirement before processing.

4.2 The Institute is responsible for:
- determining and documenting lawful purposes and legal bases;
- providing legally required notices to students, parents/guardians, staff and other data subjects;
- obtaining and retaining consent/authorisation where required, including verifiable parent/lawful-guardian consent where applicable;
- ensuring that its workspace users are authorised and assigned appropriate roles;
- ensuring data is relevant, accurate and not excessive;
- responding to requests from data subjects where the Institute is the responsible Data Fiduciary;
- deciding retention periods for Institute records, subject to applicable law and the agreed service capabilities;
- maintaining independent evidence of consent/notice/authorisation where required.

4.3 An Institute Owner's declaration that the Institute has authority and has obtained required permissions is a contractual attestation only. It does not constitute the parent's or guardian's consent and does not mean the Provider has independently verified each consent record.

## 5. Confidentiality and personnel
5.1 The Provider will ensure that persons authorised to access Customer Personal Data are subject to appropriate confidentiality obligations.

5.2 Access by the Provider will be limited to what is reasonably necessary for service delivery, support, security, maintenance and legal compliance, and will be subject to access controls appropriate to the risk.

5.3 The Provider will not sell Customer Personal Data or use it for unrelated advertising. Any separate analytics or product-improvement use involving personal data must be assessed, disclosed and legally supported before implementation.

## 6. Security measures
6.1 The Provider will implement and maintain reasonable technical and organisational measures appropriate to the nature of the data and risks, taking account of the actual architecture and available controls.

6.2 The current architecture identified for ClassBandhu includes Supabase/PostgreSQL, Supabase Auth, row-level security (RLS), role checks and database functions/RPCs, with the web application hosted on Netlify. These facts do not, by themselves, prove that every control is correctly configured or that a certification exists.

6.3 The Provider's security schedule is in Annex 2. It must be completed only after current configuration is verified. No unsupported claim is made about encryption algorithms, penetration testing, certifications, backup frequency, disaster recovery or uptime.

6.4 The Institute will use strong unique passwords, protect devices and credentials, promptly remove former users, review role assignments and report suspected compromise without undue delay.

## 7. Subprocessors
7.1 The Provider may use subprocessors only where necessary to provide the Platform and subject to appropriate written confidentiality, security and data-protection obligations.

7.2 Current known infrastructure providers are:
- **Supabase** — authentication, database and related backend services.
- **Netlify** — web application hosting/deployment.

7.3 The exact legal contracting entities, service plans, subprocessor lists, data locations, support access, backup locations, retention, and provider DPA terms have not been fully verified in the project record. The Provider must verify and list the relevant entities and terms in Annex 3 before signature.

7.4 The Provider will give the Institute notice of material intended changes to subprocessors using [APPROVED NOTICE CHANNEL / PERIOD]. The Institute may raise a reasoned data-protection objection within [OBJECTION PERIOD]. The Parties will work in good faith to resolve it; any termination/refund remedy must be approved in the commercial terms.

## 8. Data subject requests
8.1 The Institute is responsible for responding to requests concerning Customer Personal Data where it is the Data Fiduciary/controller.

8.2 Taking account of the nature of processing, the Provider will provide reasonable assistance, through available product functions and support processes, to help the Institute respond to requests for access, correction, completion, updating, erasure, withdrawal of consent and grievance handling as applicable.

8.3 If the Provider receives a request directly from a student, parent/guardian or other data subject relating to Customer Personal Data, it will, where appropriate, direct the requester to the Institute and notify the Institute without undue delay, unless prohibited by law.

8.4 The Provider may verify the identity and authority of a requester before disclosing, correcting, exporting or deleting data. The Parties should avoid collecting unnecessary identity documents.

## 9. Personal data incidents and breach cooperation
9.1 The Provider will maintain an incident-response process proportionate to the service and will notify the Institute without undue delay after becoming aware of a confirmed personal-data breach affecting Customer Personal Data, using the contact channel in Annex 4.

9.2 The notice should, to the extent known and legally permissible, describe the nature of the incident, affected data/categories, likely consequences, containment/remediation steps and a contact for follow-up. Information may be provided in phases as the investigation progresses.

9.3 The Parties will cooperate in investigation, evidence preservation, risk assessment, mitigation and legally required notifications. The Institute remains responsible for notifications it must make as Data Fiduciary; the Provider will provide reasonable assistance and information in its possession.

9.4 The Provider will not make a public statement identifying the Institute without its consent unless required by law or necessary to protect individuals or the Platform.

9.5 The incident-response owner, contact procedure, internal escalation and notification deadlines must be operationally approved before signature. This DPA does not invent a statutory notification deadline.

## 10. Retention, return and deletion
10.1 The Provider will retain Customer Personal Data only for the service term and as otherwise required by documented instructions, applicable law, security needs, dispute resolution or legal hold.

10.2 On expiry or termination, at the Institute's choice and subject to technical capability, the Provider will make available an export of Customer Personal Data or delete/return it within the period specified in Annex 5. The Institute must contact the Provider through the verified privacy/support route to request export or deletion; no export format or completion time is promised until Annex 5 and the technical workflow are approved.

10.3 The Provider may retain limited records required for accounting, security, fraud prevention, legal compliance, dispute resolution or legal claims. Such records will be access-restricted and retained only for the relevant purpose.

10.4 Backups and disaster-recovery copies may not be immediately alterable at an individual-record level. Backup expiry/deletion timing must be stated only after provider and platform configuration are verified. Any retained backup data remains protected and must not be restored into active use except for recovery, security or legal purposes.

10.5 Suspension for non-payment does not automatically delete Customer Personal Data. The proposed subscription rule provides seven calendar days after the due date, with the due date as day zero and a proposed 23:59:59 IST deadline on day seven (timezone and billing implementation require approval). A successful payment made by the deadline and supported by transaction evidence submitted by that deadline must not result in suspension solely because Provider verification is still pending. Partial payments, disputed invoices and reversals are handled under the Terms and approved billing procedure. During suspension, ordinary ERP access may be restricted, but the Institute retains a verified route to submit privacy/deletion requests and request an available export, subject to security, technical and legal constraints.

## 11. Audit and compliance information
11.1 On reasonable written request, the Provider will make available information reasonably necessary to demonstrate compliance with this DPA, subject to confidentiality, security and protection of other customers.

11.2 Any audit must be reasonable in scope, frequency, notice and cost; avoid access to other Institutes' data; and not compromise system security. The Parties may first use available policies, provider reports and written questionnaires.

11.3 Any independent audit or onsite inspection process must be agreed in Annex 6. No certification or audit report is promised by this draft.

## 12. International processing and data location
The development and production Supabase project metadata previously inspected reported the region `ap-northeast-1` (Tokyo). This is not proof of the location of all data copies, backups, logs, provider support access, Netlify processing or every subprocessor. The Parties must verify current provider terms and data-location information before making a transfer or India-only hosting claim.

The Provider will disclose known processing locations and material cross-border processing in Annex 3 and will comply with applicable transfer restrictions and instructions as legally required.

## 13. Liability and precedence
Liability, indemnities, caps, exclusions and insurance requirements must be set out in the signed Terms/order form after legal review. This draft does not create an unapproved monetary cap or indemnity.

If this DPA conflicts with the Terms on processor handling of Customer Personal Data, this DPA controls for that subject matter. The Terms otherwise remain in effect.

## 14. Contact and notices
Provider privacy contact: **Tirth Patel — info.classbandhu@gmail.com**  
Institute privacy contact: [INSTITUTE CONTACT / EMAIL TO BE COMPLETED]

## 15. Signatures / electronic acceptance
This DPA is mandatory for every Institute workspace that uses ClassBandhu and is accepted through the single first Institute-creation policy declaration checkbox, which also covers the current Terms & Conditions and Acceptable Use Policy and acknowledges the Privacy Policy. It is a linked document in that bundle, not a fourth checkbox. Before the user selects the checkbox, the interface must clearly list the DPA title/version and provide access to its full text. The server must record a distinct DPA acceptance evidence item (document key, version and hash) associated with the same user action, authenticated actor, Institute ID, server timestamp and source. There is no “no DPA applies” branch. Do not activate this workflow until the DPA is final, counsel-approved and the acceptance authority/evidence mechanism are approved.

---

### 15.1 Existing Institutes and owner changes
An Institute workspace created before this DPA mechanism is activated, and any Institute whose Institute Owner changes, must also be covered by the DPA. The Institute Owner must accept the same document bundle and make the same three declarations for that Institute through a one-time login confirmation step (Consent Implementation Specification §5.5). Staff users such as teachers and accountants cannot accept the DPA or make these declarations for an Institute, and a Super Admin cannot accept on an owner's behalf. The transition period and notices before workspace access is restricted if the confirmation is not made are **[TRANSITION PERIOD AND NOTICE — TO BE APPROVED]**. Counsel must advise on the position for any processing that occurs before acceptance.

## Annex 1 — Processing particulars
| Item | Description |
|---|---|
| Subject matter | Provision of ClassBandhu tuition/institute ERP services |
| Duration | Subscription/service term plus approved return/deletion and legal-retention period |
| Nature of processing | Collection by Institute users, entry, storage, retrieval, organisation, display, updating, export, support, security and deletion where available |
| Purposes | Student/institute administration, admissions, course/batch management, fees, payments, receipts, attendance, reminders and reports |
| Data subjects | Students (including children), parents/guardians, Institute owners, teachers, accountants and other authorised staff |
| Data categories | Student name and identifiers, parent name/contact, student mobile/email, address field, course/batch/admission data, fee/discount/due data, attendance, payment/allocation/receipt records, reminder logs, Institute profile and authorised-user records |
| Special categories | No special-category/biometric data is identified as a current intended feature. Reassess if features change. |
| Frequency | Continuous/periodic as users operate the Platform |

## Annex 2 — Security measures (verification required)
- Authentication through Supabase Auth; verify current password, MFA and recovery configuration.
- PostgreSQL row-level security and tenant-scoped access; test every table, view, RPC and role boundary.
- Least-privilege access for Operator/support personnel; document any break-glass access.
- Secrets management; never expose service-role keys in browser code or source control.
- Secure development and review of migrations; development-first testing and explicit production release approval.
- Logging and audit trails for sensitive administrative and financial actions, subject to data minimisation and retention.
- Incident response, vulnerability handling and access revocation procedures.
- Backup, restore, encryption in transit/at rest, monitoring, and recovery controls: **verify actual provider/service configuration before representing as implemented**.

## Annex 3 — Subprocessor register (must be completed)
| Provider | Function | Known location evidence | Open verification |
|---|---|---|---|
| Supabase | Auth, database/backend | Project metadata previously showed Tokyo (`ap-northeast-1`) | Contracting entity, service region for all components, backups, logs, support access, DPA and subprocessor list |
| Netlify | Web hosting/deployment | Not established in available audit | Contracting entity, processing locations, logs, forms, support access, DPA and subprocessor list |
| Email provider | Privacy/support notifications | Gmail address confirmed; processing terms not audited | Confirm Google Workspace/Gmail account type, data handling and access controls before formal register |
| Other providers | To be verified | Unknown | Review source code, integrations, DNS, logs and vendor contracts |

## Annex 4 — Incident contacts and escalation
- Provider incident owner: Tirth Patel.
- Provider contact: info.classbandhu@gmail.com.
- Institute incident contact: [REQUIRED].
- Secondary emergency route: [APPROVE AND TEST].
- Internal triage and escalation owner: [DOCUMENT].
- Statutory notification decision owner and counsel contact: [DOCUMENT].

## Annex 5 — Return/deletion settings
- Export format(s): [VERIFY].
- Institute request verification: registered Institute Owner / authorised contact, with identity and authority checks.
- Export window after termination: [APPROVE].
- Active-system deletion target after approved trigger: [APPROVE AFTER TECHNICAL TEST].
- Backup expiry/deletion: [VERIFY WITH SUPABASE/NETLIFY AND CONFIGURATION].
- Legal hold and financial record exceptions: retained/restricted as legally necessary.

## Annex 6 — Audit process
- Written request notice: [APPROVE].
- Frequency: [APPROVE].
- Scope and evidence format: [APPROVE].
- Costs and confidentiality: [APPROVE].
