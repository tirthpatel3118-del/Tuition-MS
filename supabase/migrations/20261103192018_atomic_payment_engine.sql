-- Atomic write gateways and membership administration.
-- pgcrypto is already installed in the verified project under the extensions schema.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
-- 1. Atomic Onboarding
CREATE OR REPLACE FUNCTION public.create_institute_atomic(
    p_name TEXT,
    p_slug TEXT,
    p_currency_symbol TEXT DEFAULT '₹',
    p_receipt_prefix TEXT DEFAULT 'REC'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_new_inst_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication Required: Caller must be authenticated.';
    END IF;

    INSERT INTO public.institutes (name, slug, currency_symbol, receipt_prefix)
    VALUES (p_name, p_slug, p_currency_symbol, p_receipt_prefix)
    RETURNING id INTO v_new_inst_id;

    INSERT INTO public.institute_members (institute_id, user_id, role)
    VALUES (v_new_inst_id, v_user_id, 'owner');

    INSERT INTO public.institute_receipt_counters (institute_id, year, prefix, last_number)
    VALUES (v_new_inst_id, to_char(now(), 'YYYY'), p_receipt_prefix, 0);

    INSERT INTO public.institute_settings (institute_id, key, value)
    VALUES (v_new_inst_id, 'app_settings', jsonb_build_object(
        'instituteName', p_name,
        'currencySymbol', p_currency_symbol,
        'receiptPrefix', p_receipt_prefix,
        'dateFormat', 'YYYY-MM-DD',
        'timeZone', 'Asia/Kolkata'
    ));

    RETURN v_new_inst_id;
END;
$$;

-- 2. Member Invitation with Hashed Tokens
CREATE OR REPLACE FUNCTION public.invite_institute_member(
    p_institute_id UUID,
    p_email TEXT,
    p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_invitation_id UUID;
    v_raw_token TEXT;
    v_token_hash TEXT;
BEGIN
    IF NOT private.is_member_of(p_institute_id, ARRAY['owner']) THEN
        RAISE EXCEPTION 'Access Denied: Only owners can invite members.';
    END IF;

    IF p_role NOT IN ('owner', 'accountant', 'teacher') THEN
        RAISE EXCEPTION 'Validation Failed: Invalid role %', p_role;
    END IF;

    UPDATE public.institute_invitations 
    SET status = 'Revoked' 
    WHERE institute_id = p_institute_id AND lower(email) = lower(trim(p_email)) AND status = 'Pending';

    v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

    INSERT INTO public.institute_invitations (
        institute_id, email, role, token_hash, invited_by, expires_at
    ) VALUES (
        p_institute_id, lower(trim(p_email)), p_role, v_token_hash, auth.uid(), now() + INTERVAL '7 days'
    ) RETURNING id INTO v_invitation_id;

    RETURN jsonb_build_object(
        'status', 'SUCCESS',
        'invitation_id', v_invitation_id,
        'raw_token', v_raw_token
    );
END;
$$;

-- 3. Accept Invitation (Row-Locked & Safe Against Role Mutation of Existing Members)
CREATE OR REPLACE FUNCTION public.accept_institute_invitation(
    p_raw_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token_hash TEXT;
    v_inv RECORD;
    v_user_email TEXT;
BEGIN
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'Authentication Required: Logged in account has no valid email.';
    END IF;

    v_token_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

    SELECT * INTO v_inv 
    FROM public.institute_invitations 
    WHERE token_hash = v_token_hash 
    FOR UPDATE;

    IF NOT FOUND OR v_inv.status != 'Pending' OR v_inv.expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid Invitation: Token is expired, revoked, or non-existent.';
    END IF;

    IF lower(v_inv.email) != lower(v_user_email) THEN
        RAISE EXCEPTION 'Identity Mismatch: Invitation issued to %, but logged in user is %', v_inv.email, v_user_email;
    END IF;

    IF EXISTS (SELECT 1 FROM public.institute_members WHERE institute_id = v_inv.institute_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Conflict: User is already an active member of this institute.';
    END IF;

    INSERT INTO public.institute_members (institute_id, user_id, role)
    VALUES (v_inv.institute_id, auth.uid(), v_inv.role);

    UPDATE public.institute_invitations 
    SET status = 'Accepted' 
    WHERE id = v_inv.id;

    RETURN jsonb_build_object('status', 'SUCCESS', 'institute_id', v_inv.institute_id, 'role', v_inv.role);
END;
$$;

-- 4. Role Update (Serialized via Institute Row Lock)
CREATE OR REPLACE FUNCTION public.update_member_role(
    p_institute_id UUID,
    p_target_user_id UUID,
    p_new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_role TEXT;
    v_owner_count INTEGER;
BEGIN
    IF NOT private.is_member_of(p_institute_id, ARRAY['owner']) THEN
        RAISE EXCEPTION 'Access Denied: Only owners can modify roles.';
    END IF;

    IF p_new_role NOT IN ('owner', 'accountant', 'teacher') THEN
        RAISE EXCEPTION 'Validation Failed: Invalid role %', p_new_role;
    END IF;

    PERFORM 1 FROM public.institutes WHERE id = p_institute_id FOR UPDATE;

    SELECT role INTO v_current_role 
    FROM public.institute_members 
    WHERE institute_id = p_institute_id AND user_id = p_target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Member Not Found: User is not enrolled in this institute.';
    END IF;

    IF v_current_role = 'owner' AND p_new_role != 'owner' THEN
        SELECT count(*) INTO v_owner_count 
        FROM public.institute_members 
        WHERE institute_id = p_institute_id AND role = 'owner';

        IF v_owner_count <= 1 THEN
            RAISE EXCEPTION 'Action Denied: Cannot demote the final remaining owner.';
        END IF;
    END IF;

    UPDATE public.institute_members 
    SET role = p_new_role 
    WHERE institute_id = p_institute_id AND user_id = p_target_user_id;
END;
$$;

-- 5. Safe Ownership Transfer
CREATE OR REPLACE FUNCTION public.transfer_institute_ownership(
    p_institute_id UUID,
    p_new_owner_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT private.is_member_of(p_institute_id, ARRAY['owner']) THEN
        RAISE EXCEPTION 'Access Denied: Only an owner can transfer ownership.';
    END IF;

    PERFORM 1 FROM public.institutes WHERE id = p_institute_id FOR UPDATE;

    IF NOT EXISTS (SELECT 1 FROM public.institute_members WHERE institute_id = p_institute_id AND user_id = p_new_owner_user_id) THEN
        RAISE EXCEPTION 'Target User Not Found: Target must be an existing member of the institute.';
    END IF;

    IF p_new_owner_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Validation Failed: Select another active member to receive ownership.';
    END IF;

    UPDATE public.institute_members 
    SET role = 'owner' 
    WHERE institute_id = p_institute_id AND user_id = p_new_owner_user_id;

    UPDATE public.institute_members 
    SET role = 'accountant' 
    WHERE institute_id = p_institute_id AND user_id = auth.uid();
END;
$$;

-- 6. Remove Member
CREATE OR REPLACE FUNCTION public.remove_institute_member(
    p_institute_id UUID,
    p_target_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_role TEXT;
    v_owner_count INTEGER;
BEGIN
    IF NOT private.is_member_of(p_institute_id, ARRAY['owner']) THEN
        RAISE EXCEPTION 'Access Denied: Only owners can remove staff members.';
    END IF;

    PERFORM 1 FROM public.institutes WHERE id = p_institute_id FOR UPDATE;

    SELECT role INTO v_current_role 
    FROM public.institute_members 
    WHERE institute_id = p_institute_id AND user_id = p_target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Member Not Found: User is not enrolled in this institute.';
    END IF;

    IF v_current_role = 'owner' THEN
        SELECT count(*) INTO v_owner_count 
        FROM public.institute_members 
        WHERE institute_id = p_institute_id AND role = 'owner';

        IF v_owner_count <= 1 THEN
            RAISE EXCEPTION 'Action Denied: Cannot remove the final remaining owner.';
        END IF;
    END IF;

    DELETE FROM public.institute_members 
    WHERE institute_id = p_institute_id AND user_id = p_target_user_id;
END;
$$;

-- 7. Last Owner Protection Trigger Function
CREATE OR REPLACE FUNCTION public.protect_last_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.role = 'owner' THEN
            PERFORM 1 FROM public.institutes WHERE id = OLD.institute_id FOR UPDATE;
            IF (SELECT count(*) FROM public.institute_members WHERE institute_id = OLD.institute_id AND role = 'owner') <= 1 THEN
                RAISE EXCEPTION 'Action Denied: Cannot delete the last owner of the institute.';
            END IF;
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
            PERFORM 1 FROM public.institutes WHERE id = OLD.institute_id FOR UPDATE;
            IF (SELECT count(*) FROM public.institute_members WHERE institute_id = OLD.institute_id AND role = 'owner') <= 1 THEN
                RAISE EXCEPTION 'Action Denied: Cannot demote the last owner of the institute.';
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.create_institute_atomic(TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
ALTER FUNCTION public.invite_institute_member(UUID, TEXT, TEXT) OWNER TO postgres;
ALTER FUNCTION public.accept_institute_invitation(TEXT) OWNER TO postgres;
ALTER FUNCTION public.update_member_role(UUID, UUID, TEXT) OWNER TO postgres;
ALTER FUNCTION public.transfer_institute_ownership(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION public.remove_institute_member(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION public.protect_last_owner() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_institute_atomic(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invite_institute_member(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_institute_invitation(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_member_role(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_institute_ownership(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_institute_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.protect_last_owner() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_institute_atomic(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_institute_member(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_institute_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_institute_ownership(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_institute_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_payment_atomic(
    p_institute_id UUID,
    p_student_id UUID,
    p_amount NUMERIC(10, 2),
    p_payment_mode TEXT,
    p_payment_date DATE,
    p_allocations JSONB, -- Array of [{"installment_id": "...", "amount": 2500.00}]
    p_remarks TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
    v_rows_affected INT;
    v_canonical_allocations JSONB;
BEGIN
    -- 1. Role Authorization Gate
    IF NOT private.is_member_of(p_institute_id, ARRAY['owner', 'accountant']) THEN
        RAISE EXCEPTION 'Access Denied: Caller does not possess accounting privileges for this institute.';
    END IF;

    -- 2. Input Validations
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Validation Failed: Payment amount must be non-null and strictly positive.';
    END IF;

    IF p_payment_mode NOT IN ('UPI', 'Cash', 'Card', 'Cheque', 'Net Banking') THEN
        RAISE EXCEPTION 'Validation Failed: Invalid payment mode %', p_payment_mode;
    END IF;

    IF p_payment_date IS NULL THEN
        RAISE EXCEPTION 'Validation Failed: Payment date is required.';
    END IF;

    IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Validation Failed: Idempotency key must be provided.';
    END IF;

    IF p_allocations IS NULL OR jsonb_typeof(p_allocations) != 'array' OR jsonb_array_length(p_allocations) = 0 THEN
        RAISE EXCEPTION 'Validation Failed: Allocations payload must be a non-empty array.';
    END IF;

    -- Canonicalize allocations by sorting by installment_id ascending
    SELECT jsonb_agg(elem ORDER BY elem->>'installment_id')
    INTO v_canonical_allocations
    FROM jsonb_array_elements(p_allocations) AS elem;

    -- 3. Lock Student Row and Validate Ownership & Active Status
    SELECT status INTO v_student_status 
    FROM public.students 
    WHERE id = p_student_id AND institute_id = p_institute_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Validation Failed: Student % not found in institute %', p_student_id, p_institute_id;
    END IF;

    IF v_student_status = 'Inactive' THEN
        RAISE EXCEPTION 'Validation Failed: Cannot record payment for an Inactive student.';
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

    -- 6. Validate Allocations Array Structure & Check for Duplicates
    SELECT array_agg((x->>'installment_id')::uuid) INTO v_alloc_inst_ids
    FROM jsonb_array_elements(v_canonical_allocations) AS x;

    IF (SELECT count(DISTINCT id) FROM unnest(v_alloc_inst_ids) AS id) != array_length(v_alloc_inst_ids, 1) THEN
        RAISE EXCEPTION 'Validation Failed: Duplicate installment references present in allocations payload.';
    END IF;

    -- 7. Deterministic Locking (Deadlock Prevention): Lock Installments by ID
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

    -- 8. Validate Individual Allocations Against Locked Installment Balances
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

    -- 9. Atomic Receipt Counter Allocation via (institute_id, year) Row Lock
    v_year := to_char(p_payment_date, 'YYYY');

    INSERT INTO public.institute_receipt_counters (institute_id, year, prefix, last_number)
    SELECT p_institute_id, v_year, i.receipt_prefix, 0
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

    -- 10. Insert Payment (Append-Only)
    INSERT INTO public.payments (
        institute_id, student_id, amount, payment_mode, payment_type, payment_date, remarks, 
        idempotency_key, idempotency_fingerprint, created_by
    ) VALUES (
        p_institute_id, p_student_id, p_amount, p_payment_mode, 'PAYMENT', p_payment_date, p_remarks, 
        p_idempotency_key, v_computed_fingerprint, auth.uid()
    ) RETURNING id INTO v_payment_id;

    -- 11. Insert Receipt (Append-Only)
    INSERT INTO public.receipts (
        institute_id, payment_id, receipt_number, receipt_type, generated_at
    ) VALUES (
        p_institute_id, v_payment_id, v_receipt_number, 'RECEIPT', timezone('utc'::text, now())
    ) RETURNING id INTO v_receipt_id;

    -- 12. Insert Allocations and Update Installment Statuses
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

    -- 13. Write Immutable Audit Log
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
        'payment_id', v_payment_id,
        'receipt_id', v_receipt_id,
        'receipt_number', v_receipt_number
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.void_payment_atomic(
    p_institute_id UUID,
    p_original_payment_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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

    IF v_orig_pay.payment_type = 'REVERSAL' THEN
        RAISE EXCEPTION 'Invalid Operation: Cannot reverse an existing reversal entry.';
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
    SELECT p_institute_id, v_year, i.receipt_prefix, 0
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
$$;

ALTER FUNCTION public.record_payment_atomic(UUID, UUID, NUMERIC, TEXT, DATE, JSONB, TEXT, TEXT) OWNER TO postgres;
ALTER FUNCTION public.void_payment_atomic(UUID, UUID, TEXT) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.record_payment_atomic(UUID, UUID, NUMERIC, TEXT, DATE, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_payment_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_payment_atomic(UUID, UUID, NUMERIC, TEXT, DATE, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_payment_atomic(UUID, UUID, TEXT) TO authenticated;
-- Protect the invariant even if a caller has table privileges outside the RPC layer.
DROP TRIGGER IF EXISTS trg_protect_last_owner ON public.institute_members;
CREATE TRIGGER trg_protect_last_owner
BEFORE UPDATE OF role OR DELETE ON public.institute_members
FOR EACH ROW EXECUTE FUNCTION public.protect_last_owner();

INSERT INTO public.schema_migrations (version, description)
VALUES ('20261104000006', 'Deploy atomic payment, reversal, and membership RPC engines')
ON CONFLICT (version) DO NOTHING;


