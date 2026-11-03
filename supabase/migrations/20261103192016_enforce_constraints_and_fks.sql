DO $$
BEGIN
    -- 1. Pre-Validation Checks
    IF EXISTS (SELECT 1 FROM public.courses WHERE institute_id IS NULL) OR
       EXISTS (SELECT 1 FROM public.students WHERE institute_id IS NULL) OR
       EXISTS (SELECT 1 FROM public.payments WHERE institute_id IS NULL) OR
       EXISTS (SELECT 1 FROM public.receipts WHERE institute_id IS NULL) OR
       EXISTS (SELECT 1 FROM public.installments WHERE institute_id IS NULL) THEN
        RAISE EXCEPTION 'Precondition Failed: Records with NULL institute_id detected.';
    END IF;

    -- Check for duplicate roll numbers within tenant
    IF EXISTS (
        SELECT institute_id, roll_number FROM public.students 
        GROUP BY institute_id, roll_number HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Precondition Failed: Duplicate roll numbers detected within tenant.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.students WHERE discount > course_fee) THEN
        RAISE EXCEPTION 'Precondition Failed: Student discount exceeds course fee.';
    END IF;

    -- Check for duplicate receipt numbers within tenant
    IF EXISTS (
        SELECT institute_id, receipt_number FROM public.receipts 
        GROUP BY institute_id, receipt_number HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Precondition Failed: Duplicate receipt numbers detected within tenant.';
    END IF;

    -- 2. Enforce NOT NULL on institute_id
    ALTER TABLE public.courses ALTER COLUMN institute_id SET NOT NULL;
    ALTER TABLE public.students ALTER COLUMN institute_id SET NOT NULL;
    ALTER TABLE public.payments ALTER COLUMN institute_id SET NOT NULL;
    ALTER TABLE public.receipts ALTER COLUMN institute_id SET NOT NULL;
    ALTER TABLE public.installments ALTER COLUMN institute_id SET NOT NULL;

    -- 3. Composite Unique Constraints (Prerequisites for Composite FKs)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_courses_tenant') THEN
        ALTER TABLE public.courses ADD CONSTRAINT uq_courses_tenant UNIQUE (institute_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_batches_tenant') THEN
        ALTER TABLE public.batches ADD CONSTRAINT uq_batches_tenant UNIQUE (institute_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_students_tenant') THEN
        ALTER TABLE public.students ADD CONSTRAINT uq_students_tenant UNIQUE (institute_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_payments_tenant') THEN
        ALTER TABLE public.payments ADD CONSTRAINT uq_payments_tenant UNIQUE (institute_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_installments_tenant') THEN
        ALTER TABLE public.installments ADD CONSTRAINT uq_installments_tenant UNIQUE (institute_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_students_roll_tenant') THEN
        ALTER TABLE public.students ADD CONSTRAINT uq_students_roll_tenant UNIQUE (institute_id, roll_number);
    END IF;

    -- Replace legacy global uniqueness with tenant-scoped uniqueness.
    ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_roll_number_key;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_receipts_number') THEN
        ALTER TABLE public.receipts ADD CONSTRAINT uq_receipts_number UNIQUE (institute_id, receipt_number);
    END IF;

    ALTER TABLE public.receipts DROP CONSTRAINT IF EXISTS receipts_receipt_number_key;

    -- 4. Drop Insecure Single-Column FKs
    ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_course_id_fkey;
    ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey;
    ALTER TABLE public.receipts DROP CONSTRAINT IF EXISTS receipts_payment_id_fkey;
    ALTER TABLE public.installments DROP CONSTRAINT IF EXISTS installments_student_id_fkey;
    ALTER TABLE public.installments DROP CONSTRAINT IF EXISTS installments_payment_id_fkey;

    -- 5. Add Tenant-Aware Composite Foreign Keys
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_batches_course') THEN
        ALTER TABLE public.batches ADD CONSTRAINT fk_batches_course 
            FOREIGN KEY (institute_id, course_id) REFERENCES public.courses(institute_id, id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_students_course') THEN
        ALTER TABLE public.students ADD CONSTRAINT fk_students_course 
            FOREIGN KEY (institute_id, course_id) REFERENCES public.courses(institute_id, id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_students_batch') THEN
        ALTER TABLE public.students ADD CONSTRAINT fk_students_batch 
            FOREIGN KEY (institute_id, batch_id) REFERENCES public.batches(institute_id, id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_student') THEN
        ALTER TABLE public.payments ADD CONSTRAINT fk_payments_student 
            FOREIGN KEY (institute_id, student_id) REFERENCES public.students(institute_id, id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_receipts_payment') THEN
        ALTER TABLE public.receipts ADD CONSTRAINT fk_receipts_payment 
            FOREIGN KEY (institute_id, payment_id) REFERENCES public.payments(institute_id, id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_installments_student') THEN
        ALTER TABLE public.installments ADD CONSTRAINT fk_installments_student 
            FOREIGN KEY (institute_id, student_id) REFERENCES public.students(institute_id, id) ON DELETE RESTRICT;
    END IF;

    -- 6. Generated net_fee column and check constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'net_fee') THEN
        ALTER TABLE public.students ADD COLUMN net_fee NUMERIC(10, 2) GENERATED ALWAYS AS (course_fee - discount) STORED;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_discount_not_exceed_fee') THEN
        ALTER TABLE public.students ADD CONSTRAINT chk_discount_not_exceed_fee CHECK (discount <= course_fee);
    END IF;
END $$;

INSERT INTO public.schema_migrations (version, description)
VALUES ('20261104000004', 'Enforce composite tenant unique constraints and foreign keys')
ON CONFLICT (version) DO NOTHING;

