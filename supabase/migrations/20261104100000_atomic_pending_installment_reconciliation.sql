-- Reconcile one student's pending schedule as a single transaction.
-- The student row lock serializes this work with record_payment_atomic.

CREATE OR REPLACE FUNCTION public.reconcile_pending_installments_atomic(
    p_institute_id UUID,
    p_student_id UUID,
    p_desired_installments JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT private.is_member_of(p_institute_id, ARRAY['owner', 'accountant']) THEN
        RAISE EXCEPTION 'Access Denied: Accounting privileges are required to change installment schedules.';
    END IF;

    IF p_desired_installments IS NULL OR jsonb_typeof(p_desired_installments) <> 'array' THEN
        RAISE EXCEPTION 'Validation Failed: Desired installments must be a JSON array.';
    END IF;

    -- Serialize schedule edits with payment posting, which locks this same student row.
    PERFORM 1
    FROM public.students
    WHERE id = p_student_id AND institute_id = p_institute_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found in this institute.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_desired_installments) AS x(
            installment_number INTEGER,
            due_date DATE,
            amount NUMERIC,
            remarks TEXT
        )
        WHERE installment_number IS NULL
           OR installment_number < 1
           OR due_date IS NULL
           OR amount IS NULL
           OR amount <= 0
    ) THEN
        RAISE EXCEPTION 'Validation Failed: Each installment needs a positive number, due date, and amount.';
    END IF;

    IF EXISTS (
        SELECT installment_number
        FROM jsonb_to_recordset(p_desired_installments) AS x(installment_number INTEGER)
        GROUP BY installment_number
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Validation Failed: Installment numbers must be unique.';
    END IF;

    -- Preserve non-pending financial history and reject a conflicting requested number.
    IF EXISTS (
        SELECT 1
        FROM public.installments AS i
        JOIN jsonb_to_recordset(p_desired_installments) AS x(installment_number INTEGER)
          ON x.installment_number = i.installment_number
        WHERE i.institute_id = p_institute_id
          AND i.student_id = p_student_id
          AND i.status <> 'Pending'
    ) THEN
        RAISE EXCEPTION 'Validation Failed: A requested installment number belongs to a protected non-pending record.';
    END IF;

    PERFORM 1
    FROM public.installments
    WHERE institute_id = p_institute_id
      AND student_id = p_student_id
      AND status = 'Pending'
    ORDER BY installment_number, id
    FOR UPDATE;

    DELETE FROM public.installments AS i
    WHERE i.institute_id = p_institute_id
      AND i.student_id = p_student_id
      AND i.status = 'Pending'
      AND NOT EXISTS (
          SELECT 1
          FROM jsonb_to_recordset(p_desired_installments) AS x(installment_number INTEGER)
          WHERE x.installment_number = i.installment_number
      );

    UPDATE public.installments AS i
    SET due_date = x.due_date,
        amount = x.amount,
        remarks = x.remarks
    FROM jsonb_to_recordset(p_desired_installments) AS x(
        installment_number INTEGER,
        due_date DATE,
        amount NUMERIC,
        remarks TEXT
    )
    WHERE i.institute_id = p_institute_id
      AND i.student_id = p_student_id
      AND i.status = 'Pending'
      AND i.installment_number = x.installment_number;

    INSERT INTO public.installments (
        institute_id,
        student_id,
        installment_number,
        due_date,
        amount,
        status,
        payment_id,
        remarks
    )
    SELECT
        p_institute_id,
        p_student_id,
        x.installment_number,
        x.due_date,
        x.amount,
        'Pending',
        NULL,
        x.remarks
    FROM jsonb_to_recordset(p_desired_installments) AS x(
        installment_number INTEGER,
        due_date DATE,
        amount NUMERIC,
        remarks TEXT
    )
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.installments AS i
        WHERE i.institute_id = p_institute_id
          AND i.student_id = p_student_id
          AND i.installment_number = x.installment_number
    );
END;
$$;

ALTER FUNCTION public.reconcile_pending_installments_atomic(UUID, UUID, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reconcile_pending_installments_atomic(UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_pending_installments_atomic(UUID, UUID, JSONB) TO authenticated;

INSERT INTO public.schema_migrations (version, description)
VALUES ('20261104000008', 'Add atomic pending installment schedule reconciliation')
ON CONFLICT (version) DO NOTHING;
