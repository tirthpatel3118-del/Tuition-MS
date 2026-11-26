-- Production-safe legal rollout behavior:
-- Do not block existing institute access while the required legal bundle is
-- incomplete or still unpublished. Once all three account policies are
-- published, account-level re-acceptance is enforced. Once all four institute
-- documents are published, owner-specific Institute bundle acceptance is
-- enforced. No test-only policy is published by this migration.

CREATE OR REPLACE FUNCTION private.has_current_account_legal_acceptance(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH d AS (
    SELECT DISTINCT ON (slug) id, slug, content_sha256
    FROM public.legal_documents
    WHERE status = 'published'
      AND is_required = true
      AND locale = 'en-IN'
      AND slug IN ('terms-of-service', 'acceptable-use-policy', 'privacy-policy')
    ORDER BY slug, published_at DESC, created_at DESC
  )
  SELECT count(*) < 3
      OR count(*) FILTER (
        WHERE EXISTS (
          SELECT 1
          FROM public.user_legal_acceptances a
          WHERE a.user_id = p_user_id
            AND a.document_id = d.id
            AND a.acceptance_scope = 'user'
            AND a.content_sha256 = d.content_sha256
        )
      ) = 3
  FROM d;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_legal_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  req jsonb;
  missing jsonb;
  n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  WITH d AS (
    SELECT DISTINCT ON (slug)
      id, slug, title, version, locale, content_sha256, is_test_only
    FROM public.legal_documents
    WHERE status = 'published'
      AND is_required = true
      AND locale = 'en-IN'
      AND slug IN ('terms-of-service', 'acceptable-use-policy', 'privacy-policy')
    ORDER BY slug, published_at DESC, created_at DESC
  )
  SELECT count(*),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'slug', slug, 'title', title, 'version', version,
      'locale', locale, 'content_sha256', content_sha256, 'is_test_only', is_test_only
    ) ORDER BY slug), '[]'::jsonb),
    COALESCE(jsonb_agg(slug) FILTER (WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_legal_acceptances a
      WHERE a.user_id = uid
        AND a.document_id = d.id
        AND a.acceptance_scope = 'user'
        AND a.content_sha256 = d.content_sha256
    )), '[]'::jsonb)
  INTO n, req, missing
  FROM d;

  IF n <> 3 THEN
    RETURN jsonb_build_object(
      'required_documents', COALESCE(req, '[]'::jsonb),
      'missing_document_slugs', '[]'::jsonb,
      'account_legal_bundle_ready', false
    );
  END IF;

  RETURN jsonb_build_object(
    'required_documents', COALESCE(req, '[]'::jsonb),
    'missing_document_slugs', COALESCE(missing, '[]'::jsonb),
    'account_legal_bundle_ready', true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.is_member_of(
  _institute_id uuid,
  _required_roles text[] DEFAULT ARRAY['owner','accountant','teacher']::text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.institute_members m
      CROSS JOIN private.legal_transition_config c
      WHERE m.institute_id = _institute_id
        AND m.user_id = auth.uid()
        AND m.role = ANY(_required_roles)
        AND c.singleton = true
        AND private.has_current_account_legal_acceptance(auth.uid())
        AND (
          m.role <> 'owner'
          OR (
            (SELECT count(DISTINCT d.slug)
             FROM public.legal_documents d
             WHERE d.status = 'published'
               AND d.locale = 'en-IN'
               AND d.slug IN ('terms-of-service','acceptable-use-policy','privacy-policy','data-processing-agreement')) < 4
            OR private.has_current_institute_legal_acceptance(auth.uid(), _institute_id)
            OR (
              m.owner_appointed_at < c.activated_at
              AND now() < c.activated_at + make_interval(days => c.grace_days)
            )
          )
        )
    )
    AND COALESCE((SELECT c.access_status FROM private.platform_institute_controls c WHERE c.institute_id = _institute_id), 'active') = 'active'
    AND COALESCE((SELECT c.subscription_status FROM private.platform_institute_controls c WHERE c.institute_id = _institute_id), 'trial') IN ('trial','active','past_due')
    AND COALESCE((SELECT c.starts_at FROM private.platform_institute_controls c WHERE c.institute_id = _institute_id), '-infinity'::timestamptz) <= now()
    AND COALESCE((SELECT c.expires_at FROM private.platform_institute_controls c WHERE c.institute_id = _institute_id), 'infinity'::timestamptz) > now();
$function$;

CREATE OR REPLACE FUNCTION public.get_my_dpa_requirements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_bundle_count integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  v_result := public.get_my_dpa_requirements_v04_base();

  SELECT count(DISTINCT slug)
  INTO v_bundle_count
  FROM public.legal_documents
  WHERE status = 'published'
    AND locale = 'en-IN'
    AND slug IN ('terms-of-service','acceptable-use-policy','privacy-policy','data-processing-agreement');

  IF v_bundle_count <> 4 THEN
    v_result := jsonb_set(v_result, '{missing_institute_ids}', '[]'::jsonb, true);
  END IF;

  v_result := jsonb_set(v_result, '{institute_bundle_ready}', to_jsonb(v_bundle_count = 4), true);
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_dpa_requirements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_dpa_requirements() TO authenticated;
