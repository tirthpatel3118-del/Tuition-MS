ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS expected_fee_due_date date;

COMMENT ON COLUMN public.students.expected_fee_due_date IS
  'Optional expected payment date for direct outstanding fee balances without an installment schedule.';
