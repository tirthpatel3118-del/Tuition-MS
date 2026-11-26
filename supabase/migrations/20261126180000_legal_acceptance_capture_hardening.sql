BEGIN;

-- Match the exact versions shown on the signup screen before recording the
-- server-side acceptance. If a document changes between screen load and
-- account creation, the normal authenticated reacceptance gate will handle it.
CREATE OR REPLACE FUNCTION private.capture_signup_legal_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_terms_id uuid;
  v_privacy_id uuid;
  v_privacy record;
  v_updates boolean := COALESCE(NEW.raw_user_meta_data->>'legal_product_updates','false') = 'true';
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'legal_terms_accepted','false') <> 'true'
     OR COALESCE(NEW.raw_user_meta_data->>'legal_privacy_acknowledged','false') <> 'true' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_terms_id
  FROM public.legal_documents
  WHERE slug='terms-of-service' AND locale='en-IN' AND status='published' AND is_required=true
  ORDER BY published_at DESC LIMIT 1;

  SELECT id INTO v_privacy_id
  FROM public.legal_documents
  WHERE slug='privacy-policy' AND locale='en-IN' AND status='published' AND is_required=true
  ORDER BY published_at DESC LIMIT 1;

  IF v_terms_id IS NULL OR v_privacy_id IS NULL
     OR NULLIF(NEW.raw_user_meta_data->>'legal_terms_document_id','') IS DISTINCT FROM v_terms_id::text
     OR NULLIF(NEW.raw_user_meta_data->>'legal_privacy_document_id','') IS DISTINCT FROM v_privacy_id::text THEN
    RETURN NEW;
  END IF;

  PERFORM private.record_legal_acceptance(NEW.id,NEW.email,v_terms_id,'signup',
    NEW.raw_user_meta_data->>'legal_acceptance_user_agent','user',NULL);
  PERFORM private.record_legal_acceptance(NEW.id,NEW.email,v_privacy_id,'signup',
    NEW.raw_user_meta_data->>'legal_acceptance_user_agent','user',NULL);

  SELECT id,version,content_sha256 INTO v_privacy
  FROM public.legal_documents WHERE id=v_privacy_id;

  INSERT INTO public.privacy_consent_events(
    user_id,user_email,purpose_key,purpose_description,granted,privacy_document_id,
    privacy_document_version,privacy_document_sha256,consent_method
  ) VALUES (
    NEW.id,COALESCE(NEW.email,'[email unavailable]'),'product_updates',
    'Receive optional ClassBandhu product news and release updates by email.',
    v_updates,v_privacy.id,v_privacy.version,v_privacy.content_sha256,'signup'
  );
  RETURN NEW;
END;
$function$;

-- Permit only referential cleanup when a user account is deleted; no legal
-- evidence fields may be edited or deleted through application roles.
CREATE OR REPLACE FUNCTION private.prevent_legal_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP='UPDATE'
     AND OLD.user_id IS NOT NULL
     AND NEW.user_id IS NULL
     AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Legal acceptance and consent history is append-only.';
END;
$function$;

-- Production legal text must not contain unresolved template placeholders.
CREATE OR REPLACE FUNCTION public.platform_admin_publish_legal_document(
  p_document_id uuid,
  p_confirm_reviewed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_doc record;
BEGIN
  PERFORM private.require_platform_admin();
  IF p_confirm_reviewed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Confirm the publication action.';
  END IF;
  SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id AND status='draft' FOR UPDATE;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Draft legal document not found.'; END IF;
  IF length(trim(v_doc.body_markdown))<40 THEN RAISE EXCEPTION 'Document content is incomplete.'; END IF;
  IF encode(extensions.digest(concat_ws(E'\n',v_doc.slug,v_doc.version,v_doc.locale,v_doc.title,v_doc.body_markdown),'sha256'),'hex')<>v_doc.content_sha256 THEN
    RAISE EXCEPTION 'Document hash mismatch. Save the draft again before publishing.';
  END IF;
  IF NOT v_doc.is_test_only AND (
    v_doc.body_markdown ILIKE '%DEVELOPMENT DRAFT%'
    OR v_doc.body_markdown ILIKE '%[INSERT%'
    OR v_doc.body_markdown ILIKE '%[CONFIRM%'
    OR v_doc.body_markdown ILIKE '%[COMPLETE%'
    OR v_doc.body_markdown ~ '\[[^]]{2,}\]'
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
REVOKE ALL ON FUNCTION public.platform_admin_publish_legal_document(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_publish_legal_document(uuid,boolean) TO authenticated;

COMMIT;