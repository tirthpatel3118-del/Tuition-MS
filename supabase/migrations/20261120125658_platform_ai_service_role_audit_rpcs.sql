-- Restrict AI audit writes and rate-limit reads to the Edge Function service role.
create or replace function public.platform_ai_log_usage(
  p_actor_id uuid, p_model text, p_input_tokens integer, p_output_tokens integer,
  p_total_tokens integer, p_status text, p_error_code text default null
) returns void language plpgsql security definer set search_path to ''
as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  insert into private.platform_ai_usage_logs(actor_id,model,input_tokens,output_tokens,total_tokens,status,error_code)
  values(p_actor_id,p_model,greatest(coalesce(p_input_tokens,0),0),greatest(coalesce(p_output_tokens,0),0),greatest(coalesce(p_total_tokens,0),0),p_status,p_error_code);
end;
$$;
revoke all on function public.platform_ai_log_usage(uuid,text,integer,integer,integer,text,text) from public, anon, authenticated;
grant execute on function public.platform_ai_log_usage(uuid,text,integer,integer,integer,text,text) to service_role;

create or replace function public.platform_ai_count_recent_requests(p_actor_id uuid)
returns integer language plpgsql stable security definer set search_path to ''
as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  return (select count(*)::integer from private.platform_ai_usage_logs where actor_id=p_actor_id and created_at >= now() - interval '1 hour');
end;
$$;
revoke all on function public.platform_ai_count_recent_requests(uuid) from public, anon, authenticated;
grant execute on function public.platform_ai_count_recent_requests(uuid) to service_role;
