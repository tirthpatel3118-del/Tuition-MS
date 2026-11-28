-- DEVELOPMENT ONLY — fictional ClassBandhu screenshot workspace.
-- Never run this seed against Production. No real student/person/payment data is used.
-- This file deliberately creates no legal acceptance or parent/guardian consent records.
-- Demo institute: ClassBandhu Demo Academy (Sample Data Only)
-- Owner is the existing Development platform-admin user; no new Auth users are created.

DO $$
DECLARE
  v_institute_id uuid := 'a1000000-0000-4000-8000-000000000003';
  v_owner_id uuid := 'f403d279-5ed3-48e6-97d4-f6f8349c7ceb';
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.institutes
    WHERE id = v_institute_id OR slug = 'classbandhu-demo-academy'
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'ClassBandhu Demo Academy already exists. This seed is intentionally non-destructive and will not modify an existing workspace.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_owner_id) THEN
    RAISE EXCEPTION 'Expected Development platform-admin Auth user is missing; seed stopped.';
  END IF;

  INSERT INTO public.institutes (
    id, name, slug, currency_symbol, receipt_prefix, receipt_footer
  ) VALUES (
    v_institute_id,
    'ClassBandhu Demo Academy (Sample Data Only)',
    'classbandhu-demo-academy',
    '₹',
    'CBA',
    'DEMONSTRATION RECEIPT — SAMPLE DATA ONLY — NO MONETARY VALUE'
  );

  INSERT INTO public.institute_members (institute_id, user_id, role)
  VALUES (v_institute_id, v_owner_id, 'owner');

  INSERT INTO private.platform_institute_controls (
    institute_id, access_status, plan_code, subscription_status,
    starts_at, student_limit, team_limit, updated_by
  ) VALUES (
    v_institute_id, 'active', 'trial', 'trial',
    now(), 100, 10, v_owner_id
  );

  INSERT INTO public.institute_receipt_counters (institute_id, year, prefix, last_number)
  VALUES (v_institute_id, to_char(current_date, 'YYYY'), 'CBA', 10);

  INSERT INTO public.institute_settings (institute_id, key, value)
  VALUES (
    v_institute_id,
    'app_settings',
    jsonb_build_object(
      'instituteName', 'ClassBandhu Demo Academy (Sample Data Only)',
      'logoUrl', '',
      'address', 'Synthetic demonstration address — not a real campus',
      'contactNumber', '',
      'email', 'info.classbandhu@gmail.com',
      'website', '',
      'receiptPrefix', 'CBA',
      'receiptFooter', 'DEMONSTRATION RECEIPT — SAMPLE DATA ONLY — NO MONETARY VALUE',
      'authorizedSignatureUrl', '',
      'whatsappReminderTemplate', 'DEMO ONLY — Fee reminder for {{studentName}}. No message has been sent.',
      'directFeeReminderTemplate', 'DEMO ONLY — Outstanding fee for {{studentName}}. No message has been sent.',
      'currencySymbol', '₹',
      'dateFormat', 'DD/MM/YYYY',
      'timeZone', 'Asia/Kolkata'
    )
  );

  INSERT INTO public.courses (id, institute_id, course_name, batch_name, duration_months, course_fee)
  VALUES
    ('d3000000-0000-4000-8000-000000000001', v_institute_id, 'Mathematics Mastery', 'Mathematics Morning', 6, 12000),
    ('d3000000-0000-4000-8000-000000000002', v_institute_id, 'Science Explorer', 'Science Afternoon', 6, 10000),
    ('d3000000-0000-4000-8000-000000000003', v_institute_id, 'Commerce Fundamentals', 'Commerce Evening', 10, 15000),
    ('d3000000-0000-4000-8000-000000000004', v_institute_id, 'Foundation Programme', 'Foundation Weekend', 4, 8000);

  INSERT INTO public.batches (
    id, institute_id, course_id, name, timing, capacity, course_fee, status
  ) VALUES
    ('d3000000-0000-4000-8000-000000000101', v_institute_id, 'd3000000-0000-4000-8000-000000000001', 'Mathematics Morning', '07:30 AM - 08:45 AM', 30, 12000, 'Active'),
    ('d3000000-0000-4000-8000-000000000102', v_institute_id, 'd3000000-0000-4000-8000-000000000002', 'Science Afternoon', '12:00 PM - 01:30 PM', 25, 10000, 'Active'),
    ('d3000000-0000-4000-8000-000000000103', v_institute_id, 'd3000000-0000-4000-8000-000000000003', 'Commerce Evening', '05:00 PM - 06:30 PM', 25, 15000, 'Active'),
    ('d3000000-0000-4000-8000-000000000104', v_institute_id, 'd3000000-0000-4000-8000-000000000004', 'Foundation Weekend', '10:00 AM - 11:30 AM', 20, 8000, 'Active');

  INSERT INTO public.batch_courses (institute_id, batch_id, course_id)
  VALUES
    (v_institute_id, 'd3000000-0000-4000-8000-000000000101', 'd3000000-0000-4000-8000-000000000001'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000102', 'd3000000-0000-4000-8000-000000000002'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000103', 'd3000000-0000-4000-8000-000000000003'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000104', 'd3000000-0000-4000-8000-000000000004');

  INSERT INTO public.batch_schedule_days (institute_id, batch_id, weekday, starts_at, ends_at)
  VALUES
    (v_institute_id, 'd3000000-0000-4000-8000-000000000101', 1, '07:30', '08:45'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000101', 3, '07:30', '08:45'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000101', 5, '07:30', '08:45'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000102', 2, '12:00', '13:30'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000102', 4, '12:00', '13:30'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000102', 6, '12:00', '13:30'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000103', 1, '17:00', '18:30'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000103', 3, '17:00', '18:30'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000103', 5, '17:00', '18:30'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000104', 0, '10:00', '11:30'),
    (v_institute_id, 'd3000000-0000-4000-8000-000000000104', 6, '10:00', '11:30');

  INSERT INTO public.students (
    id, roll_number, full_name, parent_name, parent_whatsapp, student_mobile,
    email, address, course_id, admission_date, course_fee, discount, status,
    institute_id, batch_id, expected_fee_due_date
  )
  SELECT
    ('d3010000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    'CBA-' || lpad(n::text, 3, '0'),
    student_name,
    'Parent ' || lpad(n::text, 2, '0') || ' (Sample)',
    '0000000000',
    '0000000000',
    'student' || lpad(n::text, 2, '0') || '@example.com',
    'SYNTHETIC DEMO DATA — NOT A REAL ADDRESS',
    CASE course_no
      WHEN 1 THEN 'd3000000-0000-4000-8000-000000000001'::uuid
      WHEN 2 THEN 'd3000000-0000-4000-8000-000000000002'::uuid
      WHEN 3 THEN 'd3000000-0000-4000-8000-000000000003'::uuid
      ELSE 'd3000000-0000-4000-8000-000000000004'::uuid
    END,
    current_date - ((n * 7) % 120),
    CASE course_no WHEN 1 THEN 12000 WHEN 2 THEN 10000 WHEN 3 THEN 15000 ELSE 8000 END,
    0,
    CASE WHEN n = 18 THEN 'Inactive' ELSE 'Active' END,
    v_institute_id,
    CASE batch_no
      WHEN 1 THEN 'd3000000-0000-4000-8000-000000000101'::uuid
      WHEN 2 THEN 'd3000000-0000-4000-8000-000000000102'::uuid
      WHEN 3 THEN 'd3000000-0000-4000-8000-000000000103'::uuid
      ELSE 'd3000000-0000-4000-8000-000000000104'::uuid
    END,
    CASE WHEN n = 20 THEN current_date - 4 ELSE NULL END
  FROM (VALUES
    (1, 'Aarav Sample', 1, 1),
    (2, 'Diya Sample', 1, 1),
    (3, 'Kabir Sample', 1, 1),
    (4, 'Meera Sample', 1, 1),
    (5, 'Ishaan Sample', 1, 1),
    (6, 'Anaya Sample', 1, 1),
    (7, 'Vivaan Sample', 2, 2),
    (8, 'Sara Sample', 2, 2),
    (9, 'Arjun Sample', 2, 2),
    (10, 'Myra Sample', 2, 2),
    (11, 'Reyansh Sample', 2, 2),
    (12, 'Riya Sample', 3, 3),
    (13, 'Dev Sample', 3, 3),
    (14, 'Aadhya Sample', 3, 3),
    (15, 'Kiaan Sample', 3, 3),
    (16, 'Anvi Sample', 4, 4),
    (17, 'Shaurya Sample', 4, 4),
    (18, 'Pari Sample', 4, 4),
    (19, 'Rudra Sample', 4, 4),
    (20, 'Tara Sample', 4, 4)
  ) AS roster(n, student_name, course_no, batch_no);

  -- All payment entries below are fictional seed records, not real money movements.
  INSERT INTO public.payments (
    id, student_id, amount, payment_mode, payment_date, remarks,
    institute_id, payment_type, idempotency_key, created_by
  )
  VALUES
    ('d3030000-0000-4000-8000-000000000001', 'd3010000-0000-4000-8000-000000000001', 4000.00, 'UPI', current_date - 20, 'SAMPLE DATA ONLY — no money was received', v_institute_id, 'PAYMENT', 'DEMO-CBA-PAY-001', v_owner_id),
    ('d3030000-0000-4000-8000-000000000002', 'd3010000-0000-4000-8000-000000000002', 2500.00, 'UPI', current_date - 8,  'SAMPLE DATA ONLY — partial payment demonstration', v_institute_id, 'PAYMENT', 'DEMO-CBA-PAY-002', v_owner_id),
    ('d3030000-0000-4000-8000-000000000003', 'd3010000-0000-4000-8000-000000000003', 4000.00, 'Cash', current_date - 18, 'SAMPLE DATA ONLY — no money was received', v_institute_id, 'PAYMENT', 'DEMO-CBA-PAY-003', v_owner_id),
    ('d3030000-0000-4000-8000-000000000004', 'd3010000-0000-4000-8000-000000000004', 4000.00, 'Bank Transfer', current_date - 12, 'SAMPLE DATA ONLY — no money was received', v_institute_id, 'PAYMENT', 'DEMO-CBA-PAY-004', v_owner_id),
    ('d3030000-0000-4000-8000-000000000005', 'd3010000-0000-4000-8000-000000000007', 3333.33, 'UPI', current_date - 16, 'SAMPLE DATA ONLY — no money was received', v_institute_id, 'PAYMENT', 'DEMO-CBA-PAY-005', v_owner_id),
    ('d3030000-0000-4000-8000-000000000006', 'd3010000-0000-4000-8000-000000000008', 2000.00, 'Cash', current_date - 5, 'SAMPLE DATA ONLY — partial payment demonstration', v_institute_id, 'PAYMENT', 'DEMO-CBA-PAY-006', v_owner_id),
    ('d3030000-0000-4000-8000-000000000007', 'd3010000-0000-4000-8000-000000000012', 5000.00, 'Bank Transfer', current_date - 10, 'SAMPLE DATA ONLY — no money was received', v_institute_id, 'PAYMENT', 'DEMO-CBA-PAY-007', v_owner_id),
    ('d3030000-0000-4000-8000-000000000008', 'd3010000-0000-4000-8000-000000000014', 5000.00, 'UPI', current_date - 9, 'SAMPLE DATA ONLY — no money was received', v_institute_id, 'PAYMENT', 'DEMO-CBA-PAY-008', v_owner_id),
    ('d3030000-0000-4000-8000-000000000009', 'd3010000-0000-4000-8000-000000000017', 2666.67, 'UPI', current_date - 6, 'SAMPLE DATA ONLY — no money was received', v_institute_id, 'PAYMENT', 'DEMO-CBA-PAY-009', v_owner_id),
    ('d3030000-0000-4000-8000-000000000010', 'd3010000-0000-4000-8000-000000000020', 1800.00, 'Cash', current_date - 3, 'SAMPLE DATA ONLY — direct fee collection example; no money was received', v_institute_id, 'PAYMENT', 'DEMO-CBA-PAY-010', v_owner_id);

  INSERT INTO public.installments (
    id, student_id, installment_number, due_date, amount, status,
    payment_id, remarks, institute_id
  )
  SELECT
    ('d3020000-0000-4000-8000-' || lpad((((n - 1) * 3) + installment_no)::text, 12, '0'))::uuid,
    ('d3010000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    installment_no,
    CASE installment_no
      WHEN 1 THEN current_date - 45
      WHEN 2 THEN current_date + 7
      ELSE current_date + 37
    END,
    CASE course_no
      WHEN 1 THEN 4000.00
      WHEN 2 THEN CASE installment_no WHEN 3 THEN 3333.34 ELSE 3333.33 END
      WHEN 3 THEN 5000.00
      ELSE CASE installment_no WHEN 3 THEN 2666.66 ELSE 2666.67 END
    END,
    CASE
      WHEN installment_no = 1 AND n IN (1,3,4,7,12,14,17) THEN 'Paid'
      WHEN installment_no = 1 AND n IN (2,8) THEN 'Partially_Paid'
      WHEN installment_no = 1 THEN 'Overdue'
      ELSE 'Pending'
    END,
    CASE
      WHEN installment_no = 1 AND n = 1 THEN 'd3030000-0000-4000-8000-000000000001'::uuid
      WHEN installment_no = 1 AND n = 2 THEN 'd3030000-0000-4000-8000-000000000002'::uuid
      WHEN installment_no = 1 AND n = 3 THEN 'd3030000-0000-4000-8000-000000000003'::uuid
      WHEN installment_no = 1 AND n = 4 THEN 'd3030000-0000-4000-8000-000000000004'::uuid
      WHEN installment_no = 1 AND n = 7 THEN 'd3030000-0000-4000-8000-000000000005'::uuid
      WHEN installment_no = 1 AND n = 8 THEN 'd3030000-0000-4000-8000-000000000006'::uuid
      WHEN installment_no = 1 AND n = 12 THEN 'd3030000-0000-4000-8000-000000000007'::uuid
      WHEN installment_no = 1 AND n = 14 THEN 'd3030000-0000-4000-8000-000000000008'::uuid
      WHEN installment_no = 1 AND n = 17 THEN 'd3030000-0000-4000-8000-000000000009'::uuid
      ELSE NULL
    END,
    'DEMO SCHEDULE — SAMPLE DATA ONLY',
    v_institute_id
  FROM (
    SELECT n, course_no FROM (VALUES
      (1,1),(2,1),(3,1),(4,1),(5,1),(6,1),
      (7,2),(8,2),(9,2),(10,2),(11,2),
      (12,3),(13,3),(14,3),(15,3),
      (16,4),(17,4),(18,4),(19,4)
    ) AS students(n,course_no)
  ) roster
  CROSS JOIN generate_series(1,3) AS installment_no;

  INSERT INTO public.payment_allocations (
    institute_id, payment_id, installment_id, allocated_amount, allocation_type
  )
  VALUES
    (v_institute_id, 'd3030000-0000-4000-8000-000000000001', 'd3020000-0000-4000-8000-000000000001', 4000.00, 'CREDIT'),
    (v_institute_id, 'd3030000-0000-4000-8000-000000000002', 'd3020000-0000-4000-8000-000000000004', 2500.00, 'CREDIT'),
    (v_institute_id, 'd3030000-0000-4000-8000-000000000003', 'd3020000-0000-4000-8000-000000000007', 4000.00, 'CREDIT'),
    (v_institute_id, 'd3030000-0000-4000-8000-000000000004', 'd3020000-0000-4000-8000-000000000010', 4000.00, 'CREDIT'),
    (v_institute_id, 'd3030000-0000-4000-8000-000000000005', 'd3020000-0000-4000-8000-000000000019', 3333.33, 'CREDIT'),
    (v_institute_id, 'd3030000-0000-4000-8000-000000000006', 'd3020000-0000-4000-8000-000000000022', 2000.00, 'CREDIT'),
    (v_institute_id, 'd3030000-0000-4000-8000-000000000007', 'd3020000-0000-4000-8000-000000000034', 5000.00, 'CREDIT'),
    (v_institute_id, 'd3030000-0000-4000-8000-000000000008', 'd3020000-0000-4000-8000-000000000040', 5000.00, 'CREDIT'),
    (v_institute_id, 'd3030000-0000-4000-8000-000000000009', 'd3020000-0000-4000-8000-000000000049', 2666.67, 'CREDIT');

  INSERT INTO public.receipts (id, payment_id, receipt_number, institute_id, receipt_type)
  VALUES
    ('d3040000-0000-4000-8000-000000000001', 'd3030000-0000-4000-8000-000000000001', 'CBA-2026-0001', v_institute_id, 'RECEIPT'),
    ('d3040000-0000-4000-8000-000000000002', 'd3030000-0000-4000-8000-000000000002', 'CBA-2026-0002', v_institute_id, 'RECEIPT'),
    ('d3040000-0000-4000-8000-000000000003', 'd3030000-0000-4000-8000-000000000003', 'CBA-2026-0003', v_institute_id, 'RECEIPT'),
    ('d3040000-0000-4000-8000-000000000004', 'd3030000-0000-4000-8000-000000000004', 'CBA-2026-0004', v_institute_id, 'RECEIPT'),
    ('d3040000-0000-4000-8000-000000000005', 'd3030000-0000-4000-8000-000000000005', 'CBA-2026-0005', v_institute_id, 'RECEIPT'),
    ('d3040000-0000-4000-8000-000000000006', 'd3030000-0000-4000-8000-000000000006', 'CBA-2026-0006', v_institute_id, 'RECEIPT'),
    ('d3040000-0000-4000-8000-000000000007', 'd3030000-0000-4000-8000-000000000007', 'CBA-2026-0007', v_institute_id, 'RECEIPT'),
    ('d3040000-0000-4000-8000-000000000008', 'd3030000-0000-4000-8000-000000000008', 'CBA-2026-0008', v_institute_id, 'RECEIPT'),
    ('d3040000-0000-4000-8000-000000000009', 'd3030000-0000-4000-8000-000000000009', 'CBA-2026-0009', v_institute_id, 'RECEIPT'),
    ('d3040000-0000-4000-8000-000000000010', 'd3030000-0000-4000-8000-000000000010', 'CBA-2026-0010', v_institute_id, 'RECEIPT');

  INSERT INTO public.reminders (
    id, institute_id, student_id, amount_due, channel, status, provider_reference
  )
  VALUES
    ('d3050000-0000-4000-8000-000000000001', v_institute_id, 'd3010000-0000-4000-8000-000000000002', 9500.00, 'WhatsApp', 'queued', 'DEMO-NOT-SENT-001'),
    ('d3050000-0000-4000-8000-000000000002', v_institute_id, 'd3010000-0000-4000-8000-000000000005', 12000.00, 'WhatsApp', 'queued', 'DEMO-NOT-SENT-002'),
    ('d3050000-0000-4000-8000-000000000003', v_institute_id, 'd3010000-0000-4000-8000-000000000008', 8000.00, 'WhatsApp', 'queued', 'DEMO-NOT-SENT-003'),
    ('d3050000-0000-4000-8000-000000000004', v_institute_id, 'd3010000-0000-4000-8000-000000000013', 15000.00, 'Email', 'queued', 'DEMO-NOT-SENT-004'),
    ('d3050000-0000-4000-8000-000000000005', v_institute_id, 'd3010000-0000-4000-8000-000000000020', 6200.00, 'WhatsApp', 'queued', 'DEMO-NOT-SENT-005');

  INSERT INTO public.attendance_records (
    institute_id, student_id, batch_id, attendance_date, status, marked_by
  )
  SELECT
    v_institute_id,
    ('d3010000-0000-4000-8000-' || lpad(student_no::text, 12, '0'))::uuid,
    CASE batch_no
      WHEN 1 THEN 'd3000000-0000-4000-8000-000000000101'::uuid
      WHEN 2 THEN 'd3000000-0000-4000-8000-000000000102'::uuid
      WHEN 3 THEN 'd3000000-0000-4000-8000-000000000103'::uuid
      ELSE 'd3000000-0000-4000-8000-000000000104'::uuid
    END,
    current_date - day_offset,
    CASE ((student_no + day_offset) % 17)
      WHEN 0 THEN 'Absent'
      WHEN 1 THEN 'Late'
      WHEN 2 THEN 'Leave'
      ELSE 'Present'
    END,
    v_owner_id
  FROM (
    SELECT n AS student_no, batch_no, day_offset
    FROM (VALUES
      (1,1),(2,1),(3,1),(4,1),(5,1),(6,1),
      (7,2),(8,2),(9,2),(10,2),(11,2),
      (12,3),(13,3),(14,3),(15,3),
      (16,4),(17,4),(19,4)
    ) AS roster(n,batch_no)
    CROSS JOIN generate_series(0,6) AS day_offset
  ) attendance_seed;

  RAISE NOTICE 'Created ClassBandhu Demo Academy with fictional records only. No legal acceptance/consent records were generated.';
END;
$$;
