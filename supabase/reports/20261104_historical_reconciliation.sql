-- Run after migrations 1-5 on a verified isolated restore.
-- Aggregate-only reconciliation summary; never returns individual student/payment rows.
SELECT
    (SELECT count(*)
     FROM public.payments
     WHERE payment_type = 'PAYMENT') AS total_legacy_payments,
    (SELECT count(DISTINCT pa.payment_id)
     FROM public.payment_allocations AS pa
     WHERE pa.allocation_type = 'CREDIT') AS payments_with_verified_allocations,
    (SELECT count(*)
     FROM public.payments AS p
     WHERE p.payment_type = 'PAYMENT'
       AND NOT EXISTS (
           SELECT 1
           FROM public.payment_allocations AS pa
           WHERE pa.payment_id = p.id
             AND pa.allocation_type = 'CREDIT'
       )) AS payments_without_verified_allocations,
    (SELECT count(*)
     FROM public._migration_anomalies
     WHERE issue_code = 'UNVERIFIED_HISTORICAL_ALLOCATION') AS unverified_payment_anomalies,
    (SELECT count(*)
     FROM public.installments
     WHERE status IN ('Pending', 'Overdue')
       AND legacy_payment_id IS NOT NULL) AS installments_requiring_manual_review,
    (SELECT coalesce(sum(amount), 0)
     FROM public.payments
     WHERE payment_type = 'PAYMENT') AS total_original_payment_amount,
    (SELECT coalesce(sum(allocated_amount), 0)
     FROM public.payment_allocations
     WHERE allocation_type = 'CREDIT') AS total_verified_allocated_amount;

