-- Payment reliability hardening:
-- 1) Resolve an existing idempotent payment before checking mutable student state.
-- 2) Permit reversal only of original PAYMENT ledger entries.
BEGIN;

CREATE OR REPLACE FUNCTION public.record_payment_atomic(p_institute_id uuid, p_student_id uuid, p_amount numeric, p_payment_mode text, p_payment_date date, p_allocations jsonb DEFAULT '[]'::jsonb, p_remarks text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_payment_id UUID;
    v_receipt_id UUID;
    v_receipt_number TEXT;
    v_prefix TEXT;
    v_year TEXT;
    v_seq_num BIGINT;
    v_alloc RECORD;
    v_total_allocated NUMERIC(10, 2) := 0.00;
    v_inst_balance NUMERIC(10, 2);
    v_inst_total_paid NUMERIC(10, 2);
    v_inst_scheduled NUMERIC(10, 2);
    v_inst_due_date DATE;
    v_target_inst_status TEXT;
    v_alloc_inst_ids UUID[];
    v_computed_fingerprint TEXT;
    v_existing_fingerprint TEXT;
    v_student_status TEXT;
    v_course_fee NUMERIC(10, 2);
    v_total_paid_so_far NUMERIC(10, 2);
    v_current_due NUMERIC(10, 2);
    v_rows_affected INT;
    v_canonical_allocations JSONB;
BEGIN
    -- 1. Role Authorization Gate
    PERFORM 1 FROM public.institutes WHERE id = p_institute_id FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Institute Not Found.';
    END IF;
    IF NOT private.is_member_of(p_institute_id, ARRAY['owner', 'accountant']) THEN
        RAISE EXCEPTION 'Access Denied: Caller does not possess accounting privileges for this institute.';
    END IF;

    -- 2. Input Validations
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Validation Failed: Payment amount must be non-null and strictly positive.';
    END IF;

    IF p_payment_mode IS NULL OR p_payment_mode NOT IN ('UPI', 'Cash', 'Card', 'Cheque', 'Net Banking') THEN
        RAISE EXCEPTION 'Validation Failed: Invalid payment mode %', p_payment_mode;
    END IF;

    IF p_payment_date IS NULL THEN
        RAISE EXCEPTION 'Validation Failed: Payment date is required.';
    END IF;

    IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Validation Failed: Idempotency key must be provided.';
    END IF;

    IF p_allocations IS NOT NULL AND jsonb_typeof(p_allocations) != 'array' THEN
        RAISE EXCEPTION 'Validation Failed: Allocations payload must be an array.';
    END IF;

    -- Canonicalize allocations by sorting by installment_id ascending (if non-empty)
    IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
        SELECT jsonb_agg(elem ORDER BY elem->>'installment_id')
        INTO v_canonical_allocations
        FROM jsonb_array_elements(p_allocations) AS elem;
    ELSE
        v_canonical_allocations := '[]'::jsonb;
    END IF;

    -- 3. Lock Student Row and Validate Ownership & Active Status
    SELECT status, course_fee INTO v_student_status, v_course_fee 
    FROM public.students 
    WHERE id = p_student_id AND institute_id = p_institute_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Validation Failed: Student % not found in institute %', p_student_id, p_institute_id;
    END IF;

    -- 4. Compute Request Fingerprint for Idempotency Collision Detection
    v_computed_fingerprint := encode(extensions.digest(
        p_student_id::text || '|' || 
        p_amount::text || '|' || 
        p_payment_mode || '|' || 
        p_payment_date::text || '|' || 
        COALESCE(p_remarks, '') || '|' ||
        v_canonical_allocations::text, 
        'sha256'
    ), 'hex');

    -- 5. Transaction-Level Advisory Lock for Concurrency-Safe Idempotency
    PERFORM pg_advisory_xact_lock(hashtext(p_institute_id::TEXT || ':' || p_idempotency_key));

    -- Look up existing payment by institute and idempotency key
    SELECT p.id, r.receipt_number, p.idempotency_fingerprint 
    INTO v_payment_id, v_receipt_number, v_existing_fingerprint
    FROM public.payments p
    JOIN public.receipts r ON r.payment_id = p.id
    WHERE p.institute_id = p_institute_id 
      AND p.idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF v_existing_fingerprint IS DISTINCT FROM v_computed_fingerprint THEN
            RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % reused with mismatched payment payload.', p_idempotency_key;
        END IF;

        RETURN jsonb_build_object(
            'status', 'EXISTING',
            'message', 'Transaction previously processed.',
            'payment_id', v_payment_id,
            'receipt_number', v_receipt_number
        );
    END IF;

    -- Only a genuinely new payment is subject to current student status and fee
    -- checks. A retry of a payment already committed must return its original
    -- receipt even if the student was later deactivated or their fee was edited.
    IF v_student_status = 'Inactive' THEN
        RAISE EXCEPTION 'Validation Failed: Cannot record payment for an Inactive student.';
    END IF;

    IF v_course_fee IS NULL OR v_course_fee <= 0 THEN
        RAISE EXCEPTION 'Validation Failed: Student has no valid course fee assigned.';
    END IF;

    -- 6. For a genuinely new payment: Calculate Outstanding Balance and Enforce Overpayment Limit
    -- Financial Integrity: Enforce that total payments do not exceed the student course fee.
    -- Exclude payments that have been reversed via payment_reversals.
    SELECT COALESCE(SUM(p.amount), 0.00) INTO v_total_paid_so_far
    FROM public.payments p
    WHERE p.institute_id = p_institute_id
      AND p.student_id = p_student_id
      AND p.payment_type = 'PAYMENT'
      AND NOT EXISTS (
          SELECT 1 FROM public.payment_reversals pr
          WHERE pr.institute_id = p.institute_id
            AND pr.original_payment_id = p.id
      );

    v_current_due := v_course_fee - v_total_paid_so_far;
    IF p_amount > v_current_due THEN
        RAISE EXCEPTION 'Overpayment: Payment of % exceeds remaining student balance of %', p_amount, v_current_due;
    END IF;

    -- 7. Validate Allocations Array Structure & Check for Duplicates (If Allocations Provided)
    IF v_canonical_allocations IS NOT NULL AND jsonb_array_length(v_canonical_allocations) > 0 THEN
        SELECT array_agg((x->>'installment_id')::uuid) INTO v_alloc_inst_ids
        FROM jsonb_array_elements(v_canonical_allocations) AS x;

        IF (SELECT count(DISTINCT id) FROM unnest(v_alloc_inst_ids) AS id) != array_length(v_alloc_inst_ids, 1) THEN
            RAISE EXCEPTION 'Validation Failed: Duplicate installment references present in allocations payload.';
        END IF;

        -- Deterministic Locking (Deadlock Prevention): Lock Installments by ID
        PERFORM 1 
        FROM public.installments 
        WHERE id = ANY(v_alloc_inst_ids) 
          AND student_id = p_student_id 
          AND institute_id = p_institute_id
        ORDER BY id ASC
        FOR UPDATE;

        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
        IF v_rows_affected != array_length(v_alloc_inst_ids, 1) THEN
            RAISE EXCEPTION 'Validation Failed: One or more requested installments do not exist or belong to another student.';
        END IF;

        -- Validate Individual Allocations Against Locked Installment Balances
        FOR v_alloc IN SELECT * FROM jsonb_to_recordset(v_canonical_allocations) AS x(installment_id UUID, amount NUMERIC) LOOP
            IF v_alloc.amount IS NULL OR v_alloc.amount <= 0 THEN
                RAISE EXCEPTION 'Validation Failed: Allocation amount must be non-null and strictly positive.';
            END IF;
            v_total_allocated := v_total_allocated + v_alloc.amount;

            SELECT amount, due_date INTO v_inst_scheduled, v_inst_due_date
            FROM public.installments 
            WHERE id = v_alloc.installment_id 
              AND student_id = p_student_id 
              AND institute_id = p_institute_id;

            SELECT COALESCE(SUM(allocated_amount), 0) INTO v_inst_total_paid
            FROM public.payment_allocations
            WHERE installment_id = v_alloc.installment_id;

            v_inst_balance := v_inst_scheduled - v_inst_total_paid;
            IF v_alloc.amount > v_inst_balance THEN
                RAISE EXCEPTION 'Overpayment: Allocation of % exceeds remaining balance of %', v_alloc.amount, v_inst_balance;
            END IF;
        END LOOP;

        IF v_total_allocated != p_amount THEN
            RAISE EXCEPTION 'Validation Failed: Sum of allocations (%) does not match payment amount (%).', v_total_allocated, p_amount;
        END IF;
    END IF;

    -- 8. Atomic Receipt Counter Allocation via (institute_id, year) Row Lock
    v_year := to_char(p_payment_date, 'YYYY');

    INSERT INTO public.institute_receipt_counters (institute_id, year, prefix, last_number)
    SELECT p_institute_id, v_year, i.receipt_prefix,
           COALESCE((
               SELECT MAX(substring(r.receipt_number FROM '[0-9]+$')::BIGINT)
               FROM public.receipts AS r
               WHERE r.institute_id = p_institute_id
                 AND (r.receipt_number LIKE i.receipt_prefix || '-' || v_year || '-%'
                      OR (r.receipt_type = 'CREDIT_NOTE' AND r.receipt_number LIKE 'CN-' || v_year || '-%'))
           ), 0)
    FROM public.institutes AS i
    WHERE i.id = p_institute_id
    ON CONFLICT (institute_id, year) DO NOTHING;

    SELECT prefix, last_number INTO v_prefix, v_seq_num
    FROM public.institute_receipt_counters
    WHERE institute_id = p_institute_id AND year = v_year
    FOR UPDATE;

    v_seq_num := v_seq_num + 1;
    v_receipt_number := v_prefix || '-' || v_year || '-' || lpad(v_seq_num::TEXT, 4, '0');

    UPDATE public.institute_receipt_counters
    SET last_number = v_seq_num,
        updated_at = timezone('utc'::text, now())
    WHERE institute_id = p_institute_id AND year = v_year;

    -- 9. Insert Payment (Append-Only)
    INSERT INTO public.payments (
        institute_id, student_id, amount, payment_mode, payment_type, payment_date, remarks, 
        idempotency_key, idempotency_fingerprint, created_by
    ) VALUES (
        p_institute_id, p_student_id, p_amount, p_payment_mode, 'PAYMENT', p_payment_date, p_remarks, 
        p_idempotency_key, v_computed_fingerprint, auth.uid()
    ) RETURNING id INTO v_payment_id;

    -- 10. Insert Receipt (Append-Only)
    INSERT INTO public.receipts (
        institute_id, payment_id, receipt_number, receipt_type, generated_at
    ) VALUES (
        p_institute_id, v_payment_id, v_receipt_number, 'RECEIPT', timezone('utc'::text, now())
    ) RETURNING id INTO v_receipt_id;

    -- 11. Insert Allocations and Update Installment Statuses (If Allocations Provided)
    IF v_canonical_allocations IS NOT NULL AND jsonb_array_length(v_canonical_allocations) > 0 THEN
        FOR v_alloc IN SELECT * FROM jsonb_to_recordset(v_canonical_allocations) AS x(installment_id UUID, amount NUMERIC) LOOP
            INSERT INTO public.payment_allocations (
                institute_id, payment_id, installment_id, allocated_amount, allocation_type
            ) VALUES (
                p_institute_id, v_payment_id, v_alloc.installment_id, v_alloc.amount, 'CREDIT'
            );

            SELECT 
                i.amount, 
                i.due_date,
                COALESCE(SUM(pa.allocated_amount), 0)
            INTO v_inst_scheduled, v_inst_due_date, v_inst_total_paid
            FROM public.installments i
            LEFT JOIN public.payment_allocations pa ON pa.installment_id = i.id
            WHERE i.id = v_alloc.installment_id
            GROUP BY i.amount, i.due_date;

            v_target_inst_status := public.calculate_installment_status(
                v_inst_scheduled, v_inst_total_paid, v_inst_due_date
            );

            UPDATE public.installments 
            SET status = v_target_inst_status
            WHERE id = v_alloc.installment_id;

            GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
            IF v_rows_affected != 1 THEN
                RAISE EXCEPTION 'Transaction Failure: Failed to update status on installment %', v_alloc.installment_id;
            END IF;
        END LOOP;
    END IF;

    -- 12. Write Immutable Audit Log
    INSERT INTO public.financial_audit_logs (
        institute_id, actor_id, action, entity_name, entity_id, payload
    ) VALUES (
        p_institute_id, auth.uid(), 'RECORD_PAYMENT', 'payments', v_payment_id,
        jsonb_build_object(
            'amount', p_amount,
            'receipt_number', v_receipt_number,
            'allocations', v_canonical_allocations
        )
    );

    RETURN jsonb_build_object(
        'status', 'SUCCESS',
        'message', 'Payment recorded successfully.',
        'payment_id', v_payment_id,
        'receipt_number', v_receipt_number
    );
END;
$function$;

ALTER FUNCTION public.record_payment_atomic(UUID, UUID, NUMERIC, TEXT, DATE, JSONB, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_payment_atomic(UUID, UUID, NUMERIC, TEXT, DATE, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment_atomic(UUID, UUID, NUMERIC, TEXT, DATE, JSONB, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.void_payment_atomic(p_institute_id uuid, p_original_payment_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_orig_pay RECORD;
    v_reversal_pay_id UUID;
    v_credit_note_id UUID;
    v_credit_note_num TEXT;
    v_prefix TEXT;
    v_year TEXT;
    v_seq_num BIGINT;
    v_alloc RECORD;
    v_inst_scheduled NUMERIC(10, 2);
    v_inst_due_date DATE;
    v_inst_total_paid NUMERIC(10, 2);
    v_target_inst_status TEXT;
BEGIN
    -- 1. Authorization: Only owners can authorize financial reversals
    PERFORM 1 FROM public.institutes WHERE id = p_institute_id FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Institute Not Found.';
    END IF;
    IF NOT private.is_member_of(p_institute_id, ARRAY['owner']) THEN
        RAISE EXCEPTION 'Access Denied: Only institute owners can reverse payments.';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Validation Failed: A detailed reversal reason (at least 5 characters) is required.';
    END IF;

    -- 2. Lock original payment and verify eligibility
    SELECT * INTO v_orig_pay 
    FROM public.payments 
    WHERE id = p_original_payment_id AND institute_id = p_institute_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment Not Found: Original payment does not exist in this institute.';
    END IF;

    IF v_orig_pay.payment_type IS DISTINCT FROM 'PAYMENT' THEN
        RAISE EXCEPTION 'Invalid Operation: Only original PAYMENT ledger entries can be reversed.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.payment_reversals WHERE original_payment_id = p_original_payment_id) THEN
        RAISE EXCEPTION 'Conflict: This payment has already been reversed.';
    END IF;

    -- Use the same student-then-installment lock order as payment recording so a
    -- concurrent payment cannot observe balances while this reversal is posted.
    PERFORM 1
    FROM public.students AS s
    WHERE s.id = v_orig_pay.student_id AND s.institute_id = p_institute_id
    FOR UPDATE;

    PERFORM 1
    FROM public.installments AS i
    JOIN public.payment_allocations AS pa ON pa.installment_id = i.id
    WHERE pa.payment_id = p_original_payment_id
      AND pa.institute_id = p_institute_id
      AND i.institute_id = p_institute_id
    ORDER BY i.id ASC
    FOR UPDATE OF i;

    -- 3. Lock Counter & Generate Credit Note Number
    v_year := to_char(now(), 'YYYY');

    INSERT INTO public.institute_receipt_counters (institute_id, year, prefix, last_number)
    SELECT p_institute_id, v_year, i.receipt_prefix,
           COALESCE((
               SELECT MAX(substring(r.receipt_number FROM '[0-9]+$')::BIGINT)
               FROM public.receipts AS r
               WHERE r.institute_id = p_institute_id
                 AND (r.receipt_number LIKE i.receipt_prefix || '-' || v_year || '-%'
                      OR (r.receipt_type = 'CREDIT_NOTE' AND r.receipt_number LIKE 'CN-' || v_year || '-%'))
           ), 0)
    FROM public.institutes AS i
    WHERE i.id = p_institute_id
    ON CONFLICT (institute_id, year) DO NOTHING;

    SELECT prefix, last_number INTO v_prefix, v_seq_num
    FROM public.institute_receipt_counters
    WHERE institute_id = p_institute_id AND year = v_year
    FOR UPDATE;

    v_seq_num := v_seq_num + 1;
    v_credit_note_num := 'CN-' || v_year || '-' || lpad(v_seq_num::TEXT, 4, '0');

    UPDATE public.institute_receipt_counters
    SET last_number = v_seq_num,
        updated_at = timezone('utc'::text, now())
    WHERE institute_id = p_institute_id AND year = v_year;

    -- 4. Insert Offsetting Reversal Payment (Negative Ledger Entry)
    INSERT INTO public.payments (
        institute_id, student_id, amount, payment_mode, payment_type, payment_date, 
        remarks, created_by
    ) VALUES (
        p_institute_id, v_orig_pay.student_id, -v_orig_pay.amount, 'Adjustment', 'REVERSAL', 
        CURRENT_DATE, 'Reversal of Payment ' || v_orig_pay.id || '. Reason: ' || p_reason, auth.uid()
    ) RETURNING id INTO v_reversal_pay_id;

    -- 5. Insert Credit Note in Receipts Table
    INSERT INTO public.receipts (
        institute_id, payment_id, receipt_number, receipt_type, generated_at
    ) VALUES (
        p_institute_id, v_reversal_pay_id, v_credit_note_num, 'CREDIT_NOTE', timezone('utc'::text, now())
    ) RETURNING id INTO v_credit_note_id;

    -- 6. Insert Offsetting Allocations & Restore Installment Statuses
    FOR v_alloc IN 
        SELECT * FROM public.payment_allocations 
        WHERE payment_id = p_original_payment_id AND allocation_type = 'CREDIT'
    LOOP
        INSERT INTO public.payment_allocations (
            institute_id, payment_id, installment_id, allocated_amount, allocation_type, reversal_of_id
        ) VALUES (
            p_institute_id, v_reversal_pay_id, v_alloc.installment_id, -v_alloc.allocated_amount, 'REVERSAL', v_alloc.id
        );

        SELECT 
            i.amount, 
            i.due_date,
            COALESCE(SUM(pa.allocated_amount), 0)
        INTO v_inst_scheduled, v_inst_due_date, v_inst_total_paid
        FROM public.installments i
        LEFT JOIN public.payment_allocations pa ON pa.installment_id = i.id
        WHERE i.id = v_alloc.installment_id
        GROUP BY i.amount, i.due_date;

        v_target_inst_status := public.calculate_installment_status(
            v_inst_scheduled, v_inst_total_paid, v_inst_due_date
        );

        UPDATE public.installments 
        SET status = v_target_inst_status 
        WHERE id = v_alloc.installment_id;
    END LOOP;

    -- 7. Record in payment_reversals Ledger
    INSERT INTO public.payment_reversals (
        institute_id, original_payment_id, reversal_payment_id, reason, reverted_by
    ) VALUES (
        p_institute_id, p_original_payment_id, v_reversal_pay_id, p_reason, auth.uid()
    );

    -- 8. Write Audit Log
    INSERT INTO public.financial_audit_logs (
        institute_id, actor_id, action, entity_name, entity_id, payload
    ) VALUES (
        p_institute_id, auth.uid(), 'VOID_PAYMENT', 'payments', p_original_payment_id,
        jsonb_build_object(
            'original_payment_id', p_original_payment_id,
            'reversal_payment_id', v_reversal_pay_id,
            'credit_note_number', v_credit_note_num,
            'reason', p_reason
        )
    );

    RETURN jsonb_build_object(
        'status', 'SUCCESS',
        'reversal_payment_id', v_reversal_pay_id,
        'credit_note_number', v_credit_note_num
    );
END;
$function$;

ALTER FUNCTION public.void_payment_atomic(UUID, UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.void_payment_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_payment_atomic(UUID, UUID, TEXT) TO authenticated;

COMMIT;
