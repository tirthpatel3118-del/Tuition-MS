CREATE OR REPLACE FUNCTION public.get_my_dpa_requirements()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_doc record;
  v_institutes jsonb;
  v_missing jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT id,title,version,locale,content_sha256,published_at,is_test_only
  INTO v_doc
  FROM public.legal_documents
  WHERE slug='data-processing-agreement' AND status='published' AND locale='en-IN'
  ORDER BY published_at DESC,created_at DESC
  LIMIT 1;

  IF v_doc.id IS NULL THEN
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object(
        'institute_id',m.institute_id,'institute_name',i.name,
        'accepted',false,'accepted_by',NULL,'accepted_at',NULL
      ) ORDER BY i.name),'[]'::jsonb),
      COALESCE(jsonb_agg(m.institute_id),'[]'::jsonb)
    INTO v_institutes,v_missing
    FROM public.institute_members m
    JOIN public.institutes i ON i.id=m.institute_id
    WHERE m.user_id=v_user_id AND m.role='owner';

    RETURN jsonb_build_object(
      'document',NULL,
      'institutes',COALESCE(v_institutes,'[]'::jsonb),
      'missing_institute_ids',COALESCE(v_missing,'[]'::jsonb)
    );
  END IF;

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'institute_id',m.institute_id,
      'institute_name',i.name,
      'accepted',a.accepted_at IS NOT NULL,
      'accepted_by',a.user_email,
      'accepted_at',a.accepted_at
    ) ORDER BY i.name),'[]'::jsonb),
    COALESCE(jsonb_agg(m.institute_id) FILTER (WHERE a.accepted_at IS NULL),'[]'::jsonb)
  INTO v_institutes,v_missing
  FROM public.institute_members m
  JOIN public.institutes i ON i.id=m.institute_id
  LEFT JOIN LATERAL (
    SELECT x.user_email,x.accepted_at
    FROM public.user_legal_acceptances x
    WHERE x.document_id=v_doc.id
      AND x.institute_id=m.institute_id
      AND x.acceptance_scope='institute'
    ORDER BY x.accepted_at DESC
    LIMIT 1
  ) a ON true
  WHERE m.user_id=v_user_id AND m.role='owner';

  RETURN jsonb_build_object(
    'document',jsonb_build_object(
      'id',v_doc.id,'title',v_doc.title,'version',v_doc.version,'locale',v_doc.locale,
      'content_sha256',v_doc.content_sha256,'published_at',v_doc.published_at,
      'is_test_only',v_doc.is_test_only
    ),
    'institutes',COALESCE(v_institutes,'[]'::jsonb),
    'missing_institute_ids',COALESCE(v_missing,'[]'::jsonb)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.get_my_dpa_requirements() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_dpa_requirements() TO authenticated;