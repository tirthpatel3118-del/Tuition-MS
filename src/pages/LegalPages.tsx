import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Download, ShieldCheck } from "lucide-react";
import { ClassBandhuMark } from "../components/ClassBandhuMark";
import { useAuth } from "../context/AuthContext";
import {
  acceptCurrentLegalDocuments, acceptInstituteLegalBundle,
  getMyDpaRequirements, getMyPrivacyConsents, getPublishedLegalDocument,
  getPublishedRequiredLegalDocuments, listMyLegalAcceptances, setMyProductUpdateConsent,
  type LegalSlug, type PrivacyConsent,
  type RequiredLegalDocument, type UserLegalAcceptance,
} from "../services/legalService";

function LegalShell({ children, title = "ClassBandhu" }: { children: ReactNode; title?: string }) {
  return <main className="min-h-screen bg-[#FAF7F8] px-4 py-8 sm:py-12">
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-center gap-3">
        <ClassBandhuMark className="h-12 w-12 text-[#790D3D]" />
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A03B5E]">ClassBandhu</p><p className="text-sm text-slate-500">Empowering Every Classroom.</p></div>
      </header>
      <section className="rounded-2xl border border-[#E5DDE0] bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {children}
      </section>
      <nav aria-label="Legal documents" className="mt-5 flex flex-wrap justify-center gap-5 text-xs text-slate-500">
        <Link to="/privacy" className="hover:text-[#6B1F38]">Privacy Policy</Link>
        <Link to="/terms" className="hover:text-[#6B1F38]">Terms & Conditions</Link>
        <Link to="/acceptable-use" className="hover:text-[#6B1F38]">Acceptable Use Policy</Link>
        <Link to="/dpa" className="hover:text-[#6B1F38]">Institute DPA</Link>
        <Link to="/privacy-request" className="hover:text-[#6B1F38]">Privacy requests</Link>
        <Link to="/" className="hover:text-[#6B1F38]">Back to ClassBandhu</Link>
      </nav>
    </div>
  </main>;
}

function renderInlineMarkdown(value: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\x60[^\x60]+\x60|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s]+)/g;
  return value.split(pattern).filter(Boolean).map((token, index) => {
    const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (linkMatch) return <a key={index} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline break-all">{linkMatch[1]}</a>;
    if (/^https?:\/\//.test(token)) return <a key={index} href={token} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline break-all">{token}</a>;
    if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      return <strong key={index} className="font-semibold text-slate-900">{token.slice(2, -2)}</strong>;
    }
    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      return <em key={index}>{token.slice(1, -1)}</em>;
    }
    if (token.startsWith("`") && token.endsWith("`")) return <code key={index} className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em]">{token.slice(1, -1)}</code>;
    return token;
  });
}

export function LegalMarkdownBody({ value }: { value: string }) {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const content = renderInlineMarkdown(heading[2]);
      const key = "heading-" + index;
      blocks.push(heading[1].length === 1
        ? <h2 key={key} className="text-xl font-bold text-slate-900">{content}</h2>
        : heading[1].length === 2
          ? <h3 key={key} className="pt-2 text-base font-bold text-slate-900">{content}</h3>
          : <h4 key={key} className="pt-1 text-sm font-bold text-slate-900">{content}</h4>);
      index += 1; continue;
    }

    if (line === "---" || line === "***") {
      blocks.push(<hr key={"rule-" + index} className="border-slate-200"/>);
      index += 1; continue;
    }

    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("> ")) {
        quote.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={"quote-" + index} className="rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        {quote.map((part, partIndex) => <p key={partIndex}>{renderInlineMarkdown(part)}</p>)}
      </blockquote>);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(<ul key={"ul-" + index} className="list-disc space-y-1 pl-6">{items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}</ul>);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(<ol key={"ol-" + index} className="list-decimal space-y-1 pl-6">{items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}</ol>);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim()
      && !/^(#{1,3})\s+/.test(lines[index].trim())
      && !lines[index].trim().startsWith("> ")
      && !/^[-*]\s+/.test(lines[index].trim())
      && !/^\d+\.\s+/.test(lines[index].trim())
      && !/^---$|^\*\*\*$/.test(lines[index].trim())) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={"paragraph-" + index} className="break-words">{renderInlineMarkdown(paragraph.join(" "))}</p>);
  }

  return <div className="mt-6 space-y-4 text-sm leading-7 text-slate-700">{blocks}</div>;
}

