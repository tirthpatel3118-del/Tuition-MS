import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, ArrowDownRight, Building2, Check, ChevronDown, Clock3, Copy, Database,
  GraduationCap, HardDrive, LogOut, Mail, RefreshCw, Search, ShieldCheck, Sparkles,
  UserPlus, Users, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  createPlatformInvitation, formatBytes, getPlatformOverview, listPlatformInstitutes,
  listPlatformInvitations, revokePlatformInvitation, savePlatformInstituteControls,
  type PlatformInstitute, type PlatformInvitation, type PlatformOverview,
} from "../services/platformAdminService";

type InstituteDraft = {
  accessStatus: "active" | "suspended";
  planCode: string;
  subscriptionStatus: PlatformInstitute["subscription_status"];
  expiresAt: string;
  studentLimit: string;
  teamLimit: string;
};

const emptyOverview: PlatformOverview = {
  institute_count: 0, student_count: 0, team_member_count: 0, owner_count: 0, teacher_count: 0,
  accountant_count: 0, active_members_30d: 0, active_subscriptions: 0, suspended_institutes: 0,
  database_bytes: 0, storage_bytes_project_wide: 0, storage_objects_project_wide: 0,
  per_institute_storage_attribution: false, student_login_tracking_available: false,
};

const fieldClass = "mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#A03B5E] focus:ring-4 focus:ring-[#A03B5E]/10";
const labelClass = "block text-xs font-semibold tracking-wide text-slate-600";

