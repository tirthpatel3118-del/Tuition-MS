CREATE OR REPLACE FUNCTION public.website_verify_gateway_secret(p_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p_hash IS NOT NULL
     AND p_hash ~ '^[a-f0-9]{64}$'
     AND EXISTS (
       SELECT 1 FROM private.website_intake_config
       WHERE singleton = true AND gateway_secret_hash = p_hash
     );
$function$;
REVOKE ALL ON FUNCTION public.website_verify_gateway_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_verify_gateway_secret(text) TO service_role;
