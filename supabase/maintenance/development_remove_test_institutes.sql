-- One-time Development-only cleanup of the three identified test institutes.
-- This file is documentation for the executed maintenance operation; it is not a migration.
-- Never run against Primary/Production.
BEGIN;

DO $cleanup$
DECLARE
  v_target_ids uuid[] := ARRAY[
    'a1000000-0000-4000-8000-000000000001'::uuid, -- Demo Institute Alpha
    'a1000000-0000-4000-8000-000000000002'::uuid, -- Demo Institute Beta
    '0e8b55d3-95ee-4c99-89df-61f4a618f34e'::uuid  -- Test
  ];
  v_verified integer;
BEGIN
  SELECT count(*) INTO v_verified
  FROM public.institutes
  WHERE (id = 'a1000000-0000-4000-8000-000000000001'::uuid AND slug = 'demo-institute-alpha')
     OR (id = 'a1000000-0000-4000-8000-000000000002'::uuid AND slug = 'demo-institute-beta')
     OR (id = '0e8b55d3-95ee-4c99-89df-61f4a618f34e'::uuid AND slug = 'test');

  IF v_verified <> 3 THEN
    RAISE EXCEPTION 'Safety check failed: the three expected Development test institutes were not found.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.institutes
    WHERE id = 'a1000000-0000-4000-8000-000000000003'::uuid
      AND slug = 'classbandhu-demo-academy'
  ) THEN
    -- Explicit preserve guard for the seeded sample-data institute.
    NULL;
  ELSE
    RAISE EXCEPTION 'Safety check failed: the intended ClassBandhu Demo Academy sample institute is missing.';
  END IF;

  -- Remove test-only platform subscription payment and invoice rows for Alpha.
  DELETE FROM private.platform_billing_payments
  WHERE invoice_id IN (
    SELECT id FROM private.platform_billing_invoices
    WHERE institute_id = 'a1000000-0000-4000-8000-000000000001'::uuid
  );
  DELETE FROM private.platform_billing_invoices
  WHERE institute_id = 'a1000000-0000-4000-8000-000000000001'::uuid;

  -- Remove institute-owned operational/audit data in FK-safe order.
  DELETE FROM public.attendance_audit_logs WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.attendance_correction_requests WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.attendance_records WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.financial_audit_logs WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.reminders WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.teacher_batch_assignments WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.batch_schedule_days WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.batch_courses WHERE institute_id = ANY(v_target_ids);

  -- Reversal allocations refer to the original allocation; remove them first.
  DELETE FROM public.payment_allocations
  WHERE institute_id = ANY(v_target_ids) AND reversal_of_id IS NOT NULL;
  DELETE FROM public.payment_reversals WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.payment_allocations WHERE institute_id = ANY(v_target_ids);

  DELETE FROM public.receipts WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.installments WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.payments WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.student_batches WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.academic_students WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.students WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.batches WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.courses WHERE institute_id = ANY(v_target_ids);

  DELETE FROM public.institute_invitations WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.institute_legal_declarations WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.institute_members WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.institute_receipt_counters WHERE institute_id = ANY(v_target_ids);
  DELETE FROM public.institute_settings WHERE institute_id = ANY(v_target_ids);

  -- Shared platform audit rows are retained (their institute FK is ON DELETE SET NULL).
  -- User legal acceptance history is retained (its institute FK is ON DELETE SET NULL).
  -- Auth users are retained; this operation removes tenant test institutes only.
  DELETE FROM public.institutes WHERE id = ANY(v_target_ids);

  IF EXISTS (SELECT 1 FROM public.institutes WHERE id = ANY(v_target_ids)) THEN
    RAISE EXCEPTION 'Cleanup incomplete: one or more test institutes remain.';
  END IF;
END
$cleanup$;

COMMIT;
