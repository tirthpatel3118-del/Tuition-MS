-- Strict institute-scoped authorization. Apply only after the initial owner is linked.

-- Fail closed before removing legacy access unless the migrated test institute
-- has an authenticated owner who can enter after the RLS cutover.
DO $$
DECLARE
    v_dev_institute_id CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.institutes WHERE id = v_dev_institute_id
    ) THEN
        RAISE EXCEPTION 'RLS cutover blocked: the migrated institute does not exist.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.institute_members
        WHERE institute_id = v_dev_institute_id AND role = 'owner'
    ) THEN
        RAISE EXCEPTION 'RLS cutover blocked: link and verify an Auth user as owner of the migrated institute first.';
    END IF;
END $$;

-- Remove the legacy public CRUD policies regardless of their exact historical names.
DO $$
DECLARE
    v_table TEXT;
    v_policy RECORD;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'institutes', 'institute_members', 'institute_invitations', 'institute_settings',
        'institute_receipt_counters', 'courses', 'batches', 'students', 'payments',
        'receipts', 'installments', 'reminders', 'payment_allocations',
        'payment_reversals', 'financial_audit_logs', '_migration_batch_id_map',
        '_migration_anomalies', 'schema_migrations'
    ] LOOP
        IF to_regclass('public.' || v_table) IS NOT NULL THEN
            FOR v_policy IN
                SELECT policyname
                FROM pg_policies
                WHERE schemaname = 'public' AND tablename = v_table
            LOOP
                EXECUTE format('DROP POLICY %I ON public.%I', v_policy.policyname, v_table);
            END LOOP;
        END IF;
    END LOOP;

    IF to_regclass('public.settings') IS NOT NULL THEN
        FOR v_policy IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'settings'
        LOOP
            EXECUTE format('DROP POLICY %I ON public.settings', v_policy.policyname);
        END LOOP;
    END IF;
END $$;

-- Remove access to legacy aggregate views that were created with SECURITY DEFINER.
DO $$
BEGIN
    IF to_regclass('public.student_balances') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON public.student_balances FROM PUBLIC, anon, authenticated';
    END IF;
    IF to_regclass('public.outstanding_students') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON public.outstanding_students FROM PUBLIC, anon, authenticated';
    END IF;
    IF to_regclass('public.settings') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON public.settings FROM PUBLIC, anon, authenticated';
    END IF;
END $$;

-- Keep the security-definer membership helper outside exposed API schemas.
CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Centralized role check. The fixed search path and fully qualified objects are intentional.
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
REVOKE ALL ON FUNCTION private.is_member_of(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_member_of(UUID, TEXT[]) TO authenticated;

-- All application tables stay behind RLS. Policies are replaced as one versioned set.
ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institute_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institute_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institute_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institute_receipt_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._migration_batch_id_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._migration_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Institute and membership reads are membership-scoped; all membership writes go through RPCs.
GRANT SELECT, UPDATE ON public.institutes TO authenticated;
CREATE POLICY institutes_member_select ON public.institutes FOR SELECT TO authenticated
    USING (private.is_member_of(id));
CREATE POLICY institutes_owner_update ON public.institutes FOR UPDATE TO authenticated
    USING (private.is_member_of(id, ARRAY['owner']))
    WITH CHECK (private.is_member_of(id, ARRAY['owner']));

GRANT SELECT ON public.institute_members TO authenticated;
CREATE POLICY institute_members_member_select ON public.institute_members FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id));

-- Invitation rows and receipt counters are internal to privileged functions.
REVOKE ALL ON public.institute_invitations, public.institute_receipt_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institute_settings TO authenticated;
CREATE POLICY institute_settings_finance_select ON public.institute_settings FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner', 'accountant']));
CREATE POLICY institute_settings_owner_insert ON public.institute_settings FOR INSERT TO authenticated
    WITH CHECK (private.is_member_of(institute_id, ARRAY['owner']));
CREATE POLICY institute_settings_owner_update ON public.institute_settings FOR UPDATE TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']))
    WITH CHECK (private.is_member_of(institute_id, ARRAY['owner']));
CREATE POLICY institute_settings_owner_delete ON public.institute_settings FOR DELETE TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']));

-- Courses and batches: all members can read; only owners can change the catalog.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses, public.batches TO authenticated;
CREATE POLICY courses_member_select ON public.courses FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id));
CREATE POLICY courses_owner_insert ON public.courses FOR INSERT TO authenticated
    WITH CHECK (private.is_member_of(institute_id, ARRAY['owner']));
CREATE POLICY courses_owner_update ON public.courses FOR UPDATE TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']))
    WITH CHECK (private.is_member_of(institute_id, ARRAY['owner']));
