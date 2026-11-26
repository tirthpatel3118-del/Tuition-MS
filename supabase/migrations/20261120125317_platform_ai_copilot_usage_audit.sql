-- Development-only migration: platform AI usage auditing.
-- No prompts, completions, student records, or provider secrets are stored.
create table if not exists private.platform_ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  estimated_cost_usd numeric(12,6) not null default 0 check (estimated_cost_usd >= 0),
  status text not null check (status in ('succeeded','failed','blocked')),
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists platform_ai_usage_logs_created_at_idx on private.platform_ai_usage_logs(created_at desc);
create index if not exists platform_ai_usage_logs_actor_created_idx on private.platform_ai_usage_logs(actor_id, created_at desc);
alter table private.platform_ai_usage_logs enable row level security;
revoke all on private.platform_ai_usage_logs from anon, authenticated, public;

create or replace function public.platform_admin_ai_usage_overview()
returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_month_start date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'requests_today', (select count(*) from private.platform_ai_usage_logs where created_at >= v_today::timestamptz),
    'requests_this_month', (select count(*) from private.platform_ai_usage_logs where created_at >= v_month_start::timestamptz),
    'tokens_this_month', (select coalesce(sum(total_tokens),0) from private.platform_ai_usage_logs where created_at >= v_month_start::timestamptz),
    'estimated_cost_usd_this_month', (select coalesce(sum(estimated_cost_usd),0) from private.platform_ai_usage_logs where created_at >= v_month_start::timestamptz),
    'failed_requests_this_month', (select count(*) from private.platform_ai_usage_logs where created_at >= v_month_start::timestamptz and status <> 'succeeded')
  );
end;
$$;
revoke all on function public.platform_admin_ai_usage_overview() from public, anon;
grant execute on function public.platform_admin_ai_usage_overview() to authenticated;
