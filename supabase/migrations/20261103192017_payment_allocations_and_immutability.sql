-- 1. Create payment_allocations Table
CREATE TABLE IF NOT EXISTS public.payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE RESTRICT,
    payment_id UUID NOT NULL,
    installment_id UUID NOT NULL,
    allocated_amount NUMERIC(10, 2) NOT NULL,
    allocation_type TEXT NOT NULL CHECK (allocation_type IN ('CREDIT', 'REVERSAL')) DEFAULT 'CREDIT',
    reversal_of_id UUID REFERENCES public.payment_allocations(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_allocations_tenant UNIQUE (institute_id, id),
    CONSTRAINT uq_allocations_link UNIQUE (payment_id, installment_id),
    CONSTRAINT chk_allocation_sign CHECK (
        (allocation_type = 'CREDIT' AND allocated_amount > 0)
        OR (allocation_type = 'REVERSAL' AND allocated_amount < 0)
    ),
    CONSTRAINT fk_allocations_payment FOREIGN KEY (institute_id, payment_id)
        REFERENCES public.payments(institute_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_allocations_installment FOREIGN KEY (institute_id, installment_id)
        REFERENCES public.installments(institute_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_allocations_reversal FOREIGN KEY (institute_id, reversal_of_id)
        REFERENCES public.payment_allocations(institute_id, id) ON DELETE RESTRICT
);

-- 2. Create payment_reversals Table
CREATE TABLE IF NOT EXISTS public.payment_reversals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE RESTRICT,
    original_payment_id UUID NOT NULL,
    reversal_payment_id UUID NOT NULL,
    reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 5),
    reverted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    reverted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_payment_reversals_tenant UNIQUE (institute_id, id),
    CONSTRAINT uq_reversal_original UNIQUE (original_payment_id),
    CONSTRAINT fk_reversal_original FOREIGN KEY (institute_id, original_payment_id)
        REFERENCES public.payments(institute_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_reversal_payment FOREIGN KEY (institute_id, reversal_payment_id)
        REFERENCES public.payments(institute_id, id) ON DELETE RESTRICT
);

-- 3. Create financial_audit_logs Table
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE RESTRICT,
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('RECORD_PAYMENT', 'VOID_PAYMENT', 'RECONCILE_INSTALLMENT')),
    entity_name TEXT NOT NULL CHECK (entity_name IN ('payments', 'receipts', 'installments', 'payment_allocations', 'payment_reversals')),
    entity_id UUID NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_audit_logs_tenant UNIQUE (institute_id, id)
);

