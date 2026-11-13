-- Batches Table
CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE RESTRICT,
    course_id UUID NOT NULL,
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1),
    timing TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0) DEFAULT 30,
    course_fee NUMERIC(10, 2) CHECK (course_fee IS NULL OR course_fee >= 0),
    status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive')) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_batches_tenant UNIQUE (institute_id, id)
);

-- Reminders Table
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL,
    amount_due NUMERIC(10, 2) NOT NULL CHECK (amount_due >= 0),
    channel TEXT NOT NULL CHECK (channel IN ('WhatsApp', 'SMS', 'Email')),
    status TEXT NOT NULL CHECK (status IN ('queued', 'attempted', 'manual_opened', 'sent', 'delivered', 'failed')),
    provider_reference TEXT,
    attempted_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_reminders_tenant UNIQUE (institute_id, id)
);

-- Multi-Year Receipt Counter Table
CREATE TABLE IF NOT EXISTS public.institute_receipt_counters (
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE RESTRICT,
    year TEXT NOT NULL CHECK (year ~ '^[0-9]{4}$'),
    prefix TEXT NOT NULL DEFAULT 'REC',
    last_number BIGINT NOT NULL DEFAULT 0 CHECK (last_number >= 0),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (institute_id, year)
);

-- Institute Settings Table
CREATE TABLE IF NOT EXISTS public.institute_settings (
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE RESTRICT,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (institute_id, key)
);

-- Invitations Table
CREATE TABLE IF NOT EXISTS public.institute_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE RESTRICT,
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    role TEXT NOT NULL CHECK (role IN ('owner', 'accountant', 'teacher')),
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Accepted', 'Revoked', 'Expired')) DEFAULT 'Pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_invitation ON public.institute_invitations (institute_id, lower(email)) 
WHERE status = 'Pending';

-- Add Nullable Tenant & New Columns to Existing Tables
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS institute_id UUID REFERENCES public.institutes(id) ON DELETE RESTRICT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS course_fee NUMERIC(10, 2);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS institute_id UUID REFERENCES public.institutes(id) ON DELETE RESTRICT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS batch_id UUID;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS institute_id UUID REFERENCES public.institutes(id) ON DELETE RESTRICT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'PAYMENT';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS idempotency_fingerprint TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS institute_id UUID REFERENCES public.institutes(id) ON DELETE RESTRICT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS receipt_type TEXT NOT NULL DEFAULT 'RECEIPT';

ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS institute_id UUID REFERENCES public.institutes(id) ON DELETE RESTRICT;
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS legacy_payment_id UUID;

INSERT INTO public.schema_migrations (version, description)
VALUES ('20261104000002', 'Create normalized entities and add nullable tenant columns')
ON CONFLICT (version) DO NOTHING;