CREATE POLICY courses_owner_delete ON public.courses FOR DELETE TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']));
CREATE POLICY batches_member_select ON public.batches FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id));
CREATE POLICY batches_owner_insert ON public.batches FOR INSERT TO authenticated
    WITH CHECK (private.is_member_of(institute_id, ARRAY['owner']));
CREATE POLICY batches_owner_update ON public.batches FOR UPDATE TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']))
    WITH CHECK (private.is_member_of(institute_id, ARRAY['owner']));
CREATE POLICY batches_owner_delete ON public.batches FOR DELETE TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']));

-- Teachers cannot query the full student table; their roster is exposed by the limited view below.
GRANT SELECT, INSERT, UPDATE ON public.students TO authenticated;
CREATE POLICY students_finance_select ON public.students FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner', 'accountant']));
CREATE POLICY students_finance_insert ON public.students FOR INSERT TO authenticated
    WITH CHECK (private.is_member_of(institute_id, ARRAY['owner', 'accountant']));
CREATE POLICY students_finance_update ON public.students FOR UPDATE TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner', 'accountant']))
    WITH CHECK (private.is_member_of(institute_id, ARRAY['owner', 'accountant']));

-- Schedule editing is restricted to pending installments; financial posting remains an RPC operation.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installments TO authenticated;
CREATE POLICY installments_finance_select ON public.installments FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner', 'accountant']));
CREATE POLICY installments_pending_insert ON public.installments FOR INSERT TO authenticated
    WITH CHECK (status = 'Pending' AND private.is_member_of(institute_id, ARRAY['owner', 'accountant']));
CREATE POLICY installments_pending_update ON public.installments FOR UPDATE TO authenticated
    USING (status = 'Pending' AND private.is_member_of(institute_id, ARRAY['owner', 'accountant']))
    WITH CHECK (status = 'Pending' AND private.is_member_of(institute_id, ARRAY['owner', 'accountant']));
CREATE POLICY installments_pending_delete ON public.installments FOR DELETE TO authenticated
    USING (status = 'Pending' AND private.is_member_of(institute_id, ARRAY['owner', 'accountant']));

-- Ledger tables are readable only by finance roles and writable only by SECURITY DEFINER RPCs.
GRANT SELECT ON public.payments, public.receipts, public.payment_allocations,
    public.payment_reversals TO authenticated;
CREATE POLICY payments_finance_select ON public.payments FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner', 'accountant']));
CREATE POLICY receipts_finance_select ON public.receipts FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner', 'accountant']));
CREATE POLICY allocations_finance_select ON public.payment_allocations FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner', 'accountant']));
CREATE POLICY reversals_finance_select ON public.payment_reversals FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner', 'accountant']));

GRANT SELECT, INSERT ON public.reminders TO authenticated;
CREATE POLICY reminders_finance_select ON public.reminders FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner', 'accountant']));
CREATE POLICY reminders_finance_insert ON public.reminders FOR INSERT TO authenticated
    WITH CHECK (private.is_member_of(institute_id, ARRAY['owner', 'accountant']));
GRANT SELECT ON public.financial_audit_logs TO authenticated;
CREATE POLICY audit_owner_select ON public.financial_audit_logs FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']));

-- Migration bookkeeping and anomaly tables are not exposed to application roles.
REVOKE ALL ON public._migration_batch_id_map, public._migration_anomalies,
    public.schema_migrations FROM PUBLIC, anon, authenticated;

-- Teacher roster is intentionally limited to academic fields and uses an explicit membership predicate.
CREATE OR REPLACE VIEW public.academic_students
WITH (security_barrier = true, security_invoker = true) AS
SELECT s.id, s.institute_id, s.course_id, s.batch_id, s.roll_number,
       s.full_name, s.status, s.admission_date, s.created_at
FROM public.students AS s
WHERE private.is_member_of(s.institute_id);
ALTER VIEW public.academic_students OWNER TO postgres;
REVOKE ALL ON public.academic_students FROM PUBLIC, anon;
GRANT SELECT ON public.academic_students TO authenticated;

-- Retire the legacy event trigger after this migration has explicitly secured
-- every application table and view. Remove all triggers bound to this helper,
-- then remove the callable function itself.
DO $$
DECLARE
    v_event_trigger_name TEXT;
BEGIN
    IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
        FOR v_event_trigger_name IN
            SELECT evtname
            FROM pg_event_trigger
            WHERE evtfoid = 'public.rls_auto_enable()'::regprocedure
        LOOP
            EXECUTE format('DROP EVENT TRIGGER %I', v_event_trigger_name);
        END LOOP;

        REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
        DROP FUNCTION public.rls_auto_enable();
    END IF;
END $$;

INSERT INTO public.schema_migrations (version, description)
VALUES ('20261104000007', 'Enforce strict tenant RBAC, financial write gates, and limited academic roster')
ON CONFLICT (version) DO NOTHING;



