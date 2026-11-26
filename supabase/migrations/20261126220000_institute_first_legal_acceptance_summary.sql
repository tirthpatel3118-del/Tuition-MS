-- Keep the platform Super Admin legal summary grouped by complete acceptance actions.
-- Institute-scope evidence is presented against its institute; account-scope
-- signup and re-acceptance evidence remains separate.
CREATE OR REPLACE FUNCTION public.platform_admin_legal_acceptance_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_total bigint;
  v_missing bigint;
  v_recent jsonb;
BEGIN
  PERFORM private.require_platform_admin();

  SELECT count(*) INTO v_total
  FROM public.user_legal_acceptances;

  WITH current_docs AS (
    SELECT DISTINCT ON (d.slug) d.id, d.slug
    FROM public.legal_documents d
    WHERE d.status = 'published'
      AND d.is_required = true
      AND d.locale = 'en-IN'
      AND d.slug IN ('terms-of-service', 'acceptable-use-policy', 'privacy-policy')
    ORDER BY d.slug, d.published_at DESC, d.created_at DESC
  ),
  registered_users AS (
    SELECT u.id
    FROM auth.users u
    WHERE EXISTS (SELECT 1 FROM current_docs)
  )
  SELECT count(*) INTO v_missing
  FROM registered_users u
  WHERE EXISTS (
    SELECT 1
    FROM current_docs d
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_legal_acceptances a
      WHERE a.user_id = u.id
        AND a.document_id = d.id
        AND a.acceptance_scope = 'user'
    )
  );

  WITH acceptance_rows AS (
    SELECT
      a.*,
      COALESCE(a.user_id::text, 'no-user') || ':' ||
        COALESCE(a.action_id::text, 'record:' || a.id::text) AS action_group_key
    FROM public.user_legal_acceptances a
  ),
  recent_actions AS (
    SELECT action_group_key, max(accepted_at) AS last_accepted_at
    FROM acceptance_rows
    GROUP BY action_group_key
    ORDER BY max(accepted_at) DESC
    LIMIT 200
  )
  SELECT COALESCE(
    jsonb_agg(to_jsonb(r) ORDER BY r.accepted_at DESC),
    '[]'::jsonb
  )
  INTO v_recent
  FROM (
    SELECT
      CASE
        WHEN a.user_id IS NULL THEN 'ACCT-UNKNOWN'
        ELSE 'ACCT-' || upper(substr(md5(a.user_id::text), 1, 8))
      END AS actor_ref,
      a.actor_role,
      a.action_id,
      a.institute_id,
      i.name AS institute_name,
      a.document_slug,
      a.document_title,
      a.document_version,
      a.document_locale,
      a.content_sha256,
      a.acceptance_type,
      a.acceptance_scope,
      a.acceptance_method,
      a.acceptance_source,
      CASE
        WHEN a.acceptance_scope = 'institute' AND a.institute_id IS NOT NULL THEN 'institute'
        ELSE 'account'
      END AS acceptance_context,
      (current_doc.id = a.document_id) AS is_current_version,
      a.accepted_at
    FROM acceptance_rows a
    INNER JOIN recent_actions ra ON ra.action_group_key = a.action_group_key
    LEFT JOIN public.institutes i ON i.id = a.institute_id
    LEFT JOIN LATERAL (
      SELECT d.id
      FROM public.legal_documents d
      WHERE d.slug = a.document_slug
        AND d.locale = a.document_locale
        AND d.status = 'published'
      ORDER BY d.published_at DESC, d.created_at DESC
      LIMIT 1
    ) current_doc ON true
    ORDER BY a.accepted_at DESC
  ) r;

  RETURN jsonb_build_object(
    'total_acceptance_events', v_total,
    'users_missing_current_acceptance', v_missing,
    'recent_acceptances', v_recent
  );
END;
$function$;
