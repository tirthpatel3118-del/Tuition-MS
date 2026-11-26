-- Permit test-only legal publication in development, but allow production to disable it.
ALTER TABLE private.legal_transition_config
  ADD COLUMN IF NOT EXISTS allow_test_only_publication boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.platform_admin_publish_legal_document(p_document_id uuid, p_confirm_reviewed boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_doc record;
  v_allow_test_only boolean;
BEGIN
  PERFORM private.require_platform_admin();
  IF p_confirm_reviewed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Confirm the publication action.';
  END IF;

  SELECT * INTO v_doc
  FROM public.legal_documents
  WHERE id=p_document_id AND status='draft'
  FOR UPDATE;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Draft legal document not found.'; END IF;

  SELECT allow_test_only_publication
  INTO v_allow_test_only
  FROM private.legal_transition_config
  WHERE singleton=true;

  IF v_doc.is_test_only AND NOT COALESCE(v_allow_test_only,false) THEN
    RAISE EXCEPTION 'Test-only legal documents cannot be published in this environment.';
  END IF;

  IF length(trim(v_doc.body_markdown))<40 THEN
    RAISE EXCEPTION 'Document content is incomplete.';
  END IF;
  IF encode(extensions.digest(concat_ws(E'\n',v_doc.slug,v_doc.version,v_doc.locale,v_doc.title,v_doc.body_markdown),'sha256'),'hex')<>v_doc.content_sha256 THEN
    RAISE EXCEPTION 'Document hash mismatch. Save the draft again before publishing.';
  END IF;
  IF NOT v_doc.is_test_only AND (
    v_doc.body_markdown ILIKE '%DEVELOPMENT DRAFT%'
    OR v_doc.body_markdown ILIKE '%[INSERT%'
    OR v_doc.body_markdown ILIKE '%[CONFIRM%'
    OR v_doc.body_markdown ILIKE '%[COMPLETE%'
    OR v_doc.body_markdown ~ '\\[[^]]{2,}\\]'
  ) THEN
    RAISE EXCEPTION 'Production legal documents cannot contain draft notices or unresolved placeholders.';
  END IF;

  UPDATE public.legal_documents
  SET status='archived',updated_by=auth.uid(),updated_at=now()
  WHERE slug=v_doc.slug AND locale=v_doc.locale AND status='published' AND id<>v_doc.id;

  UPDATE public.legal_documents
  SET status='published',published_at=now(),effective_at=now(),published_by=auth.uid(),
    updated_by=auth.uid(),updated_at=now()
  WHERE id=v_doc.id;

  INSERT INTO private.legal_admin_audit_logs(actor_id,action,document_id,details)
  VALUES(auth.uid(),'DOCUMENT_PUBLISHED',v_doc.id,jsonb_build_object(
    'slug',v_doc.slug,'version',v_doc.version,'content_sha256',v_doc.content_sha256,
    'is_required',v_doc.is_required,'is_test_only',v_doc.is_test_only));
END;
$function$;
