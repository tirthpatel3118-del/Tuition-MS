BEGIN;
CREATE OR REPLACE FUNCTION public.platform_admin_demo_list_activity()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC)
    FROM (
      SELECT
        a.id,a.inquiry_id,a.demo_access_id,a.action,a.details,a.created_at,
        i.reference_code,i.requester_name,i.institute_name,
        u.email AS actor_email
      FROM private.website_demo_audit a
      JOIN private.website_inquiries i ON i.id=a.inquiry_id
      LEFT JOIN auth.users u ON u.id=a.actor_id
      ORDER BY a.created_at DESC
      LIMIT 300
    ) q
  ),'[]'::jsonb);
END;
$function$;
REVOKE ALL ON FUNCTION public.platform_admin_demo_list_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_demo_list_activity() TO authenticated;
COMMIT;