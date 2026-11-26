# ClassBandhu Tuition — Privacy Policy Draft v0.10

**Status: INTERNAL WORKING DRAFT — NOT FOR PUBLICATION**

Prepared 25 November 2026; aligned with legal pack v0.4 on 26 November 2026. This draft is based on the currently inspected development source and database metadata. It is not legal advice and must be reviewed by an Indian privacy lawyer before publication.

**Confirmed operator details**
- Brand: ClassBandhu (parent brand). This policy covers **ClassBandhu Tuition**. **ClassBandhu School** is a separate product and is not covered until its own policy is approved.
- Operator: Tirth Patel (individual operator; no company/LLP currently confirmed)
- Privacy contact: info.classbandhu@gmail.com
- Public postal address: intentionally omitted at the operator's request; counsel should confirm whether any particular mandatory disclosure applies before publication.

**Publication blockers**
1. Select and verify the public website domain.
2. Confirm provider/subprocessor list, provider contracts, hosting/backup/support locations and Netlify processing. Both Supabase project metadata records inspected (development and production) show Tokyo (`ap-northeast-1`); this is not a complete map of every processing location.
3. Approve retention periods for each data category, including student/attendance/financial records, audit events, invitation records, migration anomaly data, and backups.
4. Confirm Data Fiduciary/Data Processor allocation by processing purpose. The Institute Data Processing Agreement is mandatory for every Institute and is accepted through checkbox 1 (Terms §8.3).
5. The development website now has a Privacy Requests page with email links for privacy questions/grievances, access/export requests and deletion requests. An internal request register, request verification/fulfilment workflow and realistic response service target remain to be approved and tested.
6. Confirm the website enquiry form and actual data fields before including website enquiry data as an active collection practice.
7. Complete technical review of the student `address` field, which the inspected development code currently populates with a generic placeholder rather than a user-provided address.
8. Re-audit any remaining legacy EduLedger references in emails, receipts, templates, notifications and invitation flows; the main public legal routes and website footer now use ClassBandhu naming.
9. A 14-day transition period is configured for existing owners in the development environment only. Approve the final transition period, owner-change notices and enforcement date before production (Spec §5.5).
10. Approve the final public wording for the ClassBandhu / ClassBandhu Tuition / ClassBandhu School names.

---

# Privacy Policy

**Effective date:** To be set on publication  
**Last updated:** 25 November 2026 (working draft; update on approval)  
**Service:** ClassBandhu Tuition, part of the ClassBandhu brand (the “Platform”)  
**Website:** [PUBLIC WEBSITE DOMAIN — TO BE SELECTED]  
**Operator:** Tirth Patel, individual operator of ClassBandhu (not currently a registered company/LLP, as confirmed by the owner)  
**Privacy contact:** info.classbandhu@gmail.com  
**Grievance contact:** Tirth Patel — info.classbandhu@gmail.com

### 1. Who this policy applies to

This Privacy Policy explains how `Tirth Patel, operating ClassBandhu` (“we”, “us” or “our”) handles personal data in connection with ClassBandhu Tuition, including:
- our public website and enquiry channels;
- the tuition/institute management ERP and related services;
- user accounts, institute workspaces and platform administration;
- support, onboarding, subscription and billing communications.

The Platform is designed for institutes and their authorised users. Institutes may enter information about students, parents/guardians, teachers and other individuals. If you are a student or parent/guardian whose information has been entered by an institute, please contact that institute first for questions about the institute's use of your information. You may also contact us using the details above where we process information on the institute's behalf or where the law permits/directs you to contact us.

ClassBandhu School, if launched, is a separate product and is not covered by this policy. Students and parents/guardians do not currently have ClassBandhu Tuition logins; their information is entered and managed by the institute's authorised users.

### 2. Our role and the institute's role

For information an institute uploads or manages for its educational and administrative purposes (for example, student admissions, attendance and tuition-fee records), the institute will generally determine why and how that information is used. Depending on the actual arrangement, the institute may act as the Data Fiduciary/controller and we may process the information as its service provider/Data Processor.

We may separately determine purposes and means for information needed to create and secure Platform accounts, administer our own subscriptions and invoices, manage platform administrators, protect the Platform, provide support and operate our public website. For those activities, we may act as the relevant Data Fiduciary/controller.

The allocation is set out in the Terms and in the Institute Data Processing Agreement, which every institute must accept before using the Platform. We will not describe ourselves as only a processor for all data if our actual activities make us a separate fiduciary for particular purposes.

### 3. Personal data we may process

Depending on the features an institute uses and the information it enters, categories may include:

