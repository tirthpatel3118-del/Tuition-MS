-- One-time Development-only cleanup of the three identified test institutes.
-- Preserves financial audit, legal declaration and test subscription billing evidence
-- in private.deleted_institute_audit_archive before removing tenant-owned rows.
-- This is a maintenance script, not an automatically applied migration.
-- NEVER run against Primary/Production.

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
    RAISE EXCEPTION 'Safety check failed: expected Development test institutes not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.institutes
    WHERE id = 'a1000000-0000-4000-8000-000000000003'::uuid
      AND slug = 'classbandhu-demo-academy'
  ) THEN
    RAISE EXCEPTION 'Safety check failed: ClassBandhu Demo Academy sample institute is missing.';
  END IF;

  IF to_regclass('private.deleted_institute_audit_archive') IS NULL THEN
    RAISE EXCEPTION 'Safety check failed: private audit archive is not installed.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM private.deleted_institute_audit_archive
    WHERE original_institute_id = ANY(v_target_ids)
  ) THEN
    RAISE EXCEPTION 'Safety check failed: archive rows already exist for one or more targets; inspect before retrying.';
  END IF;

  -- Snapshot immutable financial audit and legal declarations before removing tenant rows.
  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'financial_audit_logs', f.id, f.institute_id, i.name, to_jsonb(f)
  FROM public.financial_audit_logs f
  JOIN public.institutes i ON i.id=f.institute_id
  WHERE f.institute_id=ANY(v_target_ids);

  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'institute_legal_declarations', d.id, d.institute_id, i.name, to_jsonb(d)
  FROM public.institute_legal_declarations d
  JOIN public.institutes i ON i.id=d.institute_id
  WHERE d.institute_id=ANY(v_target_ids);

  -- Preserve the test subscription invoice and payment snapshot before removing
  -- the invoice from the active platform billing ledger (Alpha only).
  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'platform_billing_invoices', b.id, b.institute_id, i.name, to_jsonb(b)
  FROM private.platform_billing_invoices b
  JOIN public.institutes i ON i.id=b.institute_id
  WHERE b.institute_id='a1000000-0000-4000-8000-000000000001'::uuid;

  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'platform_billing_payments', p.id, b.institute_id, i.name, to_jsonb(p)
  FROM private.platform_billing_payments p
  JOIN private.platform_billing_invoices b ON b.id=p.invoice_id
  JOIN public.institutes i ON i.id=b.institute_id
  WHERE b.institute_id='a1000000-0000-4000-8000-000000000001'::uuid;

  -- The application intentionally makes these source audit tables immutable.
  -- Their exact rows have been snapshotted into a private, RLS-protected,
  -- append-only archive above. Disable only the two immutability triggers
  -- inside this transaction, remove the test-owned originals, and re-enable.
  ALTER TABLE public.financial_audit_logs DISABLE TRIGGER trg_audit_logs_immutable;
  DELETE FROM public.financial_audit_logs WHERE institute_id=ANY(v_target_ids);
  ALTER TABLE public.financial_audit_logs ENABLE TRIGGER trg_audit_logs_immutable;

  ALTER TABLE public.institute_legal_declarations DISABLE TRIGGER institute_legal_declarations_immutable;
  DELETE FROM public.institute_legal_declarations WHERE institute_id=ANY(v_target_ids);
  ALTER TABLE public.institute_legal_declarations ENABLE TRIGGER institute_legal_declarations_immutable;

  -- Remove Alpha's test subscription payment/invoice from the active billing ledger.
  DELETE FROM private.platform_billing_payments
  WHERE invoice_id IN (
    SELECT id FROM private.platform_billing_invoices
    WHERE institute_id='a1000000-0000-4000-8000-000000000001'::uuid
  );
  DELETE FROM private.platform_billing_invoices
  WHERE institute_id='a1000000-0000-4000-8000-000000000001'::uuid;

  -- Remove tenant-owned operational data in foreign-key-safe order.
  DELETE FROM public.attendance_audit_logs WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.attendance_correction_requests WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.attendance_records WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.reminders WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.teacher_batch_assignments WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.batch_schedule_days WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.batch_courses WHERE institute_id=ANY(v_target_ids);

  -- Reversal allocations reference original allocations; remove them first.
  DELETE FROM public.payment_allocations
  WHERE institute_id=ANY(v_target_ids) AND reversal_of_id IS NOT NULL;
  DELETE FROM public.payment_reversals WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.payment_allocations WHERE institute_id=ANY(v_target_ids);

  DELETE FROM public.receipts WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.installments WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.payments WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.student_batches WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.academic_students WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.students WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.batches WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.courses WHERE institute_id=ANY(v_target_ids);

  DELETE FROM public.institute_invitations WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.institute_members WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.institute_receipt_counters WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.institute_settings WHERE institute_id=ANY(v_target_ids);

  -- Preserve shared platform_admin_audit rows (institute FK ON DELETE SET NULL)
  -- and user_legal_acceptances (institute FK ON DELETE SET NULL).
  -- Auth users remain intact; this operation removes tenant accounts only.
  DELETE FROM public.institutes WHERE id=ANY(v_target_ids);

  IF EXISTS (SELECT 1 FROM public.institutes WHERE id=ANY(v_target_ids)) THEN
    RAISE EXCEPTION 'Cleanup incomplete: one or more Development test institutes remain.';
  END IF;
END
$cleanup$;

COMMIT;
