CREATE INDEX IF NOT EXISTS idx_batch_courses_institute_batch
  ON public.batch_courses (institute_id, batch_id);