export function PublicLegalDocumentPage({ slug }: { slug: LegalSlug }) {
  const [document, setDocument] = useState<RequiredLegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getPublishedLegalDocument(slug)
      .then(value => { if (active) setDocument(value); })
      .catch(value => { if (active) setError(value instanceof Error ? value.message : "Could not load this document."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const title = document?.title ?? (slug === "privacy-policy" ? "Privacy Policy" : slug === "terms-of-service" ? "Terms of Service" : "Legal document");
  return <LegalShell title={title}>
    <p className="mt-2 text-sm text-slate-500">Published legal information for the ClassBandhu service.</p>
    {loading && <p className="mt-6 text-sm text-slate-500">Loading document…</p>}
    {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!loading && !error && !document && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      No published version is currently available. Any saved draft is not a published policy and must not be treated as legally effective.
    </div>}
    {document && <>
      {document.is_test_only && <div role="alert" className="mt-5 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-900">
        DEVELOPMENT TEST COPY — This document is published only for staging tests. It is not legally approved and must not be relied on as a production policy.
      </div>}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-100 pb-4 text-xs text-slate-500">
        <span>Version {document.version}</span><span>Locale {document.locale}</span>
        <span>SHA-256: <code>{document.content_sha256}</code></span>
      </div>
      <LegalMarkdownBody value={document.body_markdown ?? ""} />
    </>}
  </LegalShell>;
}

export function PrivacyPolicyPage() {
  return <PublicLegalDocumentPage slug="privacy-policy" />;
}

export function TermsPage() {
  return <PublicLegalDocumentPage slug="terms-of-service" />;
}

export function AcceptableUsePolicyPage() {
  return <PublicLegalDocumentPage slug="acceptable-use-policy" />;
}

export function PrivacyRequestPage() {
  return <LegalShell title="Privacy requests and grievances">
    <p className="mt-3 text-sm leading-7 text-slate-600">
      For privacy questions, access or correction requests, consent withdrawal, deletion requests, or a privacy grievance, email the ClassBandhu privacy contact. For student or parent/guardian records managed by an institute, contact that institute first; ClassBandhu will assist the institute where it acts as a service provider.
    </p>
    <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">Privacy contact</p>
      <p className="break-all text-sm font-semibold text-[#6B1F38]">info.classbandhu@gmail.com</p>
      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        <a className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[#6B1F38] underline" href="mailto:info.classbandhu@gmail.com?subject=ClassBandhu%20Privacy%20Question">Privacy question / grievance</a>
        <a className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[#6B1F38] underline" href="mailto:info.classbandhu@gmail.com?subject=ClassBandhu%20Data%20Access%20or%20Export%20Request">Access / export request</a>
        <a className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[#6B1F38] underline" href="mailto:info.classbandhu@gmail.com?subject=ClassBandhu%20Data%20Deletion%20Request">Deletion request</a>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Describe the request and include enough information to locate the account or Institute. Do not send passwords, OTPs, payment PINs or unnecessary identity documents. Proportionate verification may be requested.
      </p>
    </div>
    <p className="mt-4 text-xs leading-5 text-slate-500">This is an initial email-based intake route. No response-time SLA or automatic deletion promise is made by this development draft.</p>
  </LegalShell>;
}

export function LegalAcceptanceGate({ onAccepted }: { onAccepted: () => void }) {
  const [documents, setDocuments] = useState<RequiredLegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getPublishedRequiredLegalDocuments(true)
      .then(value => { if (active) setDocuments(value); })
      .catch(value => { if (active) setError(value instanceof Error ? value.message : "Required legal documents could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const submit = async () => {
    setBusy(true); setError("");
    try {
      const result = await acceptCurrentLegalDocuments();
      if (result.missing_document_slugs.length) throw new Error("The current document versions were not recorded. Refresh the page and review them again.");
      onAccepted();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Your acceptance could not be recorded.");
    } finally {
      setBusy(false);
    }
  };

  const bothPresent = ["privacy-policy", "terms-of-service", "acceptable-use-policy"].every(slug => documents.some(doc => doc.slug === slug));
  const testOnly = documents.some(doc => doc.is_test_only);
  return <LegalShell title="Review updated legal documents">
    <p className="mt-2 text-sm leading-6 text-slate-600">The current Terms & Conditions and Acceptable Use Policy must be accepted, and the Privacy Policy acknowledged, before you can continue to your workspace. The exact document versions and server timestamps are recorded.</p>
    {testOnly && <div role="alert" className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-900">
      These are development test copies, not approved production policies. Use this flow only for staging tests.
    </div>}
    {loading && <p className="mt-5 text-sm text-slate-500">Loading current documents…</p>}
    {!loading && !bothPresent && <div role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      The current Terms, Acceptable Use Policy and Privacy Policy must all be published before acceptance can continue.
    </div>}
    <div className="mt-5 space-y-3">
      {documents.map(doc => <article key={doc.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-slate-900">{doc.title}</h2>
          <span className="text-xs text-slate-500">v{doc.version}</span>
        </div>
        <div className="mt-3 max-h-56 overflow-y-auto rounded-lg bg-slate-50 p-3">
          <LegalMarkdownBody value={doc.body_markdown ?? ""} />
        </div>
        {doc.is_test_only && <p className="mt-2 text-xs font-semibold text-rose-700">Development test only — not approved legal content.</p>}
      </article>)}
    </div>
    {!loading && bothPresent && <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">
      <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[#6B1F38]" />
      <span>I have read and agree to the current ClassBandhu Terms & Conditions and Acceptable Use Policy, and acknowledge the ClassBandhu Privacy Policy.</span>
    </label>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button type="button" disabled={!accepted || !bothPresent || loading || busy} onClick={() => void submit()} className="mt-5 w-full rounded-xl bg-[#6B1F38] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
      {busy ? "Recording acceptance…" : "Accept and continue"}
    </button>
  </LegalShell>;
}

function downloadCsv(rows: Record<string, string | number | null>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
  const csv = [headers.map(escape).join(","), ...rows.map(row => headers.map(key => escape(row[key])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

export function InstituteLegalAcceptanceGate({ onAccepted }: { onAccepted: () => void }) {
  const auth = useAuth();
  const [requirements, setRequirements] = useState<import("../services/legalService").MyDpaRequirements | null>(null);
  const [documents, setDocuments] = useState<RequiredLegalDocument[]>([]);
  const [bundleAccepted, setBundleAccepted] = useState(false);
  const [authorityAccepted, setAuthorityAccepted] = useState(false);
  const [dataAuthorityAccepted, setDataAuthorityAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await getMyDpaRequirements();
      setRequirements(next);
      setDocuments(next.documents);
      setBundleAccepted(false);
      setAuthorityAccepted(false);
      setDataAuthorityAccepted(false);
      if (next.documents.length !== 4) throw new Error("The complete current legal bundle is unavailable. Contact ClassBandhu support.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "The current Institute legal status could not be verified.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const pending = requirements?.institutes.filter(item => !item.accepted) ?? [];
  const submit = async () => {
    if (pending.length === 0 || documents.length !== 4 || !bundleAccepted || !authorityAccepted || !dataAuthorityAccepted || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const documentIds = Object.fromEntries(documents.map(document => [document.slug, document.id]));
      for (const institute of pending) {
        await acceptInstituteLegalBundle(institute.institute_id, documentIds, authorityAccepted, dataAuthorityAccepted);
      }
      const next = await getMyDpaRequirements();
      setRequirements(next);
      setDocuments(next.documents);
      if (next.missing_institute_ids.length === 0) {
        setNotice("The document bundle and three declarations were recorded separately for each Institute you own.");
        onAccepted();
      } else {
        setNotice("Some Institute confirmations remain outstanding. Review the remaining Institute(s) below.");
      }
      setBundleAccepted(false);
      setAuthorityAccepted(false);
      setDataAuthorityAccepted(false);
    } catch (value) {
      setError(value instanceof Error ? value.message : "The Institute legal confirmations could not be recorded.");
      try {
        const next = await getMyDpaRequirements();
        setRequirements(next);
        setDocuments(next.documents);
      } catch {
        // Keep the original acceptance error visible.
      }
    } finally {
      setBusy(false);
    }
  };

  return <LegalShell title="Institute legal confirmation">
    <p className="mt-2 text-sm leading-6 text-slate-600">An Institute Owner must review the current Terms, AUP, Privacy Policy and mandatory DPA, then make the two Institute-specific authority declarations. This is a per-owner, per-Institute process. Staff and platform administrators cannot accept on an owner's behalf.</p>
    {documents.some(document => document.is_test_only) && <div role="alert" className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-900">DEVELOPMENT TEST COPY — these documents are staging drafts for your review, not approved production agreements.</div>}
    {loading && <p className="mt-5 text-sm text-slate-500">Checking Institute legal confirmations…</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {!loading && <section className="mt-5 space-y-2">
      <h2 className="text-sm font-bold text-slate-900">Institutes requiring your confirmation</h2>
      {requirements?.institutes.map(item => <article key={item.institute_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
        <div><p className="text-sm font-semibold text-slate-900">{item.institute_name}</p><p className="mt-1 text-xs text-slate-500">{item.accepted ? "Confirmed by you" : "Your confirmation is pending"}</p></div>
        <span className={item.accepted ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800" : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"}>{item.accepted ? "Complete" : "Pending"}</span>
      </article>)}
    </section>}
    <section className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4">
      <div><h2 className="text-sm font-bold text-slate-900">1. Platform policies and mandatory Institute DPA</h2><p className="mt-1 text-xs leading-5 text-slate-500">One checkbox covers the three account policies and the mandatory Institute DPA. Each document receives its own acceptance evidence linked to the same action and Institute.</p></div>
      {documents.map(document => <details key={document.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-xs font-bold text-slate-800">{document.title} · v{document.version}</summary>
        <p className="mt-2 break-all text-[10px] text-slate-500">SHA-256: {document.content_sha256}</p>
        <div className="mt-2 max-h-60 overflow-y-auto rounded-lg bg-white p-3"><LegalMarkdownBody value={document.body_markdown ?? ""}/></div>
      </details>)}
      {documents.length === 4 && <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-xs leading-5 text-slate-700">
        <input type="checkbox" checked={bundleAccepted} onChange={event => setBundleAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#6B1F38]"/>
        <span>I have read and agree to the current ClassBandhu Terms & Conditions, Acceptable Use Policy and Institute Data Processing Agreement (DPA), and acknowledge the ClassBandhu Privacy Policy.</span>
      </label>}
    </section>
    <section className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4">
      <h2 className="text-sm font-bold text-slate-900">2. Authority to create/manage the Institute</h2>
      <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-700">
        <input type="checkbox" checked={authorityAccepted} onChange={event => setAuthorityAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#6B1F38]"/>
        <span>I confirm that I am authorised to create and manage this institution's account and to provide the institution's information to ClassBandhu for the ERP service.</span>
      </label>
    </section>
    <section className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4">
      <h2 className="text-sm font-bold text-slate-900">3. Authority to provide student/parent data</h2>
      <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-700">
        <input type="checkbox" checked={dataAuthorityAccepted} onChange={event => setDataAuthorityAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#6B1F38]"/>
        <span>I confirm that, wherever required by applicable law, the institution has obtained the necessary consent or other lawful authorisation from parents or legal guardians for collecting and sharing student personal information with ClassBandhu to provide the ERP service.</span>
      </label>
      <p className="text-[11px] leading-5 text-slate-500">This is an Institute Owner attestation. It is not itself a student's or parent's consent and does not prove that a particular parent/guardian consent was obtained.</p>
    </section>
    {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {pending.length > 0 && <button type="button" disabled={busy || loading || documents.length !== 4 || !bundleAccepted || !authorityAccepted || !dataAuthorityAccepted} onClick={() => void submit()} className="mt-5 w-full rounded-xl bg-[#6B1F38] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Recording Institute declarations…" : "Confirm three declarations for each pending Institute"}</button>}
    {pending.length === 0 && !loading && <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">All your current owner Institutes have a complete legal bundle and declaration record.</div>}
    <button type="button" onClick={() => void auth.signOut()} className="mt-5 w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">Sign out</button>
  </LegalShell>;
}

export function PrivacyPreferencesPage() {
  const [consent, setConsent] = useState<PrivacyConsent | null>(null);
  const [productUpdates, setProductUpdates] = useState(false);
  const [acceptances, setAcceptances] = useState<UserLegalAcceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [nextConsent, nextAcceptances] = await Promise.all([getMyPrivacyConsents(), listMyLegalAcceptances()]);
      setConsent(nextConsent); setProductUpdates(nextConsent.product_updates); setAcceptances(nextAcceptances);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Privacy preferences could not be loaded.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const savePreference = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await setMyProductUpdateConsent(productUpdates);
      setConsent(next); setNotice("Your optional product-update preference has been saved.");
      await refresh();
    } catch (value) { setError(value instanceof Error ? value.message : "Preference could not be saved."); }
    finally { setBusy(false); }
  };


  return <LegalShell title="Privacy preferences & legal records">
    <p className="mt-2 text-sm leading-6 text-slate-600">Manage optional communications, review your own legal acceptance history, and (for institute owners) review the institution's Data Processing Agreement status.</p>
    {loading && <p className="mt-5 text-sm text-slate-500">Loading your privacy records…</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

    <section className="mt-6 border-t border-slate-100 pt-5">
      <h2 className="font-bold text-slate-900">Optional product updates</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">This choice is optional and does not affect account access. You can withdraw it at any time; each change is stored as a separate consent event.</p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">
        <input type="checkbox" checked={productUpdates} onChange={event => setProductUpdates(event.target.checked)} className="mt-1 h-4 w-4 accent-[#6B1F38]" />
        <span>Send me optional ClassBandhu product news and release updates by email.</span>
      </label>
      <button disabled={busy || loading || !consent} type="button" onClick={() => void savePreference()} className="mt-3 rounded-xl bg-[#6B1F38] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save privacy preference"}</button>
      {consent?.updated_at && <p className="mt-2 text-xs text-slate-500">Last recorded: {new Date(consent.updated_at).toLocaleString()} · Privacy Policy v{consent.privacy_document_version}</p>}
    </section>

    <section className="mt-6 border-t border-slate-100 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-slate-900">Your acceptance history</h2><p className="mt-1 text-xs text-slate-500">Historical events are read-only and include the accepted version and content hash.</p></div>
        <button type="button" disabled={!acceptances.length} onClick={() => downloadCsv(acceptances as unknown as Record<string, string | number | null>[], "classbandhu-my-legal-acceptances.csv")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><Download className="h-4 w-4"/>Export my records</button>
      </div>
      {acceptances.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No acceptance events are recorded for this account yet.</p> : <>
        <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 sm:block">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Document</th><th className="p-3">Version</th><th className="p-3">Method</th><th className="p-3">Accepted at</th><th className="p-3">SHA-256</th></tr></thead>
            <tbody>{acceptances.map((item,index)=><tr key={item.document_slug+item.document_version+index} className="border-t border-slate-100"><td className="p-3 font-semibold text-slate-800">{item.document_title}</td><td className="p-3">{item.document_version}</td><td className="p-3">{item.acceptance_method}</td><td className="p-3">{new Date(item.accepted_at).toLocaleString()}</td><td className="max-w-44 truncate p-3 font-mono">{item.content_sha256}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="mt-4 space-y-2 sm:hidden">
          {acceptances.map((item,index)=><article key={item.document_slug+item.document_version+index} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-900">{item.document_title}</h3><span className="text-xs text-slate-500">v{item.document_version}</span></div>
            <p className="mt-1 text-xs text-slate-600">{item.acceptance_method} · {new Date(item.accepted_at).toLocaleString()}</p>
            <p className="mt-2 break-all rounded-lg bg-slate-50 p-2 font-mono text-[10px] leading-4 text-slate-500">{item.content_sha256}</p>
          </article>)}
        </div>
      </>}
    </section>
    <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><ShieldCheck className="mr-1 inline h-4 w-4"/> Acceptance history is append-only. Withdrawal of optional consent creates a new event; it does not delete the original event.</div>
  </LegalShell>;
}
