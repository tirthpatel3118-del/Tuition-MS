import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Archive, Download, FileCheck2, FileText, Plus, RefreshCw, Save, ShieldCheck } from "lucide-react";
import {
  archivePlatformLegalDocument, exportPlatformLegalAcceptances, getPlatformLegalAcceptanceSummary, listPlatformLegalDocuments,
  publishPlatformLegalDocument, savePlatformLegalDocument,
  type LegalDocument, type LegalSlug, type LegalAcceptanceSummary,
} from "../services/legalService";

const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const field = "mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#A03B5E] focus:ring-4 focus:ring-[#A03B5E]/10";
const emptySummary: LegalAcceptanceSummary = { total_acceptance_events: 0, users_missing_current_acceptance: 0, recent_acceptances: [] };

const types: Array<{ slug: LegalSlug; title: string; required: boolean }> = [
  { slug: "privacy-policy", title: "Privacy Policy", required: true },
  { slug: "terms-of-service", title: "Terms of Service", required: true },
  { slug: "data-processing-agreement", title: "Data Processing Agreement", required: false },
  { slug: "cookie-policy", title: "Cookie Policy", required: false },
];

function csvDownload(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const quote = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
  const csv = [headers.map(quote).join(","), ...rows.map(row => headers.map(key => quote(row[key])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "classbandhu-legal-acceptance-audit.csv"; anchor.click();
  URL.revokeObjectURL(url);
}

export function LegalCompliancePanel() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [summary, setSummary] = useState<LegalAcceptanceSummary>(emptySummary);
  const [selectedId, setSelectedId] = useState("");
  const [slug, setSlug] = useState<LegalSlug>("privacy-policy");
  const [title, setTitle] = useState("Privacy Policy");
  const [version, setVersion] = useState("1.0");
  const [locale, setLocale] = useState("en-IN");
  const [body, setBody] = useState("");
  const [required, setRequired] = useState(true);
  const [testOnly, setTestOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [nextDocuments, nextSummary] = await Promise.all([
        listPlatformLegalDocuments(), getPlatformLegalAcceptanceSummary(),
      ]);
      setDocuments(nextDocuments);
      setSummary(nextSummary);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Legal compliance records could not be loaded.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const resetEditor = () => {
    setSelectedId(""); setSlug("privacy-policy"); setTitle("Privacy Policy");
    setVersion("1.0"); setLocale("en-IN"); setBody(""); setRequired(true); setTestOnly(true);
  };

  const editDraft = (document: LegalDocument) => {
    if (document.status !== "draft") return;
    setSelectedId(document.id); setSlug(document.slug); setTitle(document.title);
    setVersion(document.version); setLocale(document.locale); setBody(document.body_markdown);
    setRequired(document.is_required); setTestOnly(document.is_test_only);
    window.scrollTo({ top: document.body_markdown ? 0 : window.scrollY, behavior: "smooth" });
  };

  const selectType = (value: LegalSlug) => {
    setSlug(value);
    const found = types.find(item => item.slug === value);
    setTitle(found?.title ?? "Legal document");
    setRequired(found?.required ?? false);
  };

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await savePlatformLegalDocument({
        id: selectedId || null, slug, title, version, locale, body, required, testOnly,
      });
      setNotice("Draft saved with a server-generated SHA-256 content hash. Published versions cannot be overwritten.");
      resetEditor(); await refresh();
    } catch (value) { setError(value instanceof Error ? value.message : "Draft could not be saved."); }
    finally { setBusy(false); }
  };

  const publish = async (document: LegalDocument) => {
    if (document.status !== "draft") return;
    const message = document.is_test_only
      ? "Publish this version for DEVELOPMENT TESTING ONLY? It will be visibly labelled as unapproved test copy. Do not use this setting in production."
      : "Confirm that an Indian legal professional has reviewed this exact version, all placeholders are resolved, the operator and contact details are correct, and the document is ready for production publication.";
    if (!window.confirm(message)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await publishPlatformLegalDocument(document.id);
      setNotice(document.is_test_only ? "Test-only document published. It is labelled as a development test copy." : "Legal document published. Users will be required to accept new versions where applicable.");
      await refresh();
    } catch (value) { setError(value instanceof Error ? value.message : "Document could not be published."); }
    finally { setBusy(false); }
  };

  const archive = async (document: LegalDocument) => {
    if (document.status !== "published") return;
    if (!window.confirm("Archive " + document.title + " v" + document.version + "? Existing acceptance evidence will remain linked to the archived version.")) return;
    setBusy(true); setError(""); setNotice("");
    try { await archivePlatformLegalDocument(document.id); setNotice("Document archived. Historical acceptance records were retained."); await refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : "Document could not be archived."); }
    finally { setBusy(false); }
  };

  const exportAll = async () => {
    setBusy(true); setError("");
    try {
      const records = await exportPlatformLegalAcceptances();
      csvDownload(records as unknown as Array<Record<string, unknown>>);
      setNotice("Acceptance audit export generated (" + records.length + " records; maximum 10,000 per export).");
    } catch (value) { setError(value instanceof Error ? value.message : "Acceptance audit export failed."); }
    finally { setBusy(false); }
  };

  const grouped = types.map(type => ({
    ...type,
    items: documents.filter(document => document.slug === type.slug).sort((a,b) => b.created_at.localeCompare(a.created_at)),
  }));

  return <section id="legal-compliance" className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A03B5E]">Governance & privacy</p><h2 className="text-lg font-bold text-slate-900">Legal documents & acceptance evidence</h2><p className="mt-1 text-sm text-slate-500">Manage versioned documents and audit acceptance events. This area does not expose student records.</p></div>
      <button type="button" disabled={loading || busy} onClick={() => void refresh()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><RefreshCw className="h-4 w-4"/>Refresh legal records</button>
    </div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <article className={card}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Acceptance events</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{summary.total_acceptance_events.toLocaleString("en-IN")}</p><p className="mt-1 text-xs text-slate-500">All retained versions</p></article>
      <article className={card}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Users needing current acceptance</p><p className="mt-2 text-2xl font-bold tabular-nums text-amber-700">{summary.users_missing_current_acceptance.toLocaleString("en-IN")}</p><p className="mt-1 text-xs text-slate-500">Based on published required policies</p></article>
      <article className={card}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Published documents</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{documents.filter(item => item.status === "published").length}</p><p className="mt-1 text-xs text-slate-500">Draft and archived versions remain listed</p></article>
    </div>

    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <article className={card}>
        <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-[#6B1F38]"/><h3 className="font-bold text-slate-900">{selectedId ? "Edit legal draft" : "Create legal draft"}</h3></div><button type="button" onClick={resetEditor} className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B1F38]"><Plus className="h-4 w-4"/>New</button></div>
        <p className="mt-2 text-xs leading-5 text-slate-500">Save creates an immutable version once it is published. Create a new version for every later change.</p>
        <form onSubmit={saveDraft} className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-600">Document type<select disabled={Boolean(selectedId)} value={slug} onChange={event=>selectType(event.target.value as LegalSlug)} className={field}>{types.map(item=><option key={item.slug} value={item.slug}>{item.title}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-600">Title<input required maxLength={160} value={title} onChange={event=>setTitle(event.target.value)} className={field}/></label>
            <label className="block text-xs font-semibold text-slate-600">Version<input required maxLength={32} value={version} onChange={event=>setVersion(event.target.value)} className={field} placeholder="1.0"/></label>
          </div>
          <label className="block text-xs font-semibold text-slate-600">Locale<input required maxLength={12} value={locale} onChange={event=>setLocale(event.target.value)} className={field}/></label>
          <label className="block text-xs font-semibold text-slate-600">Document content (Markdown)<textarea required minLength={40} maxLength={200000} rows={17} value={body} onChange={event=>setBody(event.target.value)} className={field+" font-mono text-xs leading-5"} placeholder="# Policy title&#10;&#10;Write the complete policy here…"/></label>
          <label className="flex items-start gap-2 text-xs leading-5 text-slate-700"><input type="checkbox" checked={required} onChange={event=>setRequired(event.target.checked)} className="mt-0.5 accent-[#6B1F38]"/>Required for account access (Terms and Privacy Policy)</label>
          <label className="flex items-start gap-2 text-xs leading-5 text-rose-800"><input type="checkbox" checked={testOnly} onChange={event=>setTestOnly(event.target.checked)} className="mt-0.5 accent-rose-700"/>Development test copy only — never legally approved or suitable for production</label>
          <button disabled={busy || body.trim().length<40} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6B1F38] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{busy ? "Saving…" : selectedId ? "Save draft changes" : "Save new draft"}</button>
        </form>
      </article>

      <article className={card}>
        <div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-[#6B1F38]"/><h3 className="font-bold text-slate-900">Document versions</h3></div>
        {loading ? <p className="mt-4 text-sm text-slate-500">Loading versions…</p> : <div className="mt-4 space-y-4">
          {grouped.map(group=><div key={group.slug}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{group.title}</p>
            {group.items.length===0 ? <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">No versions created.</p> : <div className="space-y-2">
              {group.items.map(document=><div key={document.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">v{document.version}</p>
                  <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold "+(document.status==="published"?"bg-emerald-50 text-emerald-800":document.status==="draft"?"bg-amber-50 text-amber-800":"bg-slate-100 text-slate-600")}>{document.status}</span>
                  {document.is_test_only && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800">TEST ONLY</span>}
                  {document.is_required && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800">Required</span>}
                  <span className="ml-auto text-[10px] text-slate-400">{document.acceptance_count} acceptances</span>
                </div>
                <p className="mt-1 break-all font-mono text-[10px] text-slate-500">SHA-256: {document.content_sha256}</p>
                <p className="mt-1 text-[10px] text-slate-400">{document.published_at ? "Published " + new Date(document.published_at).toLocaleString() : "Created " + new Date(document.created_at).toLocaleString()}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {document.status==="draft" && <><button type="button" disabled={busy} onClick={()=>editDraft(document)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700">Edit draft</button><button type="button" disabled={busy} onClick={()=>void publish(document)} className="rounded-lg bg-[#6B1F38] px-2.5 py-1.5 text-[11px] font-semibold text-white">Publish</button></>}
                  {document.status==="published" && <button type="button" disabled={busy} onClick={()=>void archive(document)} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800"><Archive className="h-3 w-3"/>Archive</button>}
                </div>
              </div>)}
            </div>}
          </div>)}
        </div>}
      </article>
    </div>

    <article className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#6B1F38]"/><h3 className="font-bold text-slate-900">Acceptance evidence</h3></div><p className="mt-1 text-xs text-slate-500">Recent user and institution-level records. No student information is included.</p></div>
        <button type="button" disabled={busy || !summary.total_acceptance_events} onClick={()=>void exportAll()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><Download className="h-4 w-4"/>Export audit CSV</button>
      </div>
      {summary.recent_acceptances.length===0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No acceptance events have been recorded yet. Publish a reviewed or explicitly test-only version to exercise the acceptance flow.</p> : <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Account email</th><th className="p-3">Document</th><th className="p-3">Version</th><th className="p-3">Scope / method</th><th className="p-3">Accepted at (UTC)</th><th className="p-3">SHA-256</th></tr></thead>
          <tbody>{summary.recent_acceptances.map((record,index)=><tr key={record.user_email+record.document_slug+record.accepted_at+index} className="border-t border-slate-100"><td className="p-3 font-medium text-slate-800">{record.user_email}</td><td className="p-3">{record.document_title}</td><td className="p-3">{record.document_version}</td><td className="p-3">{record.acceptance_scope} · {record.acceptance_method}</td><td className="p-3">{new Date(record.accepted_at).toLocaleString()}</td><td className="max-w-40 truncate p-3 font-mono">{record.content_sha256}</td></tr>)}</tbody>
        </table>
      </div>}
      <p className="mt-3 text-[11px] leading-5 text-slate-500">Published documents are archived—not overwritten—when a replacement is published. Earlier acceptance records remain linked to their original document ID and exact content hash.</p>
    </article>
  </section>;
}
