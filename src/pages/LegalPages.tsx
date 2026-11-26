import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Download, ShieldCheck } from "lucide-react";
import { ClassBandhuMark } from "../components/ClassBandhuMark";
import { useAuth } from "../context/AuthContext";
import {
  acceptCurrentLegalDocuments, acceptInstituteDpa, getInstituteDpaStatus,
  getMyLegalStatus, getMyPrivacyConsents, getPublishedLegalDocument,
  getPublishedRequiredLegalDocuments, listMyLegalAcceptances, setMyProductUpdateConsent,
  type InstituteDpaStatus, type LegalSlug, type MyLegalStatus, type PrivacyConsent,
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
        <Link to="/terms" className="hover:text-[#6B1F38]">Terms of Service</Link>
        <Link to="/dpa" className="hover:text-[#6B1F38]">Data Processing Agreement</Link>
        <Link to="/" className="hover:text-[#6B1F38]">Back to ClassBandhu</Link>
      </nav>
    </div>
  </main>;
}

function MarkdownBody({ value }: { value: string }) {
  const blocks = value.split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
  return <div className="mt-6 space-y-4 text-sm leading-7 text-slate-700">
    {blocks.map((block, index) => {
      const lines = block.split("\n");
      if (block.startsWith("# ")) return <h2 key={index} className="text-xl font-bold text-slate-900">{block.slice(2)}</h2>;
      if (block.startsWith("## ")) return <h3 key={index} className="pt-2 text-base font-bold text-slate-900">{block.slice(3)}</h3>;
      if (block.startsWith("> ")) return <blockquote key={index} className="rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950">{block.replace(/^> /gm, "")}</blockquote>;
      if (lines.every(line => line.startsWith("- "))) return <ul key={index} className="list-disc space-y-1 pl-6">{lines.map((line, i) => <li key={i}>{line.slice(2)}</li>)}</ul>;
      return <p key={index} className="whitespace-pre-wrap">{block}</p>;
    })}
  </div>;
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
      <MarkdownBody value={document.body_markdown ?? ""} />
    </>}
  </LegalShell>;
}

export function PrivacyPolicyPage() {
  return <PublicLegalDocumentPage slug="privacy-policy" />;
}

export function TermsPage() {
  return <PublicLegalDocumentPage slug="terms-of-service" />;
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

  const bothPresent = ["privacy-policy", "terms-of-service"].every(slug => documents.some(doc => doc.slug === slug));
  const testOnly = documents.some(doc => doc.is_test_only);
  return <LegalShell title="Review updated legal documents">
    <p className="mt-2 text-sm leading-6 text-slate-600">The current Terms of Service and Privacy Policy must be reviewed and accepted before you can continue to your workspace. The system records the exact document versions and server timestamp.</p>
    {testOnly && <div role="alert" className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-900">
      These are development test copies, not approved production policies. Use this flow only for staging tests.
    </div>}
    {loading && <p className="mt-5 text-sm text-slate-500">Loading current documents…</p>}
    {!loading && !bothPresent && <div role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      Both required documents must be published before acceptance can continue. Contact the ClassBandhu administrator.
    </div>}
    <div className="mt-5 space-y-3">
      {documents.map(doc => <article key={doc.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-slate-900">{doc.title}</h2>
          <span className="text-xs text-slate-500">v{doc.version}</span>
        </div>
        <div className="mt-3 max-h-56 overflow-y-auto rounded-lg bg-slate-50 p-3">
          <MarkdownBody value={doc.body_markdown ?? ""} />
        </div>
        {doc.is_test_only && <p className="mt-2 text-xs font-semibold text-rose-700">Development test only — not approved legal content.</p>}
      </article>)}
    </div>
    {!loading && bothPresent && <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">
      <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[#6B1F38]" />
      <span>I agree to the current Terms of Service and acknowledge that I have read the current Privacy Policy.</span>
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

export function PrivacyPreferencesPage() {
  const auth = useAuth();
  const [consent, setConsent] = useState<PrivacyConsent | null>(null);
  const [productUpdates, setProductUpdates] = useState(false);
  const [dpa, setDpa] = useState<InstituteDpaStatus | null>(null);
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
      if (auth.activeMembership?.role === "owner") {
        setDpa(await getInstituteDpaStatus(auth.activeMembership.instituteId));
      } else setDpa(null);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Privacy preferences could not be loaded.");
    } finally { setLoading(false); }
  }, [auth.activeMembership?.instituteId, auth.activeMembership?.role]);

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

  const acceptDpa = async () => {
    if (!auth.activeMembership) return;
    if (!window.confirm("Confirm that you are authorised to accept the Data Processing Agreement on behalf of this institution.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      setDpa(await acceptInstituteDpa(auth.activeMembership.instituteId));
      setNotice("The institution-level DPA acceptance was recorded.");
    } catch (value) { setError(value instanceof Error ? value.message : "DPA acceptance could not be recorded."); }
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

    {auth.activeMembership?.role === "owner" && <section className="mt-6 border-t border-slate-100 pt-5">
      <h2 className="font-bold text-slate-900">Institution Data Processing Agreement</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">This acceptance is recorded for the current institution and the signed-in owner. It does not replace the institution's review of its legal duties.</p>
      {!dpa?.document ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No published DPA is currently available.</p> : <div className="mt-3 rounded-xl border border-slate-200 p-4">
        <p className="font-semibold text-slate-900">{dpa.document.title} · v{dpa.document.version}</p><Link to="/dpa" className="mt-1 inline-block text-xs font-semibold text-blue-700 underline">Read current DPA</Link>
        <p className="mt-1 text-xs text-slate-500">{dpa.accepted ? "Accepted by " + (dpa.accepted_by ?? "an owner") + " on " + new Date(dpa.accepted_at ?? "").toLocaleString() : "Not yet accepted for this institution."}</p>
        {!dpa.accepted && <button type="button" disabled={busy} onClick={() => void acceptDpa()} className="mt-3 rounded-xl bg-[#6B1F38] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Review and accept DPA</button>}
      </div>}
    </section>}

    <section className="mt-6 border-t border-slate-100 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-slate-900">Your acceptance history</h2><p className="mt-1 text-xs text-slate-500">Historical events are read-only and include the accepted version and content hash.</p></div>
        <button type="button" disabled={!acceptances.length} onClick={() => downloadCsv(acceptances as unknown as Record<string, string | number | null>[], "classbandhu-my-legal-acceptances.csv")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><Download className="h-4 w-4"/>Export my records</button>
      </div>
      {acceptances.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No acceptance events are recorded for this account yet.</p> : <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Document</th><th className="p-3">Version</th><th className="p-3">Method</th><th className="p-3">Accepted at</th><th className="p-3">SHA-256</th></tr></thead>
          <tbody>{acceptances.map((item,index)=><tr key={item.document_slug+item.document_version+index} className="border-t border-slate-100"><td className="p-3 font-semibold text-slate-800">{item.document_title}</td><td className="p-3">{item.document_version}</td><td className="p-3">{item.acceptance_method}</td><td className="p-3">{new Date(item.accepted_at).toLocaleString()}</td><td className="max-w-44 truncate p-3 font-mono">{item.content_sha256}</td></tr>)}</tbody>
        </table>
      </div>}
    </section>
    <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><ShieldCheck className="mr-1 inline h-4 w-4"/> Acceptance history is append-only. Withdrawal of optional consent creates a new event; it does not delete the original event.</div>
  </LegalShell>;
}
