BEGIN;

-- Return only institution-level DPA status for the signed-in user's owner memberships.
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
    RETURN jsonb_build_object('document',NULL,'institutes','[]'::jsonb,'missing_institute_ids','[]'::jsonb);
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

-- New institute creation and DPA acceptance are one transaction. If the
-- DPA is missing/stale or acceptance cannot be recorded, institute creation rolls back.
CREATE OR REPLACE FUNCTION public.create_institute_with_dpa_acceptance(
  p_name text,
  p_slug text,
  p_dpa_document_id uuid,
  p_user_agent text DEFAULT NULL,
  p_currency_symbol text DEFAULT '₹',
  p_receipt_prefix text DEFAULT 'REC'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_current_dpa_id uuid;
  v_institute_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT id INTO v_current_dpa_id
  FROM public.legal_documents
  WHERE slug='data-processing-agreement' AND status='published' AND locale='en-IN'
  ORDER BY published_at DESC,created_at DESC
  LIMIT 1;

  IF v_current_dpa_id IS NULL THEN
    RAISE EXCEPTION 'A current Data Processing Agreement must be published before an institute can be created.';
  END IF;

  IF p_dpa_document_id IS DISTINCT FROM v_current_dpa_id THEN
    RAISE EXCEPTION 'The Data Processing Agreement changed. Reload the latest version and review it before creating the institute.';
  END IF;

  -- Existing function validates the invitation grant and creates owner membership.
  v_institute_id := public.create_institute_atomic(
    p_name,p_slug,p_currency_symbol,p_receipt_prefix
  );

  SELECT email INTO v_email FROM auth.users WHERE id=v_user_id;
  PERFORM private.record_legal_acceptance(
    v_user_id,v_email,v_current_dpa_id,'institute_dpa',p_user_agent,'institute',v_institute_id
  );

  RETURN v_institute_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_dpa_requirements() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_dpa_requirements() TO authenticated;

REVOKE ALL ON FUNCTION public.create_institute_atomic(text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_institute_with_dpa_acceptance(text,text,uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_institute_with_dpa_acceptance(text,text,uuid,text,text,text) TO authenticated;

COMMIT;