1. **Account data:** name, email address, authentication/account identifiers, account status, password-authentication data handled through the authentication provider, account recovery and invitation records.
2. **Institute data:** institute name, contact details, profile and operational settings.
3. **Student and education data:** student identifiers and profile/admission information, course and batch membership, roster details, attendance records and reports. The exact fields depend on the institute's configuration and must be confirmed against the live application.
4. **Parent/guardian and contact data:** contact details supplied by the institute for student administration or communications, where the feature is used.
5. **Financial and fee data:** course fee obligations, installments, payments, payment references, outstanding balances, receipts, reversals and related financial history.
6. **Communication data:** reminder recipient/contact details, invoice billing contacts and the information needed to prepare manual WhatsApp reminder links/messages.
7. **Subscription and platform billing data:** subscription periods, invoices, due dates, billing contacts and platform-level records.
8. **Security and operational data:** role and membership information, authentication/session events, audit/security records, diagnostic and service-health information. Specific IP address, device, browser and log fields must be confirmed before publication.
9. **Website enquiry data:** if and when the public website enquiry form is launched, details such as name, institute, role, email, phone number and message may be collected to respond to enquiries. [DRAFTING NOTE: keep this item only once the enquiry form and its notice are live.]
10. **Legal acceptance records:** the user and institute concerned, the document name, version and content hash accepted, the declaration made, the server date/time and the acceptance source, kept so we can show what was agreed.

We do not intend to collect more personal data than is reasonably needed for the stated purposes. Do not upload sensitive identity documents or unrelated personal information unless the Platform expressly supports it and the institute has a lawful reason to do so.

### 4. Why we use personal data

Subject to the applicable legal basis and the institute's instructions, information may be used to:
- create and authenticate user accounts;
- provide access to institute workspaces and authorised Platform features;
- manage courses, batches, admissions, student records and attendance;
- calculate tuition-fee obligations, installments, payments and outstanding balances;
- create receipts and maintain transaction history;
- prepare user-initiated/manual fee reminders and platform billing reminders;
- manage institutes, platform administrators, subscriptions, invoices and billing;
- maintain tenant separation, enforce roles and permissions, and protect accounts and records;
- diagnose errors, maintain availability, investigate misuse and improve reliability;
- respond to support requests, enquiries and complaints;
- keep evidence of the policies, agreements and declarations accepted;
- comply with applicable law, enforce agreements and resolve disputes.

We will not use student data for targeted advertising or unrelated profiling. [DRAFTING NOTE: do not claim analytics, advertising cookies or AI training unless introduced and separately disclosed.]

### 5. Student information and children

Institutes must only enter student and guardian information they are authorised to provide and use. Where a student is a child under applicable law, the responsible Data Fiduciary must identify and fulfil any applicable requirement for verifiable parent/lawful-guardian consent before processing. The institute must provide appropriate notices to parents/guardians and students as required. The DPDP Rules include limited, conditional exemptions for specified educational-institution activities; these are not a blanket exemption for every student record or every SaaS provider. ClassBandhu must not assume it can rely on an institute's exemption without legal analysis of the parties, purposes and conditions.

An institute owner's acceptance of our Platform Terms or Privacy Policy does not by itself prove that every student or parent/guardian has consented to the institute's collection or our processing. We will work with institutes to document the respective responsibilities in the Institute Data Processing Agreement and onboarding materials.

The institute's authorised users, not ClassBandhu, collect information about students and parents/guardians. ClassBandhu School, if launched, will need its own review because it is likely to involve more children's data.

The current attendance workflow is manual. QR/barcode attendance is only a possible future feature, and face recognition is not represented as a current feature. Any future biometric or facial-recognition processing would require a separate assessment, clear notice, lawful basis/consent where required, security and retention controls, and an accessible non-biometric alternative where appropriate.

### 6. WhatsApp and other communication channels

The current Platform supports user-initiated/manual WhatsApp reminders by opening WhatsApp with a prepared link or message. Platform subscription billing reminders may also be prepared for manual sending. The Platform does not currently claim to deliver messages automatically through the WhatsApp Business Cloud API. Automated WhatsApp API, email and SMS delivery are future/deferred capabilities.

When a user chooses to open WhatsApp or send a message, WhatsApp and its relevant service providers process information under their own terms and privacy policy. The sender is responsible for checking the recipient, message and contact details before sending. We do not control WhatsApp's independent processing.

### 7. Sharing and service providers

We may disclose or make personal data available:
- to the institute and users authorised by that institute;
- to infrastructure and service providers that host, authenticate, secure or support the Platform, such as Supabase and Netlify, subject to verification of the actual services and contractual terms;
- to communication providers when a user independently chooses to open or send a WhatsApp message;
- to professional advisers, auditors or insurers where reasonably necessary;
- to public authorities, courts or regulators where required by law or valid legal process;
- in connection with a merger, acquisition or business transfer, subject to appropriate safeguards and applicable law.

We do not sell personal data. [DRAFTING NOTE: hosting and authentication providers are necessary, so do not promise that no third party processes data. Before publication, list the actual subprocessors, purposes, locations and privacy links, or give a clear route to obtain them.]

### 8. Data location and international processing

The Platform uses Supabase and Netlify. The actual hosting regions, backup locations, support access locations and cross-border transfers must be verified from the active project configuration and provider terms. We will not promise that all data stays in India unless that is verified and contractually supported. Any transfer will be handled in accordance with applicable law and our agreements.

### 9. Security

We use technical and organisational measures appropriate to the nature of the Platform, which is designed around authenticated access, role-based permissions, database-level access controls and separation of institute workspaces. Measures may include access restrictions, secure configuration, monitoring and backups where configured.

No online service can guarantee absolute security. [DRAFTING NOTE: claim no certifications, encryption standards, penetration-test status, backup frequency or recovery guarantees unless verified.] Institutes are responsible for using strong unique passwords, protecting devices and credentials, promptly removing access for former staff and notifying us of suspected unauthorised access.

Platform administrator accounts are intended to manage platform-level records (institutes, subscriptions, invoices) and are restricted from routine access to institute student records. [VERIFY AGAINST THE APPLICATION BEFORE PUBLICATION.]

### 10. Retention and deletion

We retain personal data only for as long as reasonably necessary for the purpose for which it was collected, to provide the service, maintain legitimate business records, resolve disputes, enforce agreements, protect security and comply with applicable law.

Retention periods differ by category. Student records, attendance, payment and receipt histories may be controlled by the institute and may need to be retained for educational, accounting, tax, dispute or legal purposes. Account, subscription, invoice, security and audit records may also have separate retention requirements.

When an institute requests deletion or closes its account, we will assess the request, the institute's instructions, applicable law, financial-record obligations, backups and any legal hold. Some records may be retained or restricted rather than immediately erased. We will document a category-specific retention schedule before publication and will not promise instant deletion from all backups unless the technical process supports it.

Legal acceptance records are kept as minimal, access-restricted evidence and are not deleted automatically on a deletion request; each request is reviewed for necessity and legal basis.

### 11. Subscription non-payment, suspension and your data

If an institute's subscription is unpaid after the grace period set out in the Terms, its workspace may be suspended. Suspension restricts access; it does not by itself delete data. A suspended institute can still contact us to request export or deletion, and a deletion request is handled under the retention process above, not by automatic erasure.

### 12. Your rights and requests

Subject to applicable law and the role we play for the relevant data, individuals may have rights to request information about processing, correction, completion, updating, erasure, withdrawal of consent and grievance redressal.

For student records controlled by an institute, requests should normally be directed to that institute. We will assist the institute where we act as its processor and respond directly where we are responsible for the relevant processing. Requests can be sent to `info.classbandhu@gmail.com` with enough information to verify the requester's identity and locate the relevant account/record. Do not send passwords or unnecessary identity documents by email.

Where processing is based on consent, a person may withdraw consent through a route that is as easy to use as the route used to give it, subject to applicable law. Withdrawal does not make prior lawful processing unlawful and may affect the availability of a feature or service.

### 13. Complaints and privacy contact

For privacy questions, data requests or complaints, contact:

- Privacy contact: Tirth Patel
- Email: `info.classbandhu@gmail.com`
- Response target: `[OPERATIONAL SLA TO BE APPROVED]`

We will acknowledge and handle requests under the applicable law and published grievance process. [DRAFTING NOTE: do not publish an unsupported response deadline.]

### 14. Cookies and similar technologies

The public website and ERP may use essential technologies needed for authentication, security, session continuity and core functionality. Whether analytics, advertising or other optional cookies are used must be verified. If optional analytics or marketing tools are introduced, disclose them and implement an appropriate consent/preference mechanism where required. Publish a separate Cookie Policy if non-essential cookies or tracking are used.

### 15. Changes to this policy

We may update this Policy to reflect changes in the Platform, our practices or applicable law. We will publish the updated version and its effective date. Where a change materially affects the purposes or manner of processing and renewed notice or consent is required, we will provide the appropriate notice and obtain the required consent before continuing that processing.

### 16. Contact

For privacy matters, contact Tirth Patel at info.classbandhu@gmail.com. [DRAFTING NOTE: no postal address is included by the operator's choice; counsel to confirm whether any disclosure is mandatory.]

---

## Review notes (not part of the public policy)

- **v0.10 changes:** renumbered sections 1–16; product naming added; DPA stated as mandatory; legal-acceptance records, suspension/data and platform-administrator sections added; drafting instructions moved into bracketed notes.

- Do not publish the draft until the blockers above are closed or the unresolved items are accurately disclosed.
- The policy should be versioned and its published content retained immutably so that legal acceptance events can refer to an exact version/hash.
- The owner's institute-level declaration that required parent/guardian consent has been obtained is an attestation only; it does not itself constitute or prove each parent's consent.
- The DPDP Act commencement is phased. G.S.R. 843(E) places the listed core provisions including sections 3–17 into effect 18 months after 13 November 2025 (13 May 2027). DPDP Rules G.S.R. 846(E), as corrected by G.S.R. 892(E), also have phased commencement: Rule 4 from 13 November 2026 and Rules 3, 5–16, 22 and 23 from 13 May 2027. Design now for the full framework, and have counsel confirm the law as at publication.

## Official legal references

- DPDP Act commencement notification G.S.R. 843(E): https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf
- DPDP Rules, 2025 G.S.R. 846(E): https://egazette.gov.in/WriteReadData/2025/267650.pdf
- Corrigendum G.S.R. 892(E): https://egazette.gov.in/WriteReadData/2025/268455.pdf
- MeitY/PIB Consent Manager registration update (14 November 2026): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2336151