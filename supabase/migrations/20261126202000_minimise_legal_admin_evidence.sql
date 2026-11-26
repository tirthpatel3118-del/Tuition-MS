BEGIN;

CREATE OR REPLACE FUNCTION private.record_legal_acceptance(
  p_user_id uuid,p_user_email text,p_document_id uuid,p_method text,
  p_user_agent text DEFAULT NULL,p_scope text DEFAULT 'user',p_institute_id uuid DEFAULT NULL,
  p_acceptance_type text DEFAULT NULL,p_source text DEFAULT NULL,p_actor_role text DEFAULT NULL,p_action_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_doc record; v_rows integer;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Acceptance actor is required.'; END IF;
  IF p_scope NOT IN('user','institute') OR (p_scope='user' AND p_institute_id IS NOT NULL)
    OR (p_scope='institute' AND p_institute_id IS NULL) THEN RAISE EXCEPTION 'Invalid legal acceptance scope.'; END IF;
  IF p_scope='institute' AND NOT EXISTS(SELECT 1 FROM public.institute_members m
    WHERE m.institute_id=p_institute_id AND m.user_id=p_user_id AND m.role='owner') THEN
    RAISE EXCEPTION 'Only the current Institute Owner may record Institute legal acceptance.';
  END IF;
  SELECT id,slug,title,version,locale,content_sha256 INTO v_doc
  FROM public.legal_documents WHERE id=p_document_id AND status='published';
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'The selected legal document is not currently published.'; END IF;
  INSERT INTO public.user_legal_acceptances(
    user_id,user_email,document_id,document_slug,document_title,document_version,document_locale,
    content_sha256,acceptance_scope,institute_id,acceptance_method,user_agent,acceptance_type,
    acceptance_source,actor_role,action_id,accepted_at
  ) VALUES (
    p_user_id,COALESCE(NULLIF(trim(p_user_email),''),'[email unavailable]'),v_doc.id,v_doc.slug,
    v_doc.title,v_doc.version,v_doc.locale,v_doc.content_sha256,p_scope,p_institute_id,p_method,NULL,
    COALESCE(p_acceptance_type,CASE v_doc.slug WHEN 'terms-of-service' THEN 'terms_acceptance'
      WHEN 'acceptable-use-policy' THEN 'aup_acceptance' WHEN 'privacy-policy' THEN 'privacy_acknowledgement'
      WHEN 'data-processing-agreement' THEN 'dpa_acceptance' ELSE NULL END),
    COALESCE(p_source,CASE p_method WHEN 'signup' THEN 'signup'
      WHEN 'institute_legal_bundle' THEN 'institute_creation' ELSE 'login_gate' END),
    p_actor_role,p_action_id,now()
  ) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows=0 AND NOT EXISTS(SELECT 1 FROM public.user_legal_acceptances a
    WHERE a.user_id=p_user_id AND a.document_id=v_doc.id AND a.acceptance_scope=p_scope
      AND a.institute_id IS NOT DISTINCT FROM p_institute_id AND a.content_sha256=v_doc.content_sha256) THEN
    RAISE EXCEPTION 'Legal acceptance evidence could not be recorded.';
  END IF;
END;$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_legal_acceptance_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_total bigint; v_missing bigint; v_recent jsonb;
BEGIN
  PERFORM private.require_platform_admin();
  SELECT count(*) INTO v_total FROM public.user_legal_acceptances;
  WITH current_docs AS (
    SELECT DISTINCT ON(d.slug) d.id,d.slug FROM public.legal_documents d
    WHERE d.status='published' AND d.is_required=true AND d.locale='en-IN'
      AND d.slug IN('terms-of-service','acceptable-use-policy','privacy-policy')
    ORDER BY d.slug,d.published_at DESC,d.created_at DESC
  ), registered_users AS (
    SELECT u.id FROM auth.users u WHERE EXISTS(SELECT 1 FROM current_docs)
  )
  SELECT count(*) INTO v_missing FROM registered_users u
  WHERE EXISTS(SELECT 1 FROM current_docs d WHERE NOT EXISTS(
    SELECT 1 FROM public.user_legal_acceptances a WHERE a.user_id=u.id AND a.document_id=d.id AND a.acceptance_scope='user'));
  SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO v_recent
  FROM (
    SELECT a.document_slug,a.document_title,a.document_version,a.document_locale,a.content_sha256,
      a.acceptance_type,a.acceptance_scope,a.acceptance_method,a.acceptance_source,a.actor_role,
      CASE WHEN a.institute_id IS NULL THEN 'account' ELSE 'institute' END AS acceptance_context,a.accepted_at
    FROM public.user_legal_acceptances a ORDER BY a.accepted_at DESC LIMIT 100
  ) r;
  RETURN jsonb_build_object('total_acceptance_events',v_total,'users_missing_current_acceptance',v_missing,'recent_acceptances',v_recent);
END;$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_export_legal_acceptances(p_limit integer DEFAULT 10000)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_limit integer:=LEAST(GREATEST(COALESCE(p_limit,10000),1),10000);
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.accepted_at DESC)
    FROM (
      SELECT a.id,a.document_slug,a.document_title,a.document_version,a.document_locale,a.content_sha256,
        a.acceptance_type,a.acceptance_scope,a.acceptance_method,a.acceptance_source,a.actor_role,
        CASE WHEN a.institute_id IS NULL THEN 'account' ELSE 'institute' END AS acceptance_context,a.accepted_at
      FROM public.user_legal_acceptances a ORDER BY a.accepted_at DESC LIMIT v_limit
    ) r
  ),'[]'::jsonb);
END;$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_legal_audit_logs(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_limit integer:=LEAST(GREATEST(COALESCE(p_limit,100),1),500);
BEGIN
  PERFORM private.require_platform_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
    FROM (
      SELECT l.action,l.details,l.created_at,d.slug AS document_slug,d.title AS document_title,d.version AS document_version
      FROM private.legal_admin_audit_logs l
      LEFT JOIN public.legal_documents d ON d.id=l.document_id
      ORDER BY l.created_at DESC LIMIT v_limit
    ) r
  ),'[]'::jsonb);
END;$function$;

COMMIT;
