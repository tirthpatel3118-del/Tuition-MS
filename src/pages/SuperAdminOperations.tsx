import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Activity, Bot, CheckCircle2, CircleAlert, Clock3, ExternalLink, RefreshCw, Send, ShieldCheck, Wifi } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getPlatformBillingOverview, listPlatformBilling } from "../services/platformBillingService";
import { listPlatformInstitutes, listPlatformInvitations } from "../services/platformAdminService";

type AiStatus = { configured: boolean; model: string; status: string };
type MonthlyMetric = { month: string; new_institutes: number; new_students: number; platform_revenue_inr: number };
type Usage = { requests_today: number; requests_this_month: number; tokens_this_month: number; estimated_cost_usd_this_month: number; failed_requests_this_month: number };
type Health = { auth: "checking" | "ok" | "error"; database: "checking" | "ok" | "error"; ai: "checking" | "ok" | "setup" | "error"; checkedAt: string | null };

const panel = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const label = "text-[11px] font-bold uppercase tracking-wider text-slate-500";
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#6B1F38] px-4 py-2 text-sm font-semibold text-white hover:bg-[#57172D] disabled:opacity-50";

export function SuperAdminOperations() {
  const [health, setHealth] = useState<Health>({ auth: "checking", database: "checking", ai: "checking", checkedAt: null });
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [monthly, setMonthly] = useState<MonthlyMetric[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const checkHealth = useCallback(async () => {
    setHealth({ auth: "checking", database: "checking", ai: "checking", checkedAt: null });
    const authResult = await supabase.auth.getSession();
    const authOk = !authResult.error && Boolean(authResult.data.session);
    const dbResult = await supabase.rpc("is_platform_admin");
    const dbOk = !dbResult.error && dbResult.data === true;
    const aiResult = await supabase.functions.invoke("platform-ai-copilot", { body: { action: "status" } });
    const nextAi = aiResult.data as AiStatus | null;
    setAiStatus(nextAi);
    const aiState = aiResult.error ? "error" : nextAi?.configured ? "ok" : "setup";
    setHealth({ auth: authOk ? "ok" : "error", database: dbOk ? "ok" : "error", ai: aiState, checkedAt: new Date().toISOString() });
    const usageResult = await supabase.rpc("platform_admin_ai_usage_overview");
    if (!usageResult.error && usageResult.data) setUsage(usageResult.data as Usage);
    const analyticsResult = await supabase.rpc("platform_admin_analytics_monthly");
    if (!analyticsResult.error && Array.isArray(analyticsResult.data?.months)) setMonthly(analyticsResult.data.months as MonthlyMetric[]);
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

  const ask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy(true); setError(""); setAnswer("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("platform-ai-copilot", { body: { action: "ask", prompt: question.trim() } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setAnswer(String(data?.answer ?? "No answer was returned."));
      await checkHealth();
    } catch (value) {
      setError(value instanceof Error ? value.message : "The AI request failed.");
    } finally { setBusy(false); }
  };

  const status = (value: string) => value === "ok"
    ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4"/>Operational</span>
    : value === "setup"
      ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700"><CircleAlert className="h-4 w-4"/>Configuration needed</span>
      : value === "checking"
        ? <span className="text-xs text-slate-500">Checking…</span>
        : <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700"><CircleAlert className="h-4 w-4"/>Unavailable</span>;

  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className={label}>Platform operations</p><h2 className="text-lg font-bold text-slate-900">Action centre & service health</h2><p className="mt-1 text-sm text-slate-500">Live checks for the signed-in admin session, database authorization and AI service.</p></div>
      <button type="button" onClick={() => void checkHealth()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><RefreshCw className="h-4 w-4"/>Check services</button>
    </div>
    <article className={panel}>
      <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-[#6B1F38]"/><h3 className="font-bold text-slate-900">Action centre</h3><span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{actions.length} item(s)</span></div>
      {actions.length ? <ul className="mt-3 space-y-2">{actions.map((item, index) => <li key={index} className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-950"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0"/>{item}</li>)}</ul> : <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-3 text-xs text-emerald-800">No urgent platform actions detected from the available records.</p>}
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
    <div className="grid gap-3 sm:grid-cols-3">
      <article className={panel}><div className="flex items-center gap-2 text-slate-700"><ShieldCheck className="h-5 w-5"/><span className="font-semibold">Admin session</span></div><div className="mt-3">{status(health.auth)}</div><p className="mt-1 text-xs text-slate-500">Authenticated browser session</p></article>
      <article className={panel}><div className="flex items-center gap-2 text-slate-700"><Wifi className="h-5 w-5"/><span className="font-semibold">Database & RBAC</span></div><div className="mt-3">{status(health.database)}</div><p className="mt-1 text-xs text-slate-500">Super Admin authorization RPC</p></article>
      <article className={panel}><div className="flex items-center gap-2 text-slate-700"><Bot className="h-5 w-5"/><span className="font-semibold">OpenAI Copilot</span></div><div className="mt-3">{status(health.ai)}</div><p className="mt-1 text-xs text-slate-500">{aiStatus?.model ?? "Model not reported"}</p></article>
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <article className={panel}>
        <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-[#6B1F38]"/><div><h3 className="font-bold text-slate-900">EduLedger AI Copilot</h3><p className="text-xs text-slate-500">Read-only answers from approved aggregate platform metrics</p></div></div>
        <form onSubmit={ask} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Ask a platform question<textarea value={question} onChange={e=>setQuestion(e.target.value)} maxLength={2000} rows={3} placeholder="Which platform subscriptions are overdue? (aggregate data only)" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#A03B5E] focus:ring-4 focus:ring-[#A03B5E]/10"/></label>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
          <button className={button} disabled={busy || !question.trim() || health.ai !== "ok"}><Send className="h-4 w-4"/>{busy ? "Thinking…" : "Ask Copilot"}</button>
        </form>
        {answer && <div className="mt-4 whitespace-pre-wrap rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-slate-800">{answer}</div>}
        {health.ai === "setup" && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">OpenAI API key is not configured. Add <code>OPENAI_API_KEY</code> as a secret in Supabase Edge Function secrets for the development project. Optional: set <code>OPENAI_MODEL</code>. Then use Check services. The key is never entered into or stored by this browser.</div>}
        <p className="mt-3 text-[11px] leading-5 text-slate-500">The Copilot cannot perform actions, access student-level records, or write to the database. It is limited to aggregate platform overview and billing metrics.</p>
      </article>
      <article className={panel}>
        <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-[#6B1F38]"/><div><h3 className="font-bold text-slate-900">AI usage & controls</h3><p className="text-xs text-slate-500">Usage logged on the development project</p></div></div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-50 p-3"><p className={label}>Requests today</p><p className="mt-1 text-2xl font-bold tabular-nums">{usage?.requests_today ?? "—"}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className={label}>Requests this month</p><p className="mt-1 text-2xl font-bold tabular-nums">{usage?.requests_this_month ?? "—"}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className={label}>Tokens this month</p><p className="mt-1 text-xl font-bold tabular-nums">{(usage?.tokens_this_month ?? 0).toLocaleString("en-IN")}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className={label}>Failed requests</p><p className="mt-1 text-xl font-bold tabular-nums">{usage?.failed_requests_this_month ?? "—"}</p></div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">Hard limit: 20 requests per administrator per hour. API provider charges are separate from ChatGPT subscriptions.</p>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4"/>Last checked: {health.checkedAt ? new Date(health.checkedAt).toLocaleString("en-IN") : "Not checked"}</div>
        <a href="https://supabase.com/dashboard/project/avplvplzhaqpnclgzmel/settings/functions" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#6B1F38]">Development Edge Function secrets <ExternalLink className="h-3 w-3"/></a>
      </article>
    </div>
    <article className={panel}>
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#6B1F38]"/><h3 className="font-bold text-slate-900">Google OAuth setup</h3><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">Provider credentials required</span></div>
      <p className="mt-2 text-sm leading-6 text-slate-600">Google OAuth sign-in is available in the sign-in screen for the designated platform administrator only. Enable Google in the development Supabase Auth provider settings and configure the Google OAuth client ID, client secret and redirect URI. Do not reuse production credentials until production is separately approved.</p>
      <a href="https://supabase.com/dashboard/project/avplvplzhaqpnclgzmel/auth/providers" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#6B1F38]">Development Auth providers <ExternalLink className="h-3 w-3"/></a>
    </article>
  </section>;
}
