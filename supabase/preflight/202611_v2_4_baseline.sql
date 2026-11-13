-- Read-only baseline report for the EduLedger v2.4 migration review.
-- Run this on a verified backup/isolated restore before any migration or baseline repair.
-- The report contains aggregate counts only; it does not return student or payment rows.
WITH payment_links AS (
    SELECT p.id, p.amount, count(i.id)::integer AS linked_count,
           coalesce(sum(i.amount), 0)::numeric AS linked_amount,
           max(i.amount)::numeric AS single_installment_amount
    FROM public.payments AS p
    LEFT JOIN public.installments AS i ON i.payment_id = p.id
    GROUP BY p.id, p.amount
),
legacy_policies AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'table', tablename,
               'name', policyname,
               'command', cmd,
               'roles', roles,
               'using', qual,
               'with_check', with_check
           ) ORDER BY tablename, policyname), '[]'::jsonb) AS details
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('courses', 'students', 'payments', 'receipts', 'installments', 'settings')
)
SELECT jsonb_build_object(
    'checked_at', statement_timestamp(),
    'database_date', current_date,
    'postgres_version', current_setting('server_version'),
    'relation_presence', jsonb_build_object(
        'courses', to_regclass('public.courses') IS NOT NULL,
        'students', to_regclass('public.students') IS NOT NULL,
        'payments', to_regclass('public.payments') IS NOT NULL,
        'receipts', to_regclass('public.receipts') IS NOT NULL,
        'installments', to_regclass('public.installments') IS NOT NULL,
        'settings', to_regclass('public.settings') IS NOT NULL,
        'schema_migrations', to_regclass('public.schema_migrations') IS NOT NULL
    ),
    'row_counts', jsonb_build_object(
        'courses', (SELECT count(*) FROM public.courses),
        'students', (SELECT count(*) FROM public.students),
        'payments', (SELECT count(*) FROM public.payments),
        'receipts', (SELECT count(*) FROM public.receipts),
        'installments', (SELECT count(*) FROM public.installments)
    ),
    'null_and_orphan_references', jsonb_build_object(
        'students_without_course', (SELECT count(*) FROM public.students WHERE course_id IS NULL),
        'students_orphan_course', (SELECT count(*) FROM public.students s LEFT JOIN public.courses c ON c.id=s.course_id WHERE s.course_id IS NOT NULL AND c.id IS NULL),
        'payments_without_student', (SELECT count(*) FROM public.payments WHERE student_id IS NULL),
        'payments_orphan_student', (SELECT count(*) FROM public.payments p LEFT JOIN public.students s ON s.id=p.student_id WHERE p.student_id IS NOT NULL AND s.id IS NULL),
        'receipts_without_payment', (SELECT count(*) FROM public.receipts WHERE payment_id IS NULL),
        'receipts_orphan_payment', (SELECT count(*) FROM public.receipts r LEFT JOIN public.payments p ON p.id=r.payment_id WHERE r.payment_id IS NOT NULL AND p.id IS NULL),
        'installments_without_student', (SELECT count(*) FROM public.installments WHERE student_id IS NULL),
        'installments_orphan_student', (SELECT count(*) FROM public.installments i LEFT JOIN public.students s ON s.id=i.student_id WHERE i.student_id IS NOT NULL AND s.id IS NULL),
        'installments_without_payment', (SELECT count(*) FROM public.installments WHERE payment_id IS NULL),
        'installments_orphan_payment', (SELECT count(*) FROM public.installments i LEFT JOIN public.payments p ON p.id=i.payment_id WHERE i.payment_id IS NOT NULL AND p.id IS NULL)
    ),
    'duplicates_and_fee_checks', jsonb_build_object(
        'duplicate_roll_groups', (SELECT count(*) FROM (SELECT roll_number FROM public.students GROUP BY roll_number HAVING count(*) > 1) d),
        'duplicate_receipt_groups', (SELECT count(*) FROM (SELECT receipt_number FROM public.receipts GROUP BY receipt_number HAVING count(*) > 1) d),
        'discounts_exceeding_fee', (SELECT count(*) FROM public.students WHERE discount > course_fee),
        'students_without_fee', (SELECT count(*) FROM public.students WHERE course_fee IS NULL)
    ),
    'historical_payment_links', jsonb_build_object(
        'unlinked_payments', (SELECT count(*) FROM payment_links WHERE linked_count = 0),
        'exact_single_matches', (SELECT count(*) FROM payment_links WHERE linked_count = 1 AND amount = single_installment_amount),
        'mismatched_single_matches', (SELECT count(*) FROM payment_links WHERE linked_count = 1 AND amount <> single_installment_amount),
        'multiple_installment_links', (SELECT count(*) FROM payment_links WHERE linked_count > 1),
        'payment_total', (SELECT coalesce(sum(amount), 0) FROM payment_links),
        'linked_installment_total', (SELECT coalesce(sum(linked_amount), 0) FROM payment_links)
    ),
    'installment_status_counts', (
        SELECT coalesce(jsonb_object_agg(status, row_count), '{}'::jsonb)
        FROM (SELECT status, count(*) AS row_count FROM public.installments GROUP BY status) s
    ),
    'legacy_public_policies', (SELECT details FROM legacy_policies)
) AS baseline_report;

