-- Correct SHA-256 hashes for the four v0.4/v0.10 development-only policy drafts.
-- The hash separator is an actual newline, matching platform_admin_save_legal_document.

UPDATE public.legal_documents
SET content_sha256 = encode(
      extensions.digest(concat_ws(chr(10), slug, version, locale, title, body_markdown), 'sha256'),
      'hex'
    ),
    updated_at = now()
WHERE locale = 'en-IN'
  AND is_test_only = true
  AND status = 'published'
  AND version IN ('0.4-dev', '0.10-dev');
