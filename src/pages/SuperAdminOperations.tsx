import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, CircleAlert, RefreshCw, ShieldCheck, Wifi } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getPlatformBillingOverview, listPlatformBilling } from "../services/platformBillingService";
import { listPlatformInstitutes, listPlatformInvitations } from "../services/platformAdminService";

type MonthlyMetric = { month: string; new_institutes: number; new_students: number; platform_revenue_inr: number };
type Health = { auth: "checking" | "ok" | "error"; database: "checking" | "ok" | "error"; checkedAt: string | null };

const panel = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const label = "text-[11px] font-bold uppercase tracking-wider text-slate-500";

export function SuperAdminOperations() {
  const [health, setHealth] = useState<Health>({ auth: "checking", database: "checking", checkedAt: null });
  const [actions, setActions] = useState<string[]>([]);
  const [monthly, setMonthly] = useState<MonthlyMetric[]>([]);
  const [loadError, setLoadError] = useState("");

  const checkHealth = useCallback(async () => {
    setLoadError("");
    setHealth({ auth: "checking", database: "checking", checkedAt: null });
    const authResult = await supabase.auth.getSession();
    const authOk = !authResult.error && Boolean(authResult.data.session);
    const dbResult = await supabase.rpc("is_platform_admin");
    const dbOk = !dbResult.error && dbResult.data === true;
    setHealth({ auth: authOk ? "ok" : "error", database: dbOk ? "ok" : "error", checkedAt: new Date().toISOString() });

    const analyticsResult = await supabase.rpc("platform_admin_analytics_monthly");
    if (!analyticsResult.error && Array.isArray(analyticsResult.data?.months)) {
      setMonthly(analyticsResult.data.months as MonthlyMetric[]);
    } else {
      setLoadError("Platform analytics could not be refreshed. Check the administrator session and database connection.");
    }

    try {
      const [institutes, invitations, invoices, billing] = await Promise.all([
        listPlatformInstitutes(), listPlatformInvitations(), listPlatformBilling(), getPlatformBillingOverview()
      ]);
      const now = new Date();
      const soon = new Date(now.getTime() + 30 * 86400000);
      const expiring = institutes.filter(item => item.expires_at && new Date(item.expires_at) >= now && new Date(item.expires_at) <= soon).length;
      const overdue = invoices.filter(item => item.status === "issued" && item.due_at < now.toISOString().slice(0, 10)).length;
      const pending = invitations.filter(item => item.status === "Pending").length;
      const next: string[] = [];
      if (overdue) next.push(overdue + " platform invoice(s) are overdue; review subscription collections.");
      if (expiring) next.push(expiring + " institute subscription(s) expire within 30 days.");
      if (pending) next.push(pending + " platform invitation(s) are awaiting acceptance or expiry.");
      if (billing.pending_invoices) next.push(billing.pending_invoices + " platform invoice(s) are awaiting payment.");
      if (next.length === 0) next.push("No urgent platform actions detected from current subscription and invitation records.");
      setActions(next);
    } catch {
      setActions(["Could not refresh the action centre. Use Refresh data on the dashboard and retry."]);
    }
  }, []);

  useEffect(() => { void checkHealth(); }, [checkHealth]);

  const status = (value: string) => value === "ok"
    ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4"/>Operational</span>
    : value === "checking"
      ? <span className="text-xs text-slate-500">Checking…</span>
      : <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700"><CircleAlert className="h-4 w-4"/>Unavailable</span>;

  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className={label}>Platform operations</p><h2 className="text-lg font-bold text-slate-900">Action centre & service health</h2><p className="mt-1 text-sm text-slate-500">Live checks for the signed-in admin session and database authorization.</p></div>
      <button type="button" onClick={() => void checkHealth()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><RefreshCw className="h-4 w-4"/>Check services</button>
    </div>
    {loadError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{loadError}</p>}
    <article className={panel}>
      <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-[#6B1F38]"/><h3 className="font-bold text-slate-900">Action centre</h3><span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{actions.length} item(s)</span></div>
      {actions.length ? <ul className="mt-3 space-y-2">{actions.map((item, index) => <li key={index} className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-950"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0"/>{item}</li>)}</ul> : <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-600">Loading platform actions…</p>}
    </article>
    <article className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className={label}>Platform analytics · last 12 months</p><h3 className="font-bold text-slate-900">Growth & platform revenue</h3></div><span className="text-[10px] text-slate-500">Monthly totals</span></div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
        {monthly.map((item) => {
          const maxInstitutes = Math.max(1, ...monthly.map(row => Number(row.new_institutes)));
          const maxStudents = Math.max(1, ...monthly.map(row => Number(row.new_students)));
          const instituteHeight = Math.max(4, Number(item.new_institutes) / maxInstitutes * 54);
          const studentHeight = Math.max(4, Number(item.new_students) / maxStudents * 54);
          return <div key={item.month} className="min-w-0 rounded-lg bg-slate-50 p-2">
            <div className="flex h-16 items-end justify-center gap-1"><div title={item.new_institutes + " new institutes"} style={{height:instituteHeight+"px"}} className="w-3 rounded-t bg-[#6B1F38]"/><div title={item.new_students + " new students"} style={{height:studentHeight+"px"}} className="w-3 rounded-t bg-sky-600"/></div>
            <p className="mt-2 truncate text-center text-[10px] font-semibold text-slate-600">{item.month}</p>
            <p className="mt-1 text-center text-[10px] tabular-nums text-slate-500">{item.new_institutes} org</p>
            <p className="text-center text-[10px] tabular-nums text-slate-500">{Number(item.new_students).toLocaleString("en-IN")} stu</p>
            <p className="mt-1 truncate text-center text-[10px] font-semibold text-slate-700">₹{Number(item.platform_revenue_inr).toLocaleString("en-IN",{maximumFractionDigits:0})}</p>
          </div>;
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#6B1F38]"/>New institutes</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-sky-600"/>New students</span><span>Revenue = recorded platform subscription payments, not projected MRR.</span></div>
    </article>
    <div className="grid gap-3 sm:grid-cols-2">
      <article className={panel}><div className="flex items-center gap-2 text-slate-700"><ShieldCheck className="h-5 w-5"/><span className="font-semibold">Admin session</span></div><div className="mt-3">{status(health.auth)}</div><p className="mt-1 text-xs text-slate-500">Authenticated browser session</p></article>
      <article className={panel}><div className="flex items-center gap-2 text-slate-700"><Wifi className="h-5 w-5"/><span className="font-semibold">Database & RBAC</span></div><div className="mt-3">{status(health.database)}</div><p className="mt-1 text-xs text-slate-500">Super Admin authorization RPC</p></article>
    </div>
    <p className="text-[11px] text-slate-500">Service checks run on demand or when the dashboard loads. This dashboard does not use external AI integrations.</p>
  </section>;
}
