
BEGIN;

CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL CHECK (slug = ANY (ARRAY['privacy-policy','terms-of-service','data-processing-agreement','cookie-policy'])),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 160),
  version text NOT NULL CHECK (char_length(trim(version)) BETWEEN 1 AND 32),
  locale text NOT NULL DEFAULT 'en-IN',
  body_markdown text NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft','published','archived'])),
  is_required boolean NOT NULL DEFAULT false,
  is_test_only boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  effective_at timestamptz,
  published_at timestamptz,
  UNIQUE (slug, version, locale),
  CHECK ((status = 'published' AND published_at IS NOT NULL AND effective_at IS NOT NULL) OR status <> 'published')
);

CREATE UNIQUE INDEX IF NOT EXISTS legal_documents_one_published_per_locale
  ON public.legal_documents (slug, locale) WHERE status = 'published';

CREATE INDEX IF NOT EXISTS legal_documents_public_lookup
  ON public.legal_documents (slug, locale, published_at DESC) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.user_legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE RESTRICT,
  document_slug text NOT NULL,
  document_title text NOT NULL,
  document_version text NOT NULL,
  document_locale text NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  acceptance_scope text NOT NULL DEFAULT 'user' CHECK (acceptance_scope = ANY (ARRAY['user','institute'])),
  institute_id uuid REFERENCES public.institutes(id) ON DELETE SET NULL,
  acceptance_method text NOT NULL CHECK (acceptance_method = ANY (ARRAY['signup','required_reacceptance','privacy_preferences','institute_dpa'])),
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((acceptance_scope = 'user' AND institute_id IS NULL) OR (acceptance_scope = 'institute' AND institute_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS user_legal_acceptances_user_document_unique
  ON public.user_legal_acceptances (user_id, document_id) WHERE acceptance_scope = 'user' AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_legal_acceptances_institute_document_unique
  ON public.user_legal_acceptances (user_id, document_id, institute_id) WHERE acceptance_scope = 'institute' AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_legal_acceptances_user_date_idx
  ON public.user_legal_acceptances (user_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS user_legal_acceptances_document_idx
  ON public.user_legal_acceptances (document_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS public.privacy_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  purpose_key text NOT NULL CHECK (purpose_key = 'product_updates'),
  purpose_description text NOT NULL,
  granted boolean NOT NULL,
  privacy_document_id uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  privacy_document_version text,
  privacy_document_sha256 text,
  consent_method text NOT NULL CHECK (consent_method = ANY (ARRAY['signup','privacy_preferences'])),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS privacy_consent_events_user_date_idx
  ON public.privacy_consent_events (user_id, purpose_key, changed_at DESC);

CREATE TABLE IF NOT EXISTS private.legal_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action = ANY (ARRAY['DRAFT_CREATED','DRAFT_UPDATED','DOCUMENT_PUBLISHED','DOCUMENT_ARCHIVED'])),
  document_id uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.legal_admin_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.legal_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.user_legal_acceptances FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.privacy_consent_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.legal_admin_audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.legal_documents TO anon, authenticated;
GRANT SELECT ON public.user_legal_acceptances TO authenticated;
GRANT SELECT ON public.privacy_consent_events TO authenticated;

DROP POLICY IF EXISTS "Published legal documents are public" ON public.legal_documents;
CREATE POLICY "Published legal documents are public"
  ON public.legal_documents FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "Users can view their own legal acceptance history" ON public.user_legal_acceptances;
CREATE POLICY "Users can view their own legal acceptance history"
  ON public.user_legal_acceptances FOR SELECT TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) AND acceptance_scope = 'user')
    OR (acceptance_scope = 'institute' AND institute_id IS NOT NULL
      AND private.is_member_of(institute_id, ARRAY['owner']::text[]))
  );

DROP POLICY IF EXISTS "Users can view their own privacy consent history" ON public.privacy_consent_events;
CREATE POLICY "Users can view their own privacy consent history"
  ON public.privacy_consent_events FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION private.prevent_legal_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'Legal acceptance and consent history is append-only.';
END;
$function$;
REVOKE ALL ON FUNCTION private.prevent_legal_history_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_legal_acceptances_append_only ON public.user_legal_acceptances;
CREATE TRIGGER user_legal_acceptances_append_only
  BEFORE UPDATE OR DELETE ON public.user_legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION private.prevent_legal_history_mutation();

DROP TRIGGER IF EXISTS privacy_consent_events_append_only ON public.privacy_consent_events;
CREATE TRIGGER privacy_consent_events_append_only
  BEFORE UPDATE OR DELETE ON public.privacy_consent_events
  FOR EACH ROW EXECUTE FUNCTION private.prevent_legal_history_mutation();

