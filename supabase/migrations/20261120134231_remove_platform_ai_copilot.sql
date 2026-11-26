drop function if exists public.platform_admin_ai_usage_overview();
drop function if exists public.platform_ai_log_usage(uuid,text,integer,integer,integer,text,text);
drop function if exists public.platform_ai_count_recent_requests(uuid);
drop table if exists private.platform_ai_usage_logs;
