import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, Building2, Check, Copy, Database, HardDrive, LogOut, RefreshCw, ShieldCheck, Users, UserPlus, GraduationCap } from "lucide-react";
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

function MetricCard({ label, value, note, icon: Icon }: {
  label: string; value: string | number; note: string; icon: typeof Building2;
}) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="rounded-xl bg-[#F8E9ED] p-2 text-[#6B1F38]"><Icon className="h-4 w-4" /></span>
    </div>
    <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{note}</p>
  </article>;
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
      <section className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-9 w-9 text-rose-700" />
        <h1 className="mt-3 text-xl font-bold text-slate-900">Access restricted</h1>
        <p className="mt-2 text-sm text-slate-600">Only the designated EduLedger platform administrator can access this area.</p>
      </section>
    </main>;
  }

  return <main className="space-y-6">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A03B5E]">EduLedger Platform</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Super Admin</h1>
        <p className="mt-1 text-sm text-slate-500">Manage institutes, access, subscriptions and service usage.</p>
        <p className="mt-1 text-xs text-slate-400">Signed in as {email ?? "designated administrator"} · single-admin account</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void refresh()} disabled={loading || busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Refresh
        </button>
        <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <LogOut className="h-4 w-4" />Sign out
        </button>
      </div>
    </header>

    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard label="Institutions" value={overview.institute_count} note="Registered workspaces" icon={Building2} />
      <MetricCard label="Students" value={overview.student_count} note="Aggregate count only" icon={GraduationCap} />
      <MetricCard label="Team members" value={overview.team_member_count} note={overview.owner_count + " owners · " + overview.teacher_count + " teachers · " + overview.accountant_count + " accountants"} icon={Users} />
      <MetricCard label="Team active · 30 days" value={overview.active_members_30d} note="Unique invited team accounts active" icon={Activity} />
      <MetricCard label="Active subscriptions" value={overview.active_subscriptions} note="Trial, active or grace-period plans" icon={ShieldCheck} />
      <MetricCard label="Suspended institutes" value={overview.suspended_institutes} note="Workspace access currently blocked" icon={Building2} />
    </section>

    <section className="grid gap-3 md:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Database className="h-4 w-4 text-[#6B1F38]" />Database usage</h2>
        <p className="mt-3 text-2xl font-bold text-slate-900">{formatBytes(overview.database_bytes)}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Whole Supabase database project size. The database is shared, so this is not a per-institute allocation.</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><HardDrive className="h-4 w-4 text-[#6B1F38]" />File storage usage</h2>
        <p className="mt-3 text-2xl font-bold text-slate-900">{formatBytes(overview.storage_bytes_project_wide)}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{overview.storage_objects_project_wide.toLocaleString()} files across the entire project. Institute-level file attribution is not available yet.</p>
      </article>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Institute management</h2>
          <p className="mt-1 max-w-3xl text-xs text-slate-500">Only institute metadata and aggregate counts are shown. Student and guardian details, member email addresses, fees, payments, receipts and attendance content are not exposed.</p>
        </div>
        <input aria-label="Search institutions" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search institute or workspace" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:max-w-xs" />
      </div>
      {loading ? <p className="p-5 text-sm text-slate-500">Loading institute summaries…</p> : visibleInstitutes.length === 0 ? <p className="p-5 text-sm text-slate-500">No institutes found.</p> : <div className="divide-y divide-slate-100">
        {visibleInstitutes.map(item => {
          const draft = drafts[item.institute_id];
          return <article key={item.institute_id} className="p-4">
            <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-slate-900">{item.name}</h3>
                  <span className={item.access_status === "active" ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700" : "rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"}>{item.access_status}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{item.subscription_status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">eduledger/{item.slug} · Created {new Date(item.created_at).toLocaleDateString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 xl:min-w-[520px]">
                <div><p className="text-xs text-slate-500">Students</p><p className="font-bold text-slate-900">{item.student_count}</p></div>
                <div><p className="text-xs text-slate-500">Team</p><p className="font-bold text-slate-900">{item.team_member_count}</p><p className="text-[11px] text-slate-500">{item.owner_count} O · {item.teacher_count} T · {item.accountant_count} A</p></div>
                <div><p className="text-xs text-slate-500">Active · 30d</p><p className="font-bold text-slate-900">{item.active_members_30d}</p><p className="text-[11px] text-slate-500">{item.active_owners_30d} O · {item.active_teachers_30d} T · {item.active_accountants_30d} A</p></div>
                <div><p className="text-xs text-slate-500">Last team activity</p><p className="font-bold text-slate-900">{item.last_active_date ? new Date(item.last_active_date).toLocaleDateString() : "Not tracked yet"}</p></div>
              </div>
            </div>

            <details className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <summary className="cursor-pointer text-xs font-bold text-slate-700">Manage subscription and access</summary>
              {draft && <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-semibold text-slate-600">Access
                  <select value={draft.accessStatus} onChange={event => updateDraft(item.institute_id,{accessStatus:event.target.value as InstituteDraft["accessStatus"]})} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-normal"><option value="active">Active</option><option value="suspended">Suspended</option></select>
                </label>
                <label className="text-xs font-semibold text-slate-600">Plan
                  <select value={draft.planCode} onChange={event => updateDraft(item.institute_id,{planCode:event.target.value})} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-normal"><option value="trial">Trial</option><option value="starter">Starter</option><option value="standard">Standard</option><option value="custom">Custom</option></select>
                </label>
                <label className="text-xs font-semibold text-slate-600">Subscription
                  <select value={draft.subscriptionStatus} onChange={event => updateDraft(item.institute_id,{subscriptionStatus:event.target.value as InstituteDraft["subscriptionStatus"]})} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-normal">{["trial","active","past_due","expired","cancelled"].map(value => <option key={value} value={value}>{value.replace("_"," ")}</option>)}</select>
                </label>
                <label className="text-xs font-semibold text-slate-600">Expiry date
                  <input type="date" value={draft.expiresAt} onChange={event => updateDraft(item.institute_id,{expiresAt:event.target.value})} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-slate-600">Student limit
                  <input type="number" min="0" value={draft.studentLimit} onChange={event => updateDraft(item.institute_id,{studentLimit:event.target.value})} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-slate-600">Team limit
                  <input type="number" min="0" value={draft.teamLimit} onChange={event => updateDraft(item.institute_id,{teamLimit:event.target.value})} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-normal" />
                </label>
                <div className="flex items-end sm:col-span-2"><button type="button" disabled={busy} onClick={() => void saveInstitute(item)} className="rounded-lg bg-[#6B1F38] px-4 py-2 text-sm font-semibold text-white hover:bg-[#57172D] disabled:opacity-50">Save changes</button></div>
              </div>}
              <p className="mt-3 text-[11px] leading-5 text-slate-500">Plan limits are recorded for management but are not enforced by admissions or team invitation limits in this release.</p>
            </details>
          </article>;
        })}
      </div>}
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><UserPlus className="h-4 w-4 text-[#6B1F38]" />Create invitation</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Owner invitations can be created without an institute. The owner sets up the institute after activation. Teacher and accountant invitations must be linked to an existing institute.</p>
        <form onSubmit={createInvite} className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-600">Email address
            <input required type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="owner@example.com" className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">Role
              <select value={inviteRole} onChange={event => setInviteRole(event.target.value as typeof inviteRole)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="owner">Owner</option><option value="teacher">Teacher</option><option value="accountant">Accountant</option></select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">Institute (optional for owner)
              <select value={inviteInstitute} onChange={event => setInviteInstitute(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                <option value="">No institute — owner creates one</option>
                {institutes.map(item => <option key={item.institute_id} value={item.institute_id}>{item.name}</option>)}
              </select>
            </label>
          </div>
          {inviteRole !== "owner" && !inviteInstitute && <p className="text-xs text-amber-700">Select an institute for teacher and accountant invitations.</p>}
          <button type="submit" disabled={busy || !inviteEmail.trim() || (inviteRole !== "owner" && !inviteInstitute)} className="w-full rounded-lg bg-[#6B1F38] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#57172D] disabled:opacity-50">Generate one-time link</button>
        </form>
        {inviteLink && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-bold text-emerald-900">Invitation link ready · expires after 48 hours</p>
          <input readOnly value={inviteLink} onFocus={event => event.currentTarget.select()} className="mt-2 block w-full rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-xs text-slate-700" />
          <button type="button" onClick={() => void copyLink()} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy link"}</button>
        </div>}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-base font-bold text-slate-900">Invitation activity</h2><p className="mt-1 text-xs text-slate-500">Shows only invitations issued through platform administration.</p></div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{invitations.filter(item => item.status === "Pending").length} pending</span>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {invitations.length === 0 ? <p className="py-4 text-sm text-slate-500">No platform invitations yet.</p> : invitations.slice(0,8).map(item => <div key={item.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{item.email}</p><p className="text-xs text-slate-500">{item.role} · {item.institute_name ?? "New institute"} · {item.status}</p><p className="text-[11px] text-slate-400">Expires {new Date(item.expires_at).toLocaleString()}</p></div>
            {item.status === "Pending" && <button type="button" disabled={busy} onClick={() => void revokeInvite(item)} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Revoke</button>}
          </div>)}
        </div>
      </article>
    </section>

    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-sm font-bold text-amber-950">Usage and privacy notes</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-900">
        <li>Database and file-storage totals are whole-project Supabase metrics, not precise per-institute billing amounts.</li>
        <li>Institute rows show student and team counts only. Member login activity is counted per unique team account per day over the last 30 days.</li>
        <li>Student login tracking is unavailable because students do not currently have EduLedger login accounts.</li>
        <li>Per-institute file attribution is unavailable until institute-specific storage paths are introduced and audited.</li>
      </ul>
    </section>
  </main>;
}
