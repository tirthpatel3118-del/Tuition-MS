BEGIN;

CREATE OR REPLACE FUNCTION public.platform_admin_export_legal_acceptances(p_limit integer DEFAULT 10000)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_limit integer := LEAST(GREATEST(COALESCE(p_limit,10000),1),10000);
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.accepted_at DESC)
    FROM (
      SELECT a.id,a.user_email,a.document_slug,a.document_title,a.document_version,
        a.document_locale,a.content_sha256,a.acceptance_scope,a.institute_id,
        a.acceptance_method,a.user_agent,a.accepted_at
      FROM public.user_legal_acceptances a
      ORDER BY a.accepted_at DESC
      LIMIT v_limit
    ) r
  ),'[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_admin_export_legal_acceptances(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_export_legal_acceptances(integer) TO authenticated;

COMMIT;