function MetricCard({ label, value, note, icon: Icon, tone }: {
  label: string; value: string | number; note: string; icon: typeof Building2; tone: "rose" | "blue" | "violet" | "emerald" | "amber" | "slate";
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,0.035)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-500 sm:text-[11px] sm:tracking-[0.12em]">{label}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-slate-950 sm:mt-3 sm:text-3xl">{value}</p>
      </div>
      <span className={`rounded-xl p-2 ring-1 sm:rounded-2xl sm:p-3 ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
    </div>
    <p className="mt-1.5 text-[11px] leading-4 text-slate-500 sm:mt-2 sm:text-xs sm:leading-5">{note}</p>
    <div className="absolute -bottom-7 -right-5 h-20 w-20 rounded-full bg-slate-50/80 transition group-hover:scale-125" />
  </article>;
}

function SectionHeading({ eyebrow, title, description, icon: Icon }: {
  eyebrow?: string; title: string; description?: string; icon?: typeof Building2;
}) {
  return <div className="flex items-start gap-3">
    {Icon && <span className="rounded-xl bg-[#F8E9ED] p-2.5 text-[#6B1F38]"><Icon className="h-5 w-5" /></span>}
    <div className="min-w-0">
      {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A03B5E]">{eyebrow}</p>}
      <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>}
    </div>
  </div>;
}

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function SuperAdminDashboard() {
  const { platformAdmin, email, signOut } = useAuth();
  const [overview, setOverview] = useState<PlatformOverview>(emptyOverview);
  const [institutes, setInstitutes] = useState<PlatformInstitute[]>([]);
  const [invitations, setInvitations] = useState<PlatformInvitation[]>([]);
  const [drafts, setDrafts] = useState<Record<string, InstituteDraft>>({});
  const [search, setSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "teacher" | "accountant">("owner");
  const [inviteInstitute, setInviteInstitute] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextOverview, nextInstitutes, nextInvitations] = await Promise.all([
        getPlatformOverview(), listPlatformInstitutes(), listPlatformInvitations(),
      ]);
      setOverview(nextOverview);
      setInstitutes(nextInstitutes);
      setInvitations(nextInvitations);
      setDrafts(Object.fromEntries(nextInstitutes.map(item => [item.institute_id, {
        accessStatus: item.access_status,
        planCode: item.plan_code || "trial",
        subscriptionStatus: item.subscription_status,
        expiresAt: dateInput(item.expires_at),
        studentLimit: item.student_limit == null ? "" : String(item.student_limit),
        teamLimit: item.team_limit == null ? "" : String(item.team_limit),
      }])));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not load platform data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (platformAdmin) void refresh();
  }, [platformAdmin, refresh]);

  const visibleInstitutes = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return institutes;
    return institutes.filter(item => item.name.toLowerCase().includes(value) || item.slug.toLowerCase().includes(value));
  }, [institutes, search]);

  const updateDraft = (id: string, patch: Partial<InstituteDraft>) => {
    setDrafts(current => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const saveInstitute = async (item: PlatformInstitute) => {
    const draft = drafts[item.institute_id];
    if (!draft) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await savePlatformInstituteControls({
        instituteId: item.institute_id,
        accessStatus: draft.accessStatus,
        planCode: draft.planCode,
        subscriptionStatus: draft.subscriptionStatus,
        startsAt: null,
        expiresAt: draft.expiresAt ? new Date(draft.expiresAt + "T23:59:59+05:30").toISOString() : null,
        studentLimit: draft.studentLimit === "" ? null : Number(draft.studentLimit),
        teamLimit: draft.teamLimit === "" ? null : Number(draft.teamLimit),
      });
      setNotice("Institute access and subscription settings saved.");
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not save institute settings.");
    } finally {
      setBusy(false);
    }
  };

  const createInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice(""); setInviteLink("");
    try {
      const result = await createPlatformInvitation({
        email: inviteEmail,
        role: inviteRole,
        instituteId: inviteInstitute || null,
      });
      setInviteLink(result.action_link);
      setInviteEmail("");
      setNotice(result.requires_password_setup
        ? "Invitation generated. The new account holder can set their password using this secure link."
        : "A one-time sign-in invitation has been generated for the existing account.");
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not create the invitation.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Clipboard access was unavailable. Select and copy the link manually.");
    }
  };

  const revokeInvite = async (item: PlatformInvitation) => {
    if (!window.confirm("Revoke this pending invitation?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await revokePlatformInvitation(item.id);
      setNotice("Invitation revoked.");
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not revoke invitation.");
    } finally {
      setBusy(false);
    }
  };

  if (!platformAdmin) {
    return <main className="mx-auto max-w-xl px-4 py-16">
      <section className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-10 w-10 text-rose-700" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">Access restricted</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Only the designated EduLedger platform administrator can access this area.</p>
      </section>
    </main>;
  }

  const pendingInvitations = invitations.filter(item => item.status === "Pending").length;

  return <main className="mx-auto max-w-[1480px] space-y-4 pb-6 sm:space-y-6 sm:pb-8">
    <header className="relative isolate overflow-hidden rounded-[22px] bg-gradient-to-br from-[#32101F] via-[#57172D] to-[#7B2947] px-4 py-5 text-white sm:rounded-[26px] sm:px-7 sm:py-7 shadow-[0_16px_40px_rgba(77,20,43,0.18)] sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute -right-12 -top-24 -z-10 h-72 w-72 rounded-full border-[34px] border-white/[0.06]" />
      <div className="pointer-events-none absolute bottom-[-90px] right-[22%] -z-10 h-56 w-56 rounded-full bg-white/[0.04] blur-2xl" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-rose-100">
            <Sparkles className="h-3.5 w-3.5" /> EduLedger control center
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:mt-4 sm:text-4xl">Good to see you.</h1>
          <p className="mt-2 max-w-xl text-sm leading-5 text-rose-100/80 sm:leading-6">Your platform at a glance. Monitor institute growth, service usage and access from one place.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-rose-100/80">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Super Admin</span>
            <span className="max-w-full truncate rounded-full bg-white/10 px-3 py-1.5">{email ?? "Designated administrator"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void refresh()} disabled={loading || busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />{loading ? "Refreshing" : "Refresh data"}
          </button>
          <button type="button" onClick={() => void signOut()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#57172D] transition hover:bg-rose-50">
            <LogOut className="h-4 w-4" />Sign out
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/15 pt-4 text-xs text-rose-100/75">
        <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Live platform overview</span>
        <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Team activity · last 30 days</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Privacy-first metrics</span>
      </div>
    </header>

    {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><X className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
    {notice && <div role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><Check className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}

    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A03B5E]">Platform snapshot</p><h2 className="text-lg font-bold text-slate-900">Key numbers</h2></div>
        <span className="text-[11px] text-slate-400">{loading ? "Updating…" : "Latest available data"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3">
        <MetricCard label="Institutions" value={overview.institute_count} note="Registered workspaces" icon={Building2} tone="rose" />
        <MetricCard label="Students" value={overview.student_count} note="Aggregate count only" icon={GraduationCap} tone="blue" />
        <MetricCard label="Team members" value={overview.team_member_count} note={overview.owner_count + " owners · " + overview.teacher_count + " teachers · " + overview.accountant_count + " accountants"} icon={Users} tone="violet" />
        <MetricCard label="Team active · 30 days" value={overview.active_members_30d} note="Unique invited team accounts active" icon={Activity} tone="emerald" />
        <MetricCard label="Active subscriptions" value={overview.active_subscriptions} note="Trial, active or grace-period plans" icon={ShieldCheck} tone="amber" />
        <MetricCard label="Suspended institutes" value={overview.suspended_institutes} note="Workspace access currently blocked" icon={Building2} tone="slate" />
      </div>
    </section>

    <section className="grid gap-3 sm:gap-4 lg:grid-cols-2">
      <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="rounded-xl bg-sky-50 p-2.5 text-sky-700"><Database className="h-5 w-5" /></span><div><h3 className="font-bold text-slate-900">Database usage</h3><p className="text-xs text-slate-500">Whole Supabase project</p></div></div><span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700">PROJECT-WIDE</span></div>
        <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums text-slate-950">{formatBytes(overview.database_bytes)}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">The database is shared across institutes, so this is not a per-institute allocation.</p>
      </article>
      <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><HardDrive className="h-5 w-5" /></span><div><h3 className="font-bold text-slate-900">File storage usage</h3><p className="text-xs text-slate-500">Whole Supabase project</p></div></div><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">PROJECT-WIDE</span></div>
        <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums text-slate-950">{formatBytes(overview.storage_bytes_project_wide)}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{overview.storage_objects_project_wide.toLocaleString()} files across the project. Institute-level attribution is not available yet.</p>
      </article>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeading eyebrow="Workspaces" title="Institute management" description="Review workspace health and manage subscription or access settings." icon={Building2} />
        <label className="relative block w-full sm:max-w-xs"><span className="sr-only">Search institutions</span><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Search institutions" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search institute or workspace…" className={`${fieldClass} pl-10`} /></label>
      </div>
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-xs leading-5 text-slate-500">Privacy protection is enabled: student and guardian details, member email addresses, fees, payments, receipts and attendance content are never displayed here.</div>
      {loading ? <div className="p-8 text-center text-sm text-slate-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading institute summaries…</div> : visibleInstitutes.length === 0 ? <div className="px-5 py-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Building2 className="h-6 w-6" /></span><p className="mt-3 font-semibold text-slate-800">{search ? "No matching institutes" : "Your institute list is empty"}</p><p className="mt-1 text-sm text-slate-500">{search ? "Try a different institute name or workspace slug." : "New workspaces will appear here after an owner creates an institute."}</p></div> : <div className="divide-y divide-slate-100">
        {visibleInstitutes.map(item => {
          const draft = drafts[item.institute_id];
          return <article key={item.institute_id} className="p-5 transition hover:bg-slate-50/50">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold text-slate-900">{item.name}</h3><span className={item.access_status === "active" ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold capitalize text-emerald-700" : "rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold capitalize text-rose-700"}>{item.access_status}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold capitalize text-slate-600">{item.subscription_status.replace("_"," ")}</span></div>
                <p className="mt-1.5 text-xs text-slate-500">{item.slug} · Created {new Date(item.created_at).toLocaleDateString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Students</p><p className="mt-1 text-xl font-bold text-slate-900">{item.student_count}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Team</p><p className="mt-1 text-xl font-bold text-slate-900">{item.team_member_count}</p><p className="text-[10px] text-slate-500">{item.owner_count} O · {item.teacher_count} T · {item.accountant_count} A</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Active · 30d</p><p className="mt-1 text-xl font-bold text-slate-900">{item.active_members_30d}</p><p className="text-[10px] text-slate-500">{item.active_owners_30d} O · {item.active_teachers_30d} T · {item.active_accountants_30d} A</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">DB estimate</p><p className="mt-1 text-xl font-bold text-slate-900">{formatBytes(item.estimated_database_row_bytes)}</p><p className="text-[10px] text-slate-500">Row payload only</p></div>
              </div>
            </div>
            <details className="group/manage mt-4 rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#6B1F38]" />Manage subscription and access</span><ChevronDown className="h-4 w-4 text-slate-400 transition group-open/manage:rotate-180" /></summary>
              {draft && <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2 xl:grid-cols-3">
                <label className={labelClass}>Access<select value={draft.accessStatus} onChange={event => updateDraft(item.institute_id,{accessStatus:event.target.value as InstituteDraft["accessStatus"]})} className={fieldClass}><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
                <label className={labelClass}>Plan<select value={draft.planCode} onChange={event => updateDraft(item.institute_id,{planCode:event.target.value})} className={fieldClass}><option value="trial">Trial</option><option value="starter">Starter</option><option value="standard">Standard</option><option value="custom">Custom</option></select></label>
                <label className={labelClass}>Subscription<select value={draft.subscriptionStatus} onChange={event => updateDraft(item.institute_id,{subscriptionStatus:event.target.value as InstituteDraft["subscriptionStatus"]})} className={fieldClass}>{["trial","active","past_due","expired","cancelled"].map(value => <option key={value} value={value}>{value.replace("_"," ")}</option>)}</select></label>
                <label className={labelClass}>Expiry date<input type="date" value={draft.expiresAt} onChange={event => updateDraft(item.institute_id,{expiresAt:event.target.value})} className={fieldClass} /></label>
                <label className={labelClass}>Student limit<input type="number" min="0" value={draft.studentLimit} onChange={event => updateDraft(item.institute_id,{studentLimit:event.target.value})} className={fieldClass} /></label>
                <label className={labelClass}>Team limit<input type="number" min="0" value={draft.teamLimit} onChange={event => updateDraft(item.institute_id,{teamLimit:event.target.value})} className={fieldClass} /></label>
                <div className="flex flex-col justify-end gap-2 sm:col-span-2 xl:col-span-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-5 text-slate-500">Limits are recorded for management but are not enforced in this release.</p><button type="button" disabled={busy} onClick={() => void saveInstitute(item)} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#6B1F38] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#57172D] disabled:opacity-50">Save changes</button></div>
              </div>}
            </details>
          </article>;
        })}
      </div>}
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-[#FFF7F9] to-white p-5"><SectionHeading eyebrow="Grow your platform" title="Create an invitation" description="Invite an owner, teacher or accountant with a secure one-time link." icon={UserPlus} /></div>
        <div className="p-5">
          <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs leading-5 text-sky-900"><span className="font-bold">How invitations work:</span> Owners can join without an institute and create their workspace after activation. Teachers and accountants must be assigned to an existing institute.</div>
          <form onSubmit={createInvite} className="space-y-4">
            <label className={labelClass}>Email address<input required type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="name@example.com" className={fieldClass} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Account role<select value={inviteRole} onChange={event => setInviteRole(event.target.value as typeof inviteRole)} className={fieldClass}><option value="owner">Owner</option><option value="teacher">Teacher</option><option value="accountant">Accountant</option></select></label>
              <label className={labelClass}>Institute {inviteRole === "owner" ? "(optional)" : "(required)"}<select value={inviteInstitute} onChange={event => setInviteInstitute(event.target.value)} className={fieldClass}><option value="">No institute — owner creates one</option>{institutes.map(item => <option key={item.institute_id} value={item.institute_id}>{item.name}</option>)}</select></label>
            </div>
            {inviteRole !== "owner" && !inviteInstitute && <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800"><ArrowDownRight className="h-4 w-4" />Select an institute before inviting a teacher or accountant.</p>}
            <button type="submit" disabled={busy || !inviteEmail.trim() || (inviteRole !== "owner" && !inviteInstitute)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6B1F38] to-[#87324F] px-4 py-3 text-sm font-bold text-white shadow-md shadow-[#6B1F38]/15 transition hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-50"><Mail className="h-4 w-4" />{busy ? "Preparing invitation…" : "Generate secure invitation link"}</button>
          </form>
          {inviteLink && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-2"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><p className="text-sm font-bold text-emerald-900">Invitation link is ready</p><p className="mt-1 text-xs text-emerald-800">Share this secure link with the invitee. It expires after 48 hours.</p></div></div>
            <input readOnly value={inviteLink} onFocus={event => event.currentTarget.select()} aria-label="Invitation link" className="mt-3 block w-full rounded-xl border border-emerald-200 bg-white px-3 py-3 text-xs text-slate-700" />
            <button type="button" onClick={() => void copyLink()} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-800">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied to clipboard" : "Copy invitation link"}</button>
          </div>}
        </div>
      </article>

      <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5"><SectionHeading eyebrow="Recent activity" title="Invitation activity" description="Track links issued through platform administration." icon={Mail} /><span className="shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">{pendingInvitations} pending</span></div>
        <div className="divide-y divide-slate-100 px-5">
          {invitations.length === 0 ? <div className="py-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Mail className="h-5 w-5" /></span><p className="mt-3 font-semibold text-slate-800">No invitations yet</p><p className="mt-1 text-xs text-slate-500">Newly generated invitations will appear here.</p></div> : invitations.slice(0,8).map(item => <div key={item.id} className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{item.email}</p><p className="mt-0.5 text-xs capitalize text-slate-500">{item.role} · {item.institute_name ?? "New institute"}</p><p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400"><Clock3 className="h-3 w-3" />Expires {new Date(item.expires_at).toLocaleString()}</p></div>
            <div className="flex shrink-0 flex-col items-end gap-2"><span className={item.status === "Pending" ? "rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800" : "rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600"}>{item.status}</span>{item.status === "Pending" && <button type="button" disabled={busy} onClick={() => void revokeInvite(item)} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">Revoke</button>}</div>
          </div>)}
        </div>
      </article>
    </section>

    <details className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-amber-950"><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Usage definitions & privacy safeguards</span><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
      <ul className="mt-3 grid gap-2 border-t border-amber-200/70 pt-3 text-xs leading-5 text-amber-950/80 sm:grid-cols-2">
        <li>Database usage is the whole-project Supabase total. Institute estimates sum tagged row payloads and exclude indexes, TOAST and shared overhead.</li>
        <li>Storage totals are project-wide. Per-institute file attribution is unavailable until institute-specific storage paths are introduced and audited.</li>
        <li>Team activity counts unique invited team accounts active per day over the last 30 days.</li>
        <li>Student login tracking is unavailable because students do not currently have EduLedger login accounts.</li>
        <li>Institute summaries show aggregate student and team counts only. Personal student, guardian and member information is not exposed.</li>
      </ul>
    </details>
    <p className="pb-2 text-center text-[11px] text-slate-400">EduLedger Platform · Secure administration · Privacy-first by design</p>
  </main>;
}
