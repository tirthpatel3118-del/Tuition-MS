-- One-time Development-only cleanup of the three identified test institutes.
-- Preserves immutable financial, legal, acceptance and billing evidence in the
-- private.deleted_institute_audit_archive before removing tenant-owned rows.
-- This maintenance script is not an automatically applied migration.
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

  IF NOT EXISTS (SELECT 1 FROM public.institutes
    WHERE id='a1000000-0000-4000-8000-000000000003'::uuid AND slug='classbandhu-demo-academy') THEN
    RAISE EXCEPTION 'Safety check failed: ClassBandhu Demo Academy sample institute is missing.';
  END IF;

  IF to_regclass('private.deleted_institute_audit_archive') IS NULL THEN
    RAISE EXCEPTION 'Safety check failed: private audit archive is not installed.';
  END IF;
  IF EXISTS (SELECT 1 FROM private.deleted_institute_audit_archive WHERE original_institute_id=ANY(v_target_ids)) THEN
    RAISE EXCEPTION 'Safety check failed: archive rows already exist for one or more targets; inspect before retrying.';
  END IF;

  -- Preserve immutable financial and legal audit history.
  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'financial_audit_logs',f.id,f.institute_id,i.name,to_jsonb(f)
  FROM public.financial_audit_logs f JOIN public.institutes i ON i.id=f.institute_id
  WHERE f.institute_id=ANY(v_target_ids);

  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'institute_legal_declarations',d.id,d.institute_id,i.name,to_jsonb(d)
  FROM public.institute_legal_declarations d JOIN public.institutes i ON i.id=d.institute_id
  WHERE d.institute_id=ANY(v_target_ids);

  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'user_legal_acceptances',a.id,a.institute_id,i.name,to_jsonb(a)
  FROM public.user_legal_acceptances a JOIN public.institutes i ON i.id=a.institute_id
  WHERE a.institute_id=ANY(v_target_ids);

  -- Preserve Alpha's payment ledger and receipt evidence.
  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'payment_allocations',x.id,x.institute_id,i.name,to_jsonb(x)
  FROM public.payment_allocations x JOIN public.institutes i ON i.id=x.institute_id
  WHERE x.institute_id=ANY(v_target_ids);

  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'payment_reversals',x.id,x.institute_id,i.name,to_jsonb(x)
  FROM public.payment_reversals x JOIN public.institutes i ON i.id=x.institute_id
  WHERE x.institute_id=ANY(v_target_ids);

  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'payments',x.id,x.institute_id,i.name,to_jsonb(x)
  FROM public.payments x JOIN public.institutes i ON i.id=x.institute_id
  WHERE x.institute_id=ANY(v_target_ids);

  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'receipts',x.id,x.institute_id,i.name,to_jsonb(x)
  FROM public.receipts x JOIN public.institutes i ON i.id=x.institute_id
  WHERE x.institute_id=ANY(v_target_ids);

  -- Preserve Alpha's platform subscription invoice and receipt/payment evidence.
  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'platform_billing_invoices',b.id,b.institute_id,i.name,to_jsonb(b)
  FROM private.platform_billing_invoices b JOIN public.institutes i ON i.id=b.institute_id
  WHERE b.institute_id='a1000000-0000-4000-8000-000000000001'::uuid;

  INSERT INTO private.deleted_institute_audit_archive
    (source_table,original_record_id,original_institute_id,original_institute_name,record_data)
  SELECT 'platform_billing_payments',p.id,b.institute_id,i.name,to_jsonb(p)
  FROM private.platform_billing_payments p
  JOIN private.platform_billing_invoices b ON b.id=p.invoice_id
  JOIN public.institutes i ON i.id=b.institute_id
  WHERE b.institute_id='a1000000-0000-4000-8000-000000000001'::uuid;

  -- The original financial/legal tables are append-only by design. Exact snapshots
  -- now exist in the private archive. Temporarily disable only their immutable
  -- triggers within this transaction, remove these test-owned copies, then re-enable.
  ALTER TABLE public.financial_audit_logs DISABLE TRIGGER trg_audit_logs_immutable;
  ALTER TABLE public.institute_legal_declarations DISABLE TRIGGER institute_legal_declarations_immutable;
  ALTER TABLE public.user_legal_acceptances DISABLE TRIGGER user_legal_acceptances_append_only;
  ALTER TABLE public.payment_allocations DISABLE TRIGGER trg_allocations_immutable;
  ALTER TABLE public.payment_reversals DISABLE TRIGGER trg_reversals_immutable;
  ALTER TABLE public.payments DISABLE TRIGGER trg_payments_immutable;
  ALTER TABLE public.receipts DISABLE TRIGGER trg_receipts_immutable;

  DELETE FROM public.financial_audit_logs WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.institute_legal_declarations WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.user_legal_acceptances WHERE institute_id=ANY(v_target_ids);

  -- Remove immutable payment children before parent payment rows.
  DELETE FROM public.payment_allocations WHERE institute_id=ANY(v_target_ids) AND reversal_of_id IS NOT NULL;
  DELETE FROM public.payment_allocations WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.payment_reversals WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.receipts WHERE institute_id=ANY(v_target_ids);

  ALTER TABLE public.financial_audit_logs ENABLE TRIGGER trg_audit_logs_immutable;
  ALTER TABLE public.institute_legal_declarations ENABLE TRIGGER institute_legal_declarations_immutable;
  ALTER TABLE public.user_legal_acceptances ENABLE TRIGGER user_legal_acceptances_append_only;
  ALTER TABLE public.payment_allocations ENABLE TRIGGER trg_allocations_immutable;
  ALTER TABLE public.payment_reversals ENABLE TRIGGER trg_reversals_immutable;
  ALTER TABLE public.payments ENABLE TRIGGER trg_payments_immutable;
  ALTER TABLE public.receipts ENABLE TRIGGER trg_receipts_immutable;

  -- Remove Alpha's test subscription payment/invoice from the active billing ledger.
  DELETE FROM private.platform_billing_payments
  WHERE invoice_id IN (SELECT id FROM private.platform_billing_invoices
    WHERE institute_id='a1000000-0000-4000-8000-000000000001'::uuid);
  DELETE FROM private.platform_billing_invoices
  WHERE institute_id='a1000000-0000-4000-8000-000000000001'::uuid;

  -- Remove remaining tenant-owned operational data in FK-safe order.
  DELETE FROM public.attendance_audit_logs WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.attendance_correction_requests WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.attendance_records WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.reminders WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.teacher_batch_assignments WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.batch_schedule_days WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.batch_courses WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.installments WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.student_batches WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.academic_students WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.students WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.payments WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.batches WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.courses WHERE institute_id=ANY(v_target_ids);

  DELETE FROM public.institute_invitations WHERE institute_id=ANY(v_target_ids);

  -- Last-owner protection remains enabled in normal app use. Temporarily disable
  -- just this trigger for the three explicit institute-removal rows in this transaction.
  ALTER TABLE public.institute_members DISABLE TRIGGER trg_protect_last_owner;
  DELETE FROM public.institute_members WHERE institute_id=ANY(v_target_ids);
  ALTER TABLE public.institute_members ENABLE TRIGGER trg_protect_last_owner;

  DELETE FROM public.institute_receipt_counters WHERE institute_id=ANY(v_target_ids);
  DELETE FROM public.institute_settings WHERE institute_id=ANY(v_target_ids);

  -- Keep private.platform_admin_audit rows; FK ON DELETE SET NULL detaches institute_id.
  -- Auth identities remain intact. Platform/user audit snapshots are in the private archive.
  DELETE FROM public.institutes WHERE id=ANY(v_target_ids);

  IF EXISTS (SELECT 1 FROM public.institutes WHERE id=ANY(v_target_ids)) THEN
    RAISE EXCEPTION 'Cleanup incomplete: one or more Development test institutes remain.';
  END IF;
END
$cleanup$;

COMMIT;
