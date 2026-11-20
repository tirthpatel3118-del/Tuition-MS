-- Reversible institute archival. Tenant data remains untouched.
alter table private.platform_institute_controls
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

create or replace function public.platform_admin_list_institutes()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  perform private.require_platform_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'institute_id', i.id,
      'name', i.name,
      'slug', i.slug,
      'created_at', i.created_at,
      'student_count', (select count(*) from public.students s where s.institute_id=i.id),
      'owner_count', (select count(*) from public.institute_members m where m.institute_id=i.id and m.role='owner'),
      'teacher_count', (select count(*) from public.institute_members m where m.institute_id=i.id and m.role='teacher'),
      'accountant_count', (select count(*) from public.institute_members m where m.institute_id=i.id and m.role='accountant'),
      'team_member_count', (select count(*) from public.institute_members m where m.institute_id=i.id),
      'active_members_30d', (select count(distinct a.user_id) from private.platform_member_login_daily a where a.institute_id=i.id and a.activity_date >= current_date - 29),
      'active_owners_30d', (select count(distinct a.user_id) from private.platform_member_login_daily a where a.institute_id=i.id and a.role='owner' and a.activity_date >= current_date - 29),
      'active_teachers_30d', (select count(distinct a.user_id) from private.platform_member_login_daily a where a.institute_id=i.id and a.role='teacher' and a.activity_date >= current_date - 29),
      'active_accountants_30d', (select count(distinct a.user_id) from private.platform_member_login_daily a where a.institute_id=i.id and a.role='accountant' and a.activity_date >= current_date - 29),
      'last_active_date', (select max(a.activity_date) from private.platform_member_login_daily a where a.institute_id=i.id),
      'estimated_database_row_bytes', private.platform_institute_estimated_bytes(i.id),
      'access_status', coalesce(c.access_status,'active'),
      'plan_code', coalesce(c.plan_code,'trial'),
      'subscription_status', coalesce(c.subscription_status,'trial'),
      'starts_at', c.starts_at,
      'expires_at', c.expires_at,
      'student_limit', c.student_limit,
      'team_limit', c.team_limit,
      'archived_at', c.archived_at,
      'archived_by', c.archived_by
    ) order by (c.archived_at is not null), i.created_at desc)
    from public.institutes i
    left join private.platform_institute_controls c on c.institute_id=i.id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.platform_admin_archive_institute(
  p_institute_id uuid,
  p_confirm_name text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_name text;
  v_access_status text;
begin
  perform private.require_platform_admin();
  select i.name, coalesce(c.access_status,'active')
    into v_name, v_access_status
  from public.institutes i
  left join private.platform_institute_controls c on c.institute_id=i.id
  where i.id=p_institute_id
  for update of i;

  if v_name is null then raise exception 'Institute not found.'; end if;
  if v_access_status <> 'suspended' then raise exception 'Only suspended institutes can be archived.'; end if;
  if p_confirm_name is distinct from v_name then raise exception 'Institute name confirmation did not match.'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'An archive reason of at least 5 characters is required.'; end if;
  if exists(select 1 from private.platform_institute_controls where institute_id=p_institute_id and archived_at is not null) then
    raise exception 'Institute is already archived.';
  end if;

  insert into private.platform_institute_controls(institute_id, access_status, plan_code, subscription_status, starts_at, archived_at, archived_by, updated_by, updated_at)
  values(p_institute_id, 'suspended', 'trial', 'trial', now(), now(), auth.uid(), auth.uid(), now())
  on conflict(institute_id) do update
    set archived_at=now(), archived_by=auth.uid(), updated_by=auth.uid(), updated_at=now();

  insert into private.platform_admin_audit(actor_id, action, institute_id, details)
  values(auth.uid(), 'INSTITUTE_ARCHIVED', p_institute_id,
    jsonb_build_object('reason', trim(p_reason), 'institute_name', v_name, 'records_retained', true));
end;
$$;

create or replace function public.platform_admin_restore_institute(p_institute_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_name text;
begin
  perform private.require_platform_admin();
  select i.name into v_name
  from public.institutes i
  join private.platform_institute_controls c on c.institute_id=i.id
  where i.id=p_institute_id and c.archived_at is not null
  for update of i;
  if v_name is null then raise exception 'Archived institute not found.'; end if;

  update private.platform_institute_controls
  set archived_at=null, archived_by=null, updated_by=auth.uid(), updated_at=now()
  where institute_id=p_institute_id;

  insert into private.platform_admin_audit(actor_id, action, institute_id, details)
  values(auth.uid(), 'INSTITUTE_RESTORED', p_institute_id,
    jsonb_build_object('institute_name', v_name, 'access_status_remains_suspended', true));
end;
$$;

revoke all on function public.platform_admin_archive_institute(uuid,text,text) from public, anon;
revoke all on function public.platform_admin_restore_institute(uuid) from public, anon;
grant execute on function public.platform_admin_archive_institute(uuid,text,text) to authenticated;
grant execute on function public.platform_admin_restore_institute(uuid) to authenticated;
revoke all on function public.platform_admin_list_institutes() from public, anon;
grant execute on function public.platform_admin_list_institutes() to authenticated;
