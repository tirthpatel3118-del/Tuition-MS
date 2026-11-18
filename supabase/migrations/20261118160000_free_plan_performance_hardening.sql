-- Free-plan performance hardening for EduLedger.
-- Add indexes for foreign-key columns and make auth.uid() policy checks initplan-safe.
-- No data is modified by this migration.

BEGIN;

-- Auth-user foreign keys: these indexes keep user deletion / FK checks efficient.
CREATE INDEX IF NOT EXISTS idx_attendance_audit_logs_actor_id
  ON public.attendance_audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS idx_attendance_correction_decided_by
  ON public.attendance_correction_requests (decided_by);

CREATE INDEX IF NOT EXISTS idx_attendance_correction_requested_by
  ON public.attendance_correction_requests (requested_by);

CREATE INDEX IF NOT EXISTS idx_attendance_records_marked_by
  ON public.attendance_records (marked_by);

CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_actor_id
  ON public.financial_audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS idx_institute_invitations_invited_by
  ON public.institute_invitations (invited_by);

CREATE INDEX IF NOT EXISTS idx_institute_members_user_id
  ON public.institute_members (user_id);

CREATE INDEX IF NOT EXISTS idx_payment_reversals_reverted_by
  ON public.payment_reversals (reverted_by);

CREATE INDEX IF NOT EXISTS idx_payments_created_by
  ON public.payments (created_by);

-- Self-referencing allocation FK: the existing tenant/reversal index starts
-- with institute_id, so it does not cover lookups by reversal_of_id alone.
CREATE INDEX IF NOT EXISTS idx_payment_allocations_reversal_of_id
  ON public.payment_allocations (reversal_of_id)
  WHERE reversal_of_id IS NOT NULL;

-- Keep the existing authorization predicates intact; only evaluate auth.uid()
-- once per statement instead of once per candidate row.
ALTER POLICY attendance_correction_read
  ON public.attendance_correction_requests
  USING (
    private.is_member_of(institute_id, ARRAY['owner']::text[])
    OR (
      requested_by = (SELECT auth.uid())
      AND private.is_member_of(institute_id, ARRAY['teacher']::text[])
    )
  );

ALTER POLICY attendance_correction_teacher_insert
  ON public.attendance_correction_requests
  WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND private.is_member_of(institute_id, ARRAY['teacher']::text[])
    AND decision = 'Pending'
    AND EXISTS (
      SELECT 1
      FROM public.attendance_records ar
      WHERE ar.institute_id = attendance_correction_requests.institute_id
        AND ar.id = attendance_correction_requests.attendance_id
        AND private.can_access_attendance_batch(ar.institute_id, ar.batch_id)
    )
  );

ALTER POLICY teacher_batch_assignments_member_select
  ON public.teacher_batch_assignments
  USING (
    private.is_member_of(institute_id, ARRAY['owner']::text[])
    OR (
      teacher_user_id = (SELECT auth.uid())
      AND private.is_member_of(institute_id, ARRAY['teacher']::text[])
    )
  );

COMMIT;
