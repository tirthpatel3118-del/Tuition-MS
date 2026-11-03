-- Track Migration Version
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safe UUID & Numeric Casting Functions
CREATE OR REPLACE FUNCTION public.try_cast_uuid(p_val TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_val::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.try_cast_numeric(p_val TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_val::numeric;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

-- Institutes Table
CREATE TABLE IF NOT EXISTS public.institutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
    currency_symbol TEXT NOT NULL DEFAULT '₹',
    receipt_prefix TEXT NOT NULL DEFAULT 'REC' CHECK (receipt_prefix ~ '^[A-Z0-9]+$'),
    receipt_footer TEXT DEFAULT 'This is a computer-generated receipt.',
    whatsapp_template TEXT,
    logo_url TEXT,
    authorized_signature_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_institutes_tenant UNIQUE (id)
);

-- Institute Members Table
CREATE TABLE IF NOT EXISTS public.institute_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'accountant', 'teacher')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_institute_members_membership UNIQUE (institute_id, user_id)
);

-- Define the role checker before any privileged RPC bodies reference it.
CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION private.is_member_of(
    _institute_id UUID,
    _required_roles TEXT[] DEFAULT ARRAY['owner', 'accountant', 'teacher']
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.institute_members m
        WHERE m.institute_id = _institute_id
          AND m.user_id = auth.uid()
          AND m.role = ANY(_required_roles)
    );
$$;
ALTER FUNCTION private.is_member_of(UUID, TEXT[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.is_member_of(UUID, TEXT[]) FROM PUBLIC, anon, authenticated;

-- Seed Default Development Institute
INSERT INTO public.institutes (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'EduLedger Academy (Dev)', 'dev-institute')
ON CONFLICT (id) DO NOTHING;

-- Migration Support Tables
CREATE TABLE IF NOT EXISTS public._migration_batch_id_map (
    old_id TEXT PRIMARY KEY,
    new_uuid UUID NOT NULL,
    batch_name TEXT,
    course_id UUID,
    migration_status TEXT NOT NULL DEFAULT 'SUCCESS',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public._migration_anomalies (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_identifier TEXT NOT NULL,
    issue_code TEXT NOT NULL,
    issue_description TEXT NOT NULL,
    raw_payload JSONB,
    recorded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_migration_anomaly UNIQUE (entity_type, entity_identifier, issue_code)
);

INSERT INTO public.schema_migrations (version, description)
VALUES ('20261104000001', 'Foundation, multi-tenant core and migration support tables')
ON CONFLICT (version) DO NOTHING;