CREATE OR REPLACE FUNCTION private.record_legal_acceptance(
  p_user_id uuid,
  p_user_email text,
  p_document_id uuid,
  p_method text,
  p_user_agent text DEFAULT NULL,
  p_scope text DEFAULT 'user',
  p_institute_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.user_legal_acceptances(
    user_id,user_email,document_id,document_slug,document_title,document_version,
    document_locale,content_sha256,acceptance_scope,institute_id,acceptance_method,user_agent
  )
  SELECT p_user_id,COALESCE(NULLIF(trim(p_user_email),''),'[email unavailable]'),d.id,d.slug,d.title,d.version,
    d.locale,d.content_sha256,p_scope,p_institute_id,p_method,NULLIF(left(COALESCE(p_user_agent,''),500),'')
  FROM public.legal_documents d
  WHERE d.id=p_document_id AND d.status='published'
  ON CONFLICT DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION private.record_legal_acceptance(uuid,text,uuid,text,text,text,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.capture_signup_legal_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_doc record;
  v_privacy record;
  v_updates boolean := COALESCE(NEW.raw_user_meta_data->>'legal_product_updates','false') = 'true';
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'legal_terms_accepted','false') <> 'true'
     OR COALESCE(NEW.raw_user_meta_data->>'legal_privacy_acknowledged','false') <> 'true' THEN
    RETURN NEW;
  END IF;

  FOR v_doc IN
    SELECT d.id FROM public.legal_documents d
    WHERE d.status='published' AND d.is_required=true AND d.slug IN ('terms-of-service','privacy-policy')
    ORDER BY d.slug
  LOOP
    PERFORM private.record_legal_acceptance(NEW.id,NEW.email,v_doc.id,'signup',
      NEW.raw_user_meta_data->>'legal_acceptance_user_agent','user',NULL);
  END LOOP;

  SELECT d.id,d.version,d.content_sha256 INTO v_privacy
  FROM public.legal_documents d
  WHERE d.slug='privacy-policy' AND d.status='published'
  ORDER BY d.published_at DESC LIMIT 1;

  IF v_privacy.id IS NOT NULL THEN
    INSERT INTO public.privacy_consent_events(
      user_id,user_email,purpose_key,purpose_description,granted,privacy_document_id,
      privacy_document_version,privacy_document_sha256,consent_method
    ) VALUES (
      NEW.id,COALESCE(NEW.email,'[email unavailable]'),'product_updates',
      'Receive optional ClassBandhu product news and release updates by email.',
      v_updates,v_privacy.id,v_privacy.version,v_privacy.content_sha256,'signup'
    );
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.capture_signup_legal_acceptance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS capture_legal_signup_acceptance ON auth.users;
CREATE TRIGGER capture_legal_signup_acceptance
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.capture_signup_legal_acceptance();

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
    WHERE d.status='published' AND d.is_required=true
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
  v_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_acceptance_method NOT IN ('required_reacceptance','privacy_preferences') THEN
    RAISE EXCEPTION 'Invalid acceptance method.';
  END IF;
  IF (SELECT count(DISTINCT slug) FROM public.legal_documents
      WHERE status='published' AND is_required=true AND slug IN ('terms-of-service','privacy-policy')) < 2 THEN
    RAISE EXCEPTION 'The required Terms of Service and Privacy Policy must both be published before acceptance.';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=v_user_id;

  FOR v_doc IN
    SELECT DISTINCT ON (d.slug) d.id
    FROM public.legal_documents d
    WHERE d.status='published' AND d.is_required=true
      AND d.slug IN ('terms-of-service','privacy-policy')
    ORDER BY d.slug,d.published_at DESC,d.created_at DESC
  LOOP
    PERFORM private.record_legal_acceptance(v_user_id,v_email,v_doc.id,p_acceptance_method,p_user_agent,'user',NULL);
    v_count:=v_count+1;
  END LOOP;
  RETURN public.get_my_legal_status();
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_privacy_consents()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_user_id uuid:=auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  RETURN COALESCE((
    SELECT jsonb_build_object('product_updates',c.granted,'updated_at',c.changed_at,
      'privacy_document_version',c.privacy_document_version)
    FROM public.privacy_consent_events c
    WHERE c.user_id=v_user_id AND c.purpose_key='product_updates'
    ORDER BY c.changed_at DESC LIMIT 1
  ),jsonb_build_object('product_updates',false,'updated_at',NULL,'privacy_document_version',NULL));
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_privacy_consent(p_purpose text,p_granted boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid:=auth.uid();
  v_email text;
  v_doc record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_purpose <> 'product_updates' OR p_granted IS NULL THEN RAISE EXCEPTION 'Unsupported privacy preference.'; END IF;
  SELECT id,version,content_sha256 INTO v_doc
  FROM public.legal_documents WHERE slug='privacy-policy' AND status='published'
  ORDER BY published_at DESC LIMIT 1;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'A published Privacy Policy is required.'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=v_user_id;
  INSERT INTO public.privacy_consent_events(
    user_id,user_email,purpose_key,purpose_description,granted,privacy_document_id,
    privacy_document_version,privacy_document_sha256,consent_method
  ) VALUES (
    v_user_id,COALESCE(v_email,'[email unavailable]'),'product_updates',
    'Receive optional ClassBandhu product news and release updates by email.',
    p_granted,v_doc.id,v_doc.version,v_doc.content_sha256,'privacy_preferences'
  );
  RETURN public.get_my_privacy_consents();
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_institute_dpa_status(p_institute_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_doc record; v_acceptance record;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_member_of(p_institute_id,ARRAY['owner']::text[]) THEN
    RAISE EXCEPTION 'Active institute owner access is required.';
  END IF;
  SELECT id,title,version,content_sha256,published_at INTO v_doc
  FROM public.legal_documents
  WHERE slug='data-processing-agreement' AND status='published'
  ORDER BY published_at DESC LIMIT 1;
  IF v_doc.id IS NULL THEN RETURN jsonb_build_object('document',NULL,'accepted',false); END IF;
  SELECT user_email,accepted_at INTO v_acceptance
  FROM public.user_legal_acceptances
  WHERE document_id=v_doc.id AND institute_id=p_institute_id AND acceptance_scope='institute'
  ORDER BY accepted_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'document',jsonb_build_object('id',v_doc.id,'title',v_doc.title,'version',v_doc.version,'content_sha256',v_doc.content_sha256,'published_at',v_doc.published_at),
    'accepted',v_acceptance.accepted_at IS NOT NULL,
    'accepted_by',v_acceptance.user_email,
    'accepted_at',v_acceptance.accepted_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_current_institute_dpa(p_institute_id uuid,p_user_agent text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_doc record; v_email text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_member_of(p_institute_id,ARRAY['owner']::text[]) THEN
    RAISE EXCEPTION 'Only an active institute owner can accept the Data Processing Agreement.';
  END IF;
  SELECT id INTO v_doc FROM public.legal_documents
  WHERE slug='data-processing-agreement' AND status='published'
  ORDER BY published_at DESC LIMIT 1;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'No published Data Processing Agreement is available.'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=auth.uid();
  PERFORM private.record_legal_acceptance(auth.uid(),v_email,v_doc.id,'institute_dpa',p_user_agent,'institute',p_institute_id);
  RETURN public.get_institute_dpa_status(p_institute_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_list_legal_documents()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.require_platform_admin();
  RETURN jsonb_build_object('documents',COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id',d.id,'slug',d.slug,'title',d.title,'version',d.version,'locale',d.locale,
      'body_markdown',d.body_markdown,'content_sha256',d.content_sha256,'status',d.status,
      'is_required',d.is_required,'is_test_only',d.is_test_only,'created_at',d.created_at,
      'updated_at',d.updated_at,'published_at',d.published_at,'effective_at',d.effective_at,
      'acceptance_count',(SELECT count(*) FROM public.user_legal_acceptances a WHERE a.document_id=d.id)
    ) ORDER BY d.slug,d.created_at DESC)
    FROM public.legal_documents d
  ),'[]'::jsonb));
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
    WHERE d.status='published' AND d.is_required=true
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

CREATE OR REPLACE FUNCTION public.platform_admin_save_legal_document(
  p_document_id uuid,
  p_slug text,
  p_title text,
  p_version text,
  p_locale text,
  p_body_markdown text,
  p_is_required boolean,
  p_is_test_only boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_id uuid; v_hash text; v_action text;
BEGIN
  PERFORM private.require_platform_admin();
  IF p_slug NOT IN ('privacy-policy','terms-of-service','data-processing-agreement','cookie-policy') THEN
    RAISE EXCEPTION 'Unsupported legal document type.';
  END IF;
  IF p_title IS NULL OR char_length(trim(p_title)) NOT BETWEEN 3 AND 160 THEN RAISE EXCEPTION 'Enter a valid document title.'; END IF;
  IF p_version IS NULL OR char_length(trim(p_version)) NOT BETWEEN 1 AND 32 THEN RAISE EXCEPTION 'Enter a valid version.'; END IF;
  IF p_locale IS NULL OR trim(p_locale)='' OR char_length(p_locale)>12 THEN RAISE EXCEPTION 'Enter a valid locale.'; END IF;
  IF p_body_markdown IS NULL OR char_length(trim(p_body_markdown))<40 OR char_length(p_body_markdown)>200000 THEN
    RAISE EXCEPTION 'Document text must be between 40 and 200000 characters.';
  END IF;
  v_hash:=encode(extensions.digest(concat_ws(E'\n',p_slug,trim(p_version),trim(p_locale),trim(p_title),p_body_markdown),'sha256'),'hex');

  IF p_document_id IS NULL THEN
    INSERT INTO public.legal_documents(
      slug,title,version,locale,body_markdown,content_sha256,status,is_required,is_test_only,created_by,updated_by
    ) VALUES (
      p_slug,trim(p_title),trim(p_version),trim(p_locale),p_body_markdown,v_hash,'draft',COALESCE(p_is_required,false),
      COALESCE(p_is_test_only,true),auth.uid(),auth.uid()
    ) RETURNING id INTO v_id;
    v_action:='DRAFT_CREATED';
  ELSE
    UPDATE public.legal_documents
    SET slug=p_slug,title=trim(p_title),version=trim(p_version),locale=trim(p_locale),
      body_markdown=p_body_markdown,content_sha256=v_hash,is_required=COALESCE(p_is_required,false),
      is_test_only=COALESCE(p_is_test_only,true),updated_by=auth.uid(),updated_at=now()
    WHERE id=p_document_id AND status='draft'
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Only draft documents can be edited. Create a new version for a published document.'; END IF;
    v_action:='DRAFT_UPDATED';
  END IF;

  INSERT INTO private.legal_admin_audit_logs(actor_id,action,document_id,details)
  VALUES(auth.uid(),v_action,v_id,jsonb_build_object('slug',p_slug,'version',trim(p_version),'is_test_only',COALESCE(p_is_test_only,true)));
  RETURN v_id;
END;
$function$;

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
    RAISE EXCEPTION 'Confirm that the complete document has been legally reviewed and all placeholders have been replaced.';
  END IF;
  SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id AND status='draft' FOR UPDATE;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Draft legal document not found.'; END IF;
  IF length(trim(v_doc.body_markdown))<40 THEN RAISE EXCEPTION 'Document content is incomplete.'; END IF;
  IF encode(extensions.digest(concat_ws(E'\n',v_doc.slug,v_doc.version,v_doc.locale,v_doc.title,v_doc.body_markdown),'sha256'),'hex')<>v_doc.content_sha256 THEN
    RAISE EXCEPTION 'Document hash mismatch. Save the draft again before publishing.';
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

CREATE OR REPLACE FUNCTION public.platform_admin_archive_legal_document(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_doc record;
BEGIN
  PERFORM private.require_platform_admin();
  SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id AND status='published' FOR UPDATE;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Published legal document not found.'; END IF;
  IF v_doc.is_required AND NOT EXISTS (
    SELECT 1 FROM public.legal_documents d
    WHERE d.slug=v_doc.slug AND d.locale=v_doc.locale AND d.status='published' AND d.id<>v_doc.id
  ) THEN
    RAISE EXCEPTION 'Publish a replacement required document before archiving this version.';
  END IF;
  UPDATE public.legal_documents SET status='archived',updated_by=auth.uid(),updated_at=now() WHERE id=v_doc.id;
  INSERT INTO private.legal_admin_audit_logs(actor_id,action,document_id,details)
  VALUES(auth.uid(),'DOCUMENT_ARCHIVED',v_doc.id,jsonb_build_object('slug',v_doc.slug,'version',v_doc.version));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_legal_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_current_legal_documents(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_privacy_consents() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_privacy_consent(text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_institute_dpa_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_current_institute_dpa(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_list_legal_documents() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_legal_acceptance_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_save_legal_document(uuid,text,text,text,text,text,boolean,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_publish_legal_document(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_archive_legal_document(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_legal_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_current_legal_documents(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_privacy_consents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_privacy_consent(text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_institute_dpa_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_current_institute_dpa(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_list_legal_documents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_legal_acceptance_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_save_legal_document(uuid,text,text,text,text,text,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_publish_legal_document(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_archive_legal_document(uuid) TO authenticated;

COMMIT;
