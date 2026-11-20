create or replace function public.platform_admin_analytics_monthly()
returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare
  v_month_start date := (date_trunc('month', current_date) - interval '11 months')::date;
begin
  perform private.require_platform_admin();
  return jsonb_build_object('months',(
    select coalesce(jsonb_agg(jsonb_build_object(
      'month',to_char(m.month_start,'Mon YY'),
      'new_institutes',(select count(*) from public.institutes i where i.created_at >= m.month_start and i.created_at < (m.month_start + interval '1 month')),
      'new_students',(select count(*) from public.students s where s.created_at >= m.month_start and s.created_at < (m.month_start + interval '1 month')),
      'platform_revenue_inr',(select coalesce(sum(p.amount_inr),0) from private.platform_billing_payments p where p.paid_at >= m.month_start and p.paid_at < (m.month_start + interval '1 month'))
    ) order by m.month_start), '[]'::jsonb)
    from generate_series(v_month_start, date_trunc('month',current_date)::date, interval '1 month') as m(month_start)
  ));
end;
$$;
revoke all on function public.platform_admin_analytics_monthly() from public, anon;
grant execute on function public.platform_admin_analytics_monthly() to authenticated;
