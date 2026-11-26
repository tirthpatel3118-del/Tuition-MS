BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_legal_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_required jsonb;
  v_missing jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  WITH current_docs AS (
    SELECT DISTINCT ON (d.slug) d.id,d.slug,d.title,d.version,d.locale,d.content_sha256,d.published_at,d.is_test_only
    FROM public.legal_documents d
    WHERE d.status='published' AND d.is_required=true AND d.locale='en-IN'
      AND d.slug IN ('terms-of-service','privacy-policy')
    ORDER BY d.slug,d.published_at DESC,d.created_at DESC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',d.id,'slug',d.slug,'title',d.title,'version',d.version,'locale',d.locale,
    'content_sha256',d.content_sha256,'published_at',d.published_at,'is_test_only',d.is_test_only
  ) ORDER BY d.slug),'[]'::jsonb),
  COALESCE(jsonb_agg(d.slug) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM public.user_legal_acceptances a
    WHERE a.user_id=v_user_id AND a.document_id=d.id AND a.acceptance_scope='user'
  )),'[]'::jsonb)
  INTO v_required,v_missing
  FROM current_docs d;

  RETURN jsonb_build_object('required_documents',COALESCE(v_required,'[]'::jsonb),
    'missing_document_slugs',COALESCE(v_missing,'[]'::jsonb));
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_current_legal_documents(
  p_acceptance_method text DEFAULT 'required_reacceptance',
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_doc record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_acceptance_method NOT IN ('required_reacceptance','privacy_preferences') THEN
    RAISE EXCEPTION 'Invalid acceptance method.';
  END IF;
  IF (SELECT count(DISTINCT slug) FROM public.legal_documents
      WHERE status='published' AND is_required=true AND locale='en-IN'
        AND slug IN ('terms-of-service','privacy-policy')) < 2 THEN
    RAISE EXCEPTION 'The required Terms of Service and Privacy Policy must both be published before acceptance.';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=v_user_id;

  FOR v_doc IN
    SELECT DISTINCT ON (d.slug) d.id
    FROM public.legal_documents d
    WHERE d.status='published' AND d.is_required=true AND d.locale='en-IN'
      AND d.slug IN ('terms-of-service','privacy-policy')
    ORDER BY d.slug,d.published_at DESC,d.created_at DESC
  LOOP
    PERFORM private.record_legal_acceptance(v_user_id,v_email,v_doc.id,p_acceptance_method,p_user_agent,'user',NULL);
  END LOOP;
  RETURN public.get_my_legal_status();
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_legal_acceptance_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_total bigint; v_missing bigint; v_recent jsonb;
BEGIN
  PERFORM private.require_platform_admin();
  SELECT count(*) INTO v_total FROM public.user_legal_acceptances;
  WITH current_docs AS (
    SELECT DISTINCT ON (d.slug) d.id,d.slug
    FROM public.legal_documents d
    WHERE d.status='published' AND d.is_required=true AND d.locale='en-IN'
      AND d.slug IN ('terms-of-service','privacy-policy')
    ORDER BY d.slug,d.published_at DESC
  ), registered_users AS (
    SELECT u.id FROM auth.users u
    WHERE EXISTS (SELECT 1 FROM current_docs)
  )
  SELECT count(*) INTO v_missing
  FROM registered_users u
  WHERE EXISTS (SELECT 1 FROM current_docs)
    AND EXISTS (
      SELECT 1 FROM current_docs d
      WHERE NOT EXISTS (SELECT 1 FROM public.user_legal_acceptances a
        WHERE a.user_id=u.id AND a.document_id=d.id AND a.acceptance_scope='user')
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO v_recent
  FROM (
    SELECT a.user_email,a.document_slug,a.document_title,a.document_version,a.content_sha256,
      a.acceptance_scope,a.acceptance_method,a.institute_id,a.accepted_at
    FROM public.user_legal_acceptances a
    ORDER BY a.accepted_at DESC LIMIT 100
  ) r;

  RETURN jsonb_build_object('total_acceptance_events',v_total,
    'users_missing_current_acceptance',v_missing,'recent_acceptances',v_recent);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_legal_audit_logs(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_limit integer := LEAST(GREATEST(COALESCE(p_limit,100),1),500);
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
    FROM (
      SELECT l.action,l.details,l.created_at,u.email AS actor_email,
        d.slug AS document_slug,d.title AS document_title,d.version AS document_version
      FROM private.legal_admin_audit_logs l
      LEFT JOIN auth.users u ON u.id=l.actor_id
      LEFT JOIN public.legal_documents d ON d.id=l.document_id
      ORDER BY l.created_at DESC
      LIMIT v_limit
    ) r
  ),'[]'::jsonb);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_my_legal_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_current_legal_documents(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_legal_acceptance_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_legal_audit_logs(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_legal_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_current_legal_documents(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_legal_acceptance_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_legal_audit_logs(integer) TO authenticated;

COMMIT;