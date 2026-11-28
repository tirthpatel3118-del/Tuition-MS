import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell, Check, CheckCheck, ClipboardList, Clock3, Globe, Mail, MessageSquareText,
  RefreshCw, Search, ShieldCheck, UserRound, Users, X,
} from "lucide-react";
import { createPlatformInvitation, listPlatformInstitutes, type PlatformInstitute } from "../services/platformAdminService";
import {
  getWebsiteSummary, listWebsiteAccessRequests, listWebsiteInquiries, listWebsiteNotifications,
  listWebsiteDemoRequests, listWebsiteDemoSessions, listWebsiteDemoActivity, markWebsiteNotificationRead,
  updateWebsiteAccessRequest, updateWebsiteInquiry, updateWebsiteDemoRequest,
  issueWebsiteDemoAccess, extendWebsiteDemoSession, revokeWebsiteDemoSession,
  type WebsiteAccessRequest, type WebsiteAccessStatus, type WebsiteInquiry, type WebsiteInquiryStatus,
  type WebsiteDemoRequest, type WebsiteDemoSession, type WebsiteDemoActivity, type WebsiteNotification, type WebsiteSummary,
} from "../services/websiteAdminService";

type WebsiteView = "inquiries" | "demos" | "sessions" | "activity" | "access" | "details" | "statuses" | "notifications";
const emptySummary: WebsiteSummary = {
  total_inquiries: 0, new_inquiries: 0, open_inquiries: 0,
  total_access_requests: 0, new_access_requests: 0, unread_notifications: 0,
};
const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const inputClass = "mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none focus:border-[#A03B5E] focus:ring-4 focus:ring-[#A03B5E]/10";
const labelClass = "block text-xs font-semibold text-slate-600";
const statusLabel: Record<string,string> = {
  new: "New", contacted: "Contacted", demo_scheduled: "Demo scheduled", closed: "Closed",
  reviewing: "Under review", approved: "Approved", rejected: "Rejected", link_generated: "Link generated",
  active: "Active", expired: "Expired", revoked: "Revoked",
};
function StatusPill({ status }: { status: string }) {
  const cls = status === "approved" || status === "closed" ? "bg-emerald-50 text-emerald-700"
    : status === "rejected" ? "bg-rose-50 text-rose-700"
    : status === "reviewing" || status === "demo_scheduled" ? "bg-sky-50 text-sky-700"
    : status === "contacted" ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-800";
  return <span className={"inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold " + cls}>{statusLabel[status] ?? status}</span>;
}
function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function WebsiteManagementPanel() {
  const [view, setView] = useState<WebsiteView>("inquiries");
  const [summary, setSummary] = useState<WebsiteSummary>(emptySummary);
  const [inquiries, setInquiries] = useState<WebsiteInquiry[]>([]);
  const [accessRequests, setAccessRequests] = useState<WebsiteAccessRequest[]>([]);
  const [demoRequests, setDemoRequests] = useState<WebsiteDemoRequest[]>([]);
  const [demoSessions, setDemoSessions] = useState<WebsiteDemoSession[]>([]);
  const [demoActivity, setDemoActivity] = useState<WebsiteDemoActivity[]>([]);
  const [selectedDemo, setSelectedDemo] = useState<WebsiteDemoRequest | null>(null);
  const [demoNotes, setDemoNotes] = useState("");
  const [demoLink, setDemoLink] = useState("");
  const [notifications, setNotifications] = useState<WebsiteNotification[]>([]);
  const [institutes, setInstitutes] = useState<PlatformInstitute[]>([]);
  const [search, setSearch] = useState("");
  const [inquiryFilter, setInquiryFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");
  const [selectedInquiry, setSelectedInquiry] = useState<WebsiteInquiry | null>(null);
  const [inquiryStatus, setInquiryStatus] = useState<WebsiteInquiryStatus>("new");
  const [inquiryNotes, setInquiryNotes] = useState("");
  const [selectedAccess, setSelectedAccess] = useState<WebsiteAccessRequest | null>(null);
  const [accessNotes, setAccessNotes] = useState("");
  const [accessInstituteId, setAccessInstituteId] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextSummary, nextInquiries, nextAccess, nextNotifications, nextInstitutes, nextDemos, nextDemoSessions, nextDemoActivity] = await Promise.all([
        getWebsiteSummary(), listWebsiteInquiries(), listWebsiteAccessRequests(),
        listWebsiteNotifications(), listPlatformInstitutes(), listWebsiteDemoRequests(),
        listWebsiteDemoSessions(), listWebsiteDemoActivity(),
      ]);
      setSummary(nextSummary);
      setInquiries(nextInquiries);
      setAccessRequests(nextAccess);
      setDemoRequests(nextDemos);
      setDemoSessions(nextDemoSessions);
      setDemoActivity(nextDemoActivity);
      setNotifications(nextNotifications);
      setInstitutes(nextInstitutes);
      setSelectedInquiry(current => current ? nextInquiries.find(item => item.id === current.id) ?? current : null);
      setSelectedAccess(current => current ? nextAccess.find(item => item.id === current.id) ?? current : null);
      setSelectedDemo(current => current ? nextDemos.find(item => item.id === current.id) ?? current : null);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not load website management data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredInquiries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return inquiries.filter(item => (inquiryFilter === "all" || item.status === inquiryFilter) &&
      (!term || [item.reference_code,item.requester_name,item.institute_name,item.email,item.city ?? "",item.enquiry_type].some(value => value.toLowerCase().includes(term))));
  }, [inquiries, inquiryFilter, search]);

  const filteredAccessRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accessRequests.filter(item => (accessFilter === "all" || item.status === accessFilter) &&
      (!term || [item.reference_code,item.requester_name,item.institute_name,item.email,item.city ?? "",item.requested_role].some(value => value.toLowerCase().includes(term))));
  }, [accessRequests, accessFilter, search]);

  const openInquiry = (item: WebsiteInquiry) => {
    setSelectedInquiry(item);
    setInquiryStatus(item.status);
    setInquiryNotes(item.admin_notes);
    setView("details");
  };

  const openAccess = (item: WebsiteAccessRequest) => {
    setSelectedAccess(item);
    setAccessNotes(item.admin_notes);
    const matched = institutes.find(institute => institute.name.toLowerCase() === item.institute_name.toLowerCase());
    setAccessInstituteId(matched?.institute_id ?? "");
    setInviteLink("");
  };

  const saveInquiry = async () => {
    if (!selectedInquiry) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await updateWebsiteInquiry(selectedInquiry.id, inquiryStatus, inquiryNotes);
      setNotice("Website enquiry status and internal notes saved.");
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not update website enquiry.");
    } finally { setBusy(false); }
  };

  const saveAccessStatus = async (status: WebsiteAccessStatus) => {
    if (!selectedAccess) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await updateWebsiteAccessRequest(selectedAccess.id, status, accessNotes);
      setNotice("Access request updated.");
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not update access request.");
    } finally { setBusy(false); }
  };

  const approveAccessAndInvite = async () => {
    if (!selectedAccess) return;
    if (selectedAccess.requested_role !== "owner" && !accessInstituteId) {
      setError("Select the institute that this teacher or accountant should join.");
      return;
    }
    setBusy(true); setError(""); setNotice(""); setInviteLink("");
    try {
      const invitation = await createPlatformInvitation({
        email: selectedAccess.email,
        role: selectedAccess.requested_role,
        instituteId: selectedAccess.requested_role === "owner" ? null : accessInstituteId,
      });
      await updateWebsiteAccessRequest(selectedAccess.id, "approved", accessNotes, invitation.invitation_id);
      setInviteLink(invitation.action_link);
      setNotice("Access request approved and a secure platform invitation generated. Share the invitation link with the requester.");
      await refresh();
      setView("access");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not approve the access request.");
    } finally { setBusy(false); }
  };

  const markRead = async (item: WebsiteNotification) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await markWebsiteNotificationRead(item.id);
      await refresh();
      setNotice("Notification marked as read.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not update notification.");
    } finally { setBusy(false); }
  };

  const openDemo = (item: WebsiteDemoRequest) => {
    setSelectedDemo(item);
    setDemoNotes(item.admin_notes ?? "");
    setDemoLink("");
  };

  const saveDemoDecision = async (status: "reviewing" | "approved" | "rejected") => {
    if (!selectedDemo) return;
    setBusy(true); setError(""); setNotice(""); setDemoLink("");
    try {
      await updateWebsiteDemoRequest(selectedDemo.id, status, demoNotes);
      setNotice(status === "approved" ? "Demo request approved. Generate a private link when ready."
        : status === "rejected" ? "Demo request rejected. You can prepare a manual email response."
        : "Demo request moved to review.");
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not update the demo request.");
    } finally { setBusy(false); }
  };

  const generateDemoLink = async () => {
    if (!selectedDemo) return;
    setBusy(true); setError(""); setNotice(""); setDemoLink("");
    try {
      const invitation = await issueWebsiteDemoAccess(selectedDemo.id);
      const baseUrl = window.location.origin.replace(/\/$/, "");
      const url = baseUrl + "/demo-access?token=" + encodeURIComponent(invitation.token);
      setDemoLink(url);
      setNotice("A private demo invitation was generated. Copy it or open the Gmail draft; the raw invitation is shown only once.");
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not generate a demo invitation.");
    } finally { setBusy(false); }
  };

  const openDemoEmailDraft = (kind: "approved" | "rejected") => {
    if (!selectedDemo) return;
    const subject = kind === "approved"
      ? "Your ClassBandhu ERP demo invitation"
      : "Update on your ClassBandhu ERP demo request";
    const body = kind === "approved"
      ? [
          "Hello " + selectedDemo.requester_name + ",",
          "",
          "Thank you for requesting a ClassBandhu ERP demo.",
          "Your private demo invitation is ready:",
          demoLink || "[Paste the generated private demo link here]",
          "",
          "Please open the link within 48 hours. The 20-minute session starts on first successful opening. You can reopen it on the same browser while the session remains active. One 10-minute extension can be granted by our team.",
          "",
          "Please use fictional sample details only. Demo edits are temporary and reset when the page is refreshed.",
          "",
          "Regards,",
          "ClassBandhu Team",
        ].join("\n")
      : [
          "Hello " + selectedDemo.requester_name + ",",
          "",
          "Thank you for your interest in ClassBandhu. After reviewing your demo request, we are unable to provide access at this time.",
          "",
          "You may reply to this email if you would like to discuss your requirements or request a future review.",
          "",
          "Regards,",
          "ClassBandhu Team",
        ].join("\n");
    const gmailUrl = "https://mail.google.com/mail/?view=cm&fs=1&to=" +
      encodeURIComponent(selectedDemo.email) + "&su=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    window.open(gmailUrl, "_blank", "noopener,noreferrer");
  };

  const copyDemoLink = async () => {
    if (!demoLink) return;
    try {
      await navigator.clipboard.writeText(demoLink);
      setNotice("Private demo link copied. Send it manually to the requester.");
    } catch {
      setError("Clipboard access was blocked. Select and copy the invitation link manually.");
    }
  };

  const extendDemoSession = async (item: WebsiteDemoSession) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const expiry = await extendWebsiteDemoSession(item.demo_access_id);
      setNotice("The session was extended by 10 minutes, until " + dateLabel(expiry) + ".");
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not extend this demo session.");
    } finally { setBusy(false); }
  };

  const revokeDemoSession = async (item: WebsiteDemoSession) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await revokeWebsiteDemoSession(item.demo_access_id);
      setNotice("Demo access revoked. The visitor will be blocked at the next server validation.");
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not revoke this demo access.");
    } finally { setBusy(false); }
  };

  const views: Array<{ id: WebsiteView; label: string; icon: typeof Globe; count?: number }> = [
    { id: "inquiries", label: "Website inquiries", icon: MessageSquareText, count: summary.new_inquiries },
    { id: "demos", label: "Demo requests", icon: ShieldCheck, count: demoRequests.filter(item => ["new","reviewing"].includes(item.demo_status)).length },
    { id: "sessions", label: "Demo sessions", icon: Clock3, count: demoSessions.filter(item => item.status === "active").length },
    { id: "activity", label: "Activity history", icon: ClipboardList },
    { id: "access", label: "Access requests", icon: ShieldCheck, count: summary.new_access_requests },
    { id: "details", label: "Inquiry details", icon: ClipboardList },
    { id: "statuses", label: "Status management", icon: Check },
    { id: "notifications", label: "Notifications", icon: Bell, count: summary.unread_notifications },
  ];

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
      {[
        { label: "All enquiries", value: summary.total_inquiries, icon: MessageSquareText },
        { label: "New enquiries", value: summary.new_inquiries, icon: Mail },
        { label: "Open enquiries", value: summary.open_inquiries, icon: Clock3 },
        { label: "Access requests", value: summary.total_access_requests, icon: Users },
        { label: "New access", value: summary.new_access_requests, icon: UserRound },
        { label: "Unread alerts", value: summary.unread_notifications, icon: Bell },
      ].map(card => {
        const Icon = card.icon;
        return <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{card.label}</p><Icon className="h-4 w-4 text-[#8A3452]"/></div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{card.value}</p>
        </article>;
      })}
    </div>

    <section className={panelClass}>
      <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
        {views.map(tab => <button key={tab.id} type="button" onClick={() => setView(tab.id)}
          className={"inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition " + (view === tab.id ? "bg-[#6B1F38] text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100")}>
          <tab.icon className="h-4 w-4"/>{tab.label}
          {Boolean(tab.count) && <span className={"rounded-full px-2 py-0.5 text-[10px] " + (view === tab.id ? "bg-white/20 text-white" : "bg-white text-slate-700")}>{tab.count}</span>}
        </button>)}
        <button type="button" disabled={loading || busy} onClick={() => void refresh()} className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">
          <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")}/>Refresh
        </button>
      </div>

      {error && <div role="alert" className="mx-3 mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"><X className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}
      {notice && <div role="status" className="mx-3 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{notice}</div>}

      {view === "inquiries" && <div className="space-y-3 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr,220px]">
          <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input aria-label="Search website enquiries" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, institute, email or reference…" className={inputClass+" pl-10"}/></label>
          <select aria-label="Filter enquiries by status" value={inquiryFilter} onChange={event => setInquiryFilter(event.target.value)} className={inputClass}><option value="all">All enquiry statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="demo_scheduled">Demo scheduled</option><option value="closed">Closed</option></select>
        </div>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading enquiries…</p> : filteredInquiries.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No website enquiries match this filter.</p> : <div className="divide-y divide-slate-100">
          {filteredInquiries.map(item => <article key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{item.requester_name}</strong><StatusPill status={item.status}/><span className="text-[10px] font-semibold text-slate-400">{item.reference_code}</span></div><p className="mt-1 text-xs text-slate-600">{item.institute_name} · {item.enquiry_type}</p><p className="mt-1 text-[11px] text-slate-400">{item.email} · {dateLabel(item.created_at)}</p></div>
            <button type="button" onClick={() => openInquiry(item)} className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">View enquiry details</button>
          </article>)}
        </div>}
      </div>}

      {view === "demos" && <div className="grid gap-4 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr),minmax(320px,420px)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="text-sm font-bold text-slate-900">Product demo requests</h3><p className="mt-1 text-xs text-slate-500">Review requests before issuing a private 20-minute demo invitation.</p></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{demoRequests.length} requests</span>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading demo requests…</p>
              : demoRequests.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No demo requests yet. New website submissions will appear here.</p>
              : demoRequests.map(item => <button key={item.id} type="button" onClick={() => openDemo(item)}
                className={"block w-full rounded-xl px-3 py-3 text-left transition " + (selectedDemo?.id === item.id ? "bg-rose-50" : "hover:bg-slate-50")}>
                <div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{item.requester_name}</strong><StatusPill status={item.demo_status}/><span className="text-[10px] font-semibold text-slate-400">{item.reference_code}</span></div>
                <p className="mt-1 text-xs text-slate-600">{item.institute_name}{item.student_count !== null ? " · " + item.student_count + " students" : ""}</p>
                <p className="mt-1 text-[11px] text-slate-400">{item.email} · {dateLabel(item.created_at)}</p>
              </button>)}
          </div>
        </div>
        {selectedDemo ? <aside className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#A03B5E]">Demo request {selectedDemo.reference_code}</p><h3 className="mt-1 text-base font-bold text-slate-900">{selectedDemo.requester_name}</h3></div><StatusPill status={selectedDemo.demo_status}/></div>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div><dt className="text-slate-400">Institute</dt><dd className="font-semibold text-slate-800">{selectedDemo.institute_name}</dd></div>
            <div><dt className="text-slate-400">Email</dt><dd className="break-all font-semibold text-slate-800">{selectedDemo.email}</dd></div>
            <div><dt className="text-slate-400">Mobile</dt><dd className="font-semibold text-slate-800">{selectedDemo.phone || "Not provided"}</dd></div>
            <div><dt className="text-slate-400">Students</dt><dd className="font-semibold text-slate-800">{selectedDemo.student_count ?? "Not provided"}</dd></div>
            <div><dt className="text-slate-400">Submitted</dt><dd className="font-semibold text-slate-800">{dateLabel(selectedDemo.created_at)}</dd></div>
            <div><dt className="text-slate-400">Link expiry</dt><dd className="font-semibold text-slate-800">{selectedDemo.link_expires_at ? dateLabel(selectedDemo.link_expires_at) : "Not generated"}</dd></div>
            <div><dt className="text-slate-400">Session expiry</dt><dd className="font-semibold text-slate-800">{selectedDemo.session_expires_at ? dateLabel(selectedDemo.session_expires_at) : "Not activated"}</dd></div>
          </dl>
          <div className="mt-4 rounded-xl bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Requirements / message</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{selectedDemo.message || "No additional message."}</p></div>
          <label className={labelClass + " mt-4"}>Internal notes (private)<textarea rows={3} value={demoNotes} onChange={event => setDemoNotes(event.target.value)} className={inputClass} maxLength={4000} placeholder="Add review notes or a private reason for rejection. These notes are not sent to the visitor."/></label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => void saveDemoDecision("reviewing")} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Mark reviewing</button>
            <button type="button" disabled={busy} onClick={() => void saveDemoDecision("approved")} className="min-h-10 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Approve</button>
            <button type="button" disabled={busy} onClick={() => void saveDemoDecision("rejected")} className="min-h-10 rounded-xl bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Reject</button>
            <button type="button" disabled={busy || !["approved","link_generated"].includes(selectedDemo.demo_status)} onClick={() => void generateDemoLink()} className="min-h-10 rounded-xl bg-[#6B1F38] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Generate / reissue link</button>
          </div>
          {demoLink && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-bold text-emerald-900">Private invitation link (shown once)</p>
            <p className="mt-2 break-all text-xs leading-5 text-emerald-900">{demoLink}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void copyDemoLink()} className="min-h-10 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-900">Copy link</button>
              <button type="button" onClick={() => openDemoEmailDraft("approved")} className="min-h-10 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white">Open Gmail draft</button>
            </div>
          </div>}
          {selectedDemo.demo_status === "rejected" && <button type="button" onClick={() => openDemoEmailDraft("rejected")} className="mt-3 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">Prepare rejection email</button>}
          <p className="mt-3 text-[10px] leading-5 text-slate-500">Invitation opens for 48 hours. First activation starts a 20-minute server-timed session. The same browser can reopen it while active; one 10-minute extension is available. Reissuing a link revokes the previous invitation/session.</p>
        </aside> : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Select a demo request to review its details and take action.</div>}
      </div>}

      {view === "sessions" && <div className="space-y-3 p-3 sm:p-4">
        <div><h3 className="text-sm font-bold text-slate-900">Demo sessions</h3><p className="mt-1 text-xs text-slate-500">Monitor invitation expiry, active sessions, extensions and revocations.</p></div>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading demo sessions…</p>
          : demoSessions.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No demo sessions have been issued yet.</p>
          : <div className="divide-y divide-slate-100">{demoSessions.map(item => <article key={item.demo_access_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{item.requester_name}</strong><StatusPill status={item.status}/><span className="text-[10px] font-semibold text-slate-400">{item.reference_code}</span></div>
              <p className="mt-1 text-xs text-slate-600">{item.institute_name} · {item.email}</p>
              <p className="mt-1 text-[11px] text-slate-400">Link valid until {dateLabel(item.link_expires_at)} · {item.activated_at ? "Started " + dateLabel(item.activated_at) : "Not opened yet"}</p>
              <p className="mt-1 text-[11px] text-slate-400">{item.session_expires_at ? "Session expires " + dateLabel(item.session_expires_at) : "Session not started"}{item.extended_at ? " · Extended once" : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || item.status !== "active" || Boolean(item.extended_at)} onClick={() => void extendDemoSession(item)} className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">Extend 10 min</button>
              <button type="button" disabled={busy || item.status === "revoked" || item.status === "expired"} onClick={() => void revokeDemoSession(item)} className="min-h-10 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-40">Revoke access</button>
            </div>
          </article>)}</div>}
      </div>}

      {view === "activity" && <div className="space-y-3 p-3 sm:p-4">
        <div><h3 className="text-sm font-bold text-slate-900">Demo activity history</h3><p className="mt-1 text-xs text-slate-500">A server-recorded audit trail of review decisions, invitation issuance, session activation, extensions and revocations.</p></div>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading activity…</p>
          : demoActivity.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No demo activity has been recorded yet.</p>
          : <div className="divide-y divide-slate-100">{demoActivity.map(item => <article key={item.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{item.requester_name}</strong><StatusPill status={item.action.toLowerCase().replaceAll("_"," ")}/><span className="text-[10px] font-semibold text-slate-400">{item.reference_code}</span></div>
              <time className="text-[10px] text-slate-400">{dateLabel(item.created_at)}</time>
            </div>
            <p className="mt-1 text-xs text-slate-600">{item.institute_name} · {item.action.replaceAll("_"," ")}</p>
            <p className="mt-1 text-[10px] text-slate-400">{item.actor_email ? "By " + item.actor_email : "Visitor action"} · {Object.keys(item.details || {}).length ? Object.entries(item.details).map(([key,value]) => key.replaceAll("_"," ") + ": " + String(value)).join(" · ") : "No additional detail"}</p>
          </article>)}</div>}
      </div>}

      {view === "access" && <div className="grid gap-4 p-3 sm:p-4 xl:grid-cols-[1fr,1fr]">
        <div className="min-w-0">
          <div className="grid gap-2 sm:grid-cols-[1fr,180px]">
            <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input aria-label="Search access requests" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search requester, institute or email…" className={inputClass+" pl-10"}/></label>
            <select aria-label="Filter access requests by status" value={accessFilter} onChange={event => setAccessFilter(event.target.value)} className={inputClass}><option value="all">All access statuses</option><option value="new">New</option><option value="reviewing">Reviewing</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="closed">Closed</option></select>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading access requests…</p> : filteredAccessRequests.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No access requests match this filter.</p> : filteredAccessRequests.map(item => <button key={item.id} type="button" onClick={() => openAccess(item)} className={"block w-full rounded-xl px-3 py-3 text-left transition "+(selectedAccess?.id===item.id?"bg-rose-50":"hover:bg-slate-50")}>
              <div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{item.requester_name}</strong><StatusPill status={item.status}/></div>
              <p className="mt-1 text-xs text-slate-600">{item.institute_name} · {item.requested_role}</p><p className="mt-1 text-[11px] text-slate-400">{item.email} · {item.reference_code}</p>
            </button>)}
          </div>
        </div>
        {selectedAccess ? <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#A03B5E]">Access request {selectedAccess.reference_code}</p><h3 className="mt-1 text-base font-bold text-slate-900">{selectedAccess.requester_name}</h3></div><StatusPill status={selectedAccess.status}/></div>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div><dt className="text-slate-400">Email</dt><dd className="font-semibold text-slate-800">{selectedAccess.email}</dd></div>
            <div><dt className="text-slate-400">Requested role</dt><dd className="font-semibold capitalize text-slate-800">{selectedAccess.requested_role}</dd></div>
            <div><dt className="text-slate-400">Institute</dt><dd className="font-semibold text-slate-800">{selectedAccess.institute_name}</dd></div>
            <div><dt className="text-slate-400">Contact</dt><dd className="font-semibold text-slate-800">{selectedAccess.phone || "Not provided"}</dd></div>
          </dl>
          {selectedAccess.message && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-5 text-slate-600">{selectedAccess.message}</p>}
          <label className={labelClass+" mt-3"}>Internal notes<textarea rows={3} value={accessNotes} onChange={event=>setAccessNotes(event.target.value)} className={inputClass}/></label>
          {selectedAccess.status!=="approved" && selectedAccess.status!=="rejected" && <div className="mt-3 space-y-2">
            {selectedAccess.requested_role!=="owner" && <label className={labelClass}>Assign institute before issuing invite<select value={accessInstituteId} onChange={event=>setAccessInstituteId(event.target.value)} className={inputClass}><option value="">Select institute…</option>{institutes.filter(i=>!i.archived_at).map(i=><option key={i.institute_id} value={i.institute_id}>{i.name}</option>)}</select></label>}
            <button type="button" disabled={busy} onClick={()=>void approveAccessAndInvite()} className="min-h-10 w-full rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Approve & generate invitation</button>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" disabled={busy} onClick={()=>void saveAccessStatus("reviewing")} className="min-h-10 rounded-xl border border-sky-200 bg-sky-50 px-2 py-2 text-xs font-bold text-sky-800 disabled:opacity-50">Reviewing</button>
              <button type="button" disabled={busy} onClick={()=>void saveAccessStatus("rejected")} className="min-h-10 rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-xs font-bold text-rose-800 disabled:opacity-50">Reject</button>
              <button type="button" disabled={busy} onClick={()=>void saveAccessStatus("closed")} className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Close</button>
            </div>
          </div>}
          {selectedAccess.linked_invitation_id && <p className="mt-3 break-all text-[11px] text-slate-500">Invitation ID: {selectedAccess.linked_invitation_id}</p>}
          {inviteLink && <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3"><p className="text-xs font-semibold text-emerald-800">Invitation ready to share</p><a className="mt-1 block break-all text-xs text-sky-700 underline" href={inviteLink} target="_blank" rel="noreferrer">Open invitation link</a><button type="button" onClick={()=>void navigator.clipboard.writeText(inviteLink)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><CheckCheck className="h-3.5 w-3.5"/>Copy invitation link</button></div>}
        </div> : <div className="flex min-h-52 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">Select an access request to review it.</div>}
      </div>}

      {view === "details" && <div className="p-3 sm:p-4">
        {!selectedInquiry ? <div className="py-12 text-center text-sm text-slate-500">Select an enquiry from Website inquiries to see its full details here.</div> : <div className="grid gap-4 xl:grid-cols-[1fr,340px]">
          <article className="min-w-0 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#A03B5E]">Enquiry {selectedInquiry.reference_code}</p><h3 className="mt-1 text-lg font-bold text-slate-900">{selectedInquiry.requester_name}</h3><p className="mt-1 text-xs text-slate-500">{selectedInquiry.institute_name} · {dateLabel(selectedInquiry.created_at)}</p></div><StatusPill status={selectedInquiry.status}/></div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[["Email",selectedInquiry.email],["Phone",selectedInquiry.phone||"Not provided"],["City",selectedInquiry.city||"Not provided"],["Enquiry",selectedInquiry.enquiry_type],["Preferred contact",selectedInquiry.contact_preference]].map(([label,value])=><div key={label}><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd></div>)}
            </dl>
            <div className="mt-5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Message</p><p className="mt-2 min-h-20 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{selectedInquiry.message||"No additional message provided."}</p></div>
          </article>
          <aside className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <h4 className="text-sm font-bold text-slate-900">Status management</h4>
            <label className={labelClass+" mt-3"}>Enquiry status<select value={inquiryStatus} onChange={event=>setInquiryStatus(event.target.value as WebsiteInquiryStatus)} className={inputClass}><option value="new">New</option><option value="contacted">Contacted</option><option value="demo_scheduled">Demo scheduled</option><option value="closed">Closed</option></select></label>
            <label className={labelClass+" mt-3"}>Private notes<textarea rows={5} value={inquiryNotes} onChange={event=>setInquiryNotes(event.target.value)} className={inputClass} placeholder="Internal notes visible only to Super Admin"/></label>
            <button type="button" disabled={busy} onClick={()=>void saveInquiry()} className="mt-3 min-h-10 w-full rounded-xl bg-[#6B1F38] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy?"Saving…":"Save enquiry update"}</button>
            <p className="mt-3 text-[10px] leading-5 text-slate-500">Contact the requester through their selected contact method. Internal notes are never shown on the public website.</p>
          </aside>
        </div>}
      </div>}

      {view === "statuses" && <div className="space-y-4 p-3 sm:p-4">
        <div><h3 className="text-sm font-bold text-slate-900">Website enquiry statuses</h3><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{(["new","contacted","demo_scheduled","closed"] as WebsiteInquiryStatus[]).map(status=><div key={status} className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-bold text-slate-900">{inquiries.filter(i=>i.status===status).length}</p><p className="text-[11px] text-slate-500">{statusLabel[status]}</p></div>)}</div></div>
        <div><h3 className="text-sm font-bold text-slate-900">Access request statuses</h3><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">{(["new","reviewing","approved","rejected","closed"] as WebsiteAccessStatus[]).map(status=><div key={status} className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-bold text-slate-900">{accessRequests.filter(i=>i.status===status).length}</p><p className="text-[11px] text-slate-500">{statusLabel[status]}</p></div>)}</div></div>
        <div className="rounded-xl border border-slate-200 p-3 text-xs leading-5 text-slate-600">Use Inquiry details to update enquiry status and internal notes. Use Access requests to review requests, assign the correct institute where required, and generate an invitation before approving access.</div>
      </div>}

      {view === "notifications" && <div className="divide-y divide-slate-100 p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-slate-900">Website notifications</h3><p className="mt-1 text-xs text-slate-500">New website enquiries, access requests and status changes.</p></div><span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">{summary.unread_notifications} unread</span></div>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading notifications…</p> : notifications.length===0 ? <p className="py-8 text-center text-sm text-slate-500">No website notifications yet.</p> : notifications.map(item=><article key={item.id} className={"flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between "+(!item.read_at?"bg-rose-50/40":"")}>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{item.title}</strong>{!item.read_at&&<span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">New</span>}</div><p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p><p className="mt-1 text-[10px] text-slate-400">{item.reference_code} · {dateLabel(item.created_at)}</p></div>
          {!item.read_at&&<button type="button" disabled={busy} onClick={()=>void markRead(item)} className="min-h-9 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Mark read</button>}
        </article>)}
      </div>}
    </section>
    <p className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-[11px] leading-5 text-sky-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>Website request data is isolated from institute academic records. Only authenticated ClassBandhu Platform Administrators can review enquiries, access requests and private notes.</p>
  </div>;
}