-- Index the leading tenant keys on each composite foreign-key relation.
CREATE INDEX IF NOT EXISTS idx_allocations_tenant_payment
    ON public.payment_allocations (institute_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_tenant_installment
    ON public.payment_allocations (institute_id, installment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_tenant_reversal
    ON public.payment_allocations (institute_id, reversal_of_id) WHERE reversal_of_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reversals_tenant_original_payment
    ON public.payment_reversals (institute_id, original_payment_id);
CREATE INDEX IF NOT EXISTS idx_reversals_tenant_reversal_payment
    ON public.payment_reversals (institute_id, reversal_payment_id);

-- 4. Installment Status Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_installment_status(
    p_scheduled NUMERIC,
    p_paid NUMERIC,
    p_due_date DATE
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF p_paid >= p_scheduled THEN
        RETURN 'Paid';
    ELSIF p_paid > 0 THEN
        IF p_due_date < CURRENT_DATE THEN
            RETURN 'Overdue';
        ELSE
            RETURN 'Partially_Paid';
        END IF;
    ELSE
        IF p_due_date < CURRENT_DATE THEN
            RETURN 'Overdue';
        ELSE
            RETURN 'Pending';
        END IF;
    END IF;
END;
$$;

-- 5. Execute Historical Allocation Reconciliation Script
ALTER TABLE public.installments DROP CONSTRAINT IF EXISTS installments_status_check;
ALTER TABLE public.installments ADD CONSTRAINT installments_status_check
    CHECK (status IN ('Pending', 'Paid', 'Overdue', 'Partially_Paid'));

DO $$
DECLARE
    v_pay RECORD;
    v_inst RECORD;
    v_linked_inst_count INT;
    v_linked_inst_total NUMERIC(10, 2);
BEGIN
    UPDATE public.installments 
    SET legacy_payment_id = payment_id 
    WHERE legacy_payment_id IS NULL AND payment_id IS NOT NULL;

    FOR v_pay IN SELECT * FROM public.payments WHERE payment_type = 'PAYMENT' ORDER BY payment_date ASC, created_at ASC LOOP
        SELECT count(*), coalesce(sum(amount), 0)
        INTO v_linked_inst_count, v_linked_inst_total
        FROM public.installments
        WHERE legacy_payment_id = v_pay.id;

        IF v_linked_inst_count = 1 THEN
            SELECT * INTO v_inst FROM public.installments WHERE legacy_payment_id = v_pay.id;
            IF v_pay.amount = v_inst.amount AND v_inst.status = 'Paid' THEN
                INSERT INTO public.payment_allocations (
                    institute_id, payment_id, installment_id, allocated_amount, allocation_type
                ) VALUES (
                    v_pay.institute_id, v_pay.id, v_inst.id, v_pay.amount, 'CREDIT'
                ) ON CONFLICT (payment_id, installment_id) DO NOTHING;
            ELSE
                INSERT INTO public._migration_anomalies (entity_type, entity_identifier, issue_code, issue_description, raw_payload)
                VALUES ('PAYMENT', v_pay.id::text, 'UNVERIFIED_HISTORICAL_ALLOCATION',
                        CASE
                            WHEN v_pay.amount <> v_inst.amount THEN 'Legacy payment/installment amounts differ; no allocation inferred.'
                            ELSE 'Legacy installment is not marked Paid; no allocation inferred.'
                        END,
                        jsonb_build_object('payment_id', v_pay.id, 'amount', v_pay.amount,
                                           'installment_id', v_inst.id, 'installment_amount', v_inst.amount,
                                           'installment_status', v_inst.status))
                ON CONFLICT DO NOTHING;
            END IF;
        ELSIF v_linked_inst_count > 1 THEN
            INSERT INTO public._migration_anomalies (entity_type, entity_identifier, issue_code, issue_description, raw_payload)
            VALUES ('PAYMENT', v_pay.id::text, 'UNVERIFIED_HISTORICAL_ALLOCATION',
                    'Payment references multiple installments; no allocation inferred.',
                    jsonb_build_object('payment_id', v_pay.id, 'amount', v_pay.amount,
                                       'linked_installment_count', v_linked_inst_count,
                                       'linked_installment_total', v_linked_inst_total))
            ON CONFLICT DO NOTHING;
        ELSE
            INSERT INTO public._migration_anomalies (entity_type, entity_identifier, issue_code, issue_description, raw_payload)
            VALUES ('PAYMENT', v_pay.id::text, 'UNVERIFIED_HISTORICAL_ALLOCATION',
                    'Payment has no associated installment reference in original dataset.',
                    jsonb_build_object('payment_id', v_pay.id, 'amount', v_pay.amount))
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- Preserve legacy-paid state when no allocation can be verified. Record it for review;
    -- do not silently turn historical paid records into new debts.
    INSERT INTO public._migration_anomalies
        (entity_type, entity_identifier, issue_code, issue_description)
    SELECT 'INSTALLMENT', i.id::text, 'UNVERIFIED_HISTORICAL_PAID_STATUS',
           'Legacy installment was Paid but no verified payment allocation exists; preserved for review.'
    FROM public.installments AS i
    WHERE i.status = 'Paid'
      AND NOT EXISTS (
          SELECT 1 FROM public.payment_allocations AS pa
          WHERE pa.institute_id = i.institute_id AND pa.installment_id = i.id
      )
    ON CONFLICT DO NOTHING;

    -- Recalculate only installments with verified allocation evidence. Preserve all
    -- other legacy statuses until their payment history has been reconciled.
    UPDATE public.installments i
    SET status = public.calculate_installment_status(
        i.amount,
        COALESCE((SELECT sum(allocated_amount) FROM public.payment_allocations
                  WHERE institute_id = i.institute_id AND installment_id = i.id), 0),
        i.due_date
    )
    WHERE EXISTS (
        SELECT 1 FROM public.payment_allocations AS pa
        WHERE pa.institute_id = i.institute_id AND pa.installment_id = i.id
    );
END $$;

-- 6. Install Immutability Triggers
CREATE OR REPLACE FUNCTION public.prevent_financial_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Financial records are immutable. Direct UPDATE and DELETE operations are forbidden.';
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_immutable ON public.payments;
CREATE TRIGGER trg_payments_immutable
BEFORE UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_mutation();

DROP TRIGGER IF EXISTS trg_receipts_immutable ON public.receipts;
CREATE TRIGGER trg_receipts_immutable
BEFORE UPDATE OR DELETE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_mutation();

DROP TRIGGER IF EXISTS trg_allocations_immutable ON public.payment_allocations;
CREATE TRIGGER trg_allocations_immutable
BEFORE UPDATE OR DELETE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_mutation();

DROP TRIGGER IF EXISTS trg_reversals_immutable ON public.payment_reversals;
CREATE TRIGGER trg_reversals_immutable
BEFORE UPDATE OR DELETE ON public.payment_reversals
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.financial_audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.financial_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_mutation();

INSERT INTO public.schema_migrations (version, description)
VALUES ('20261104000005', 'Payment allocations, immutability triggers, and historical reconciliation')
ON CONFLICT (version) DO NOTHING;

