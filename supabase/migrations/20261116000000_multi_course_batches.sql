-- Allow one teaching batch to contain students from multiple course packages / standards.
-- Keep batches.course_id as the legacy primary course for backwards compatibility.
CREATE TABLE IF NOT EXISTS public.batch_courses (
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL,
  course_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (batch_id, course_id),
  CONSTRAINT batch_courses_batch_tenant_fkey
    FOREIGN KEY (institute_id, batch_id)
    REFERENCES public.batches (institute_id, id) ON DELETE CASCADE,
  CONSTRAINT batch_courses_course_tenant_fkey
    FOREIGN KEY (institute_id, course_id)
    REFERENCES public.courses (institute_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_batch_courses_institute_batch
  ON public.batch_courses (institute_id, batch_id);

CREATE INDEX IF NOT EXISTS idx_batch_courses_institute_course
  ON public.batch_courses (institute_id, course_id);

-- Backfill every existing batch's current single course without changing batch IDs.
INSERT INTO public.batch_courses (institute_id, batch_id, course_id)
SELECT institute_id, id, course_id
FROM public.batches
ON CONFLICT (batch_id, course_id) DO NOTHING;

ALTER TABLE public.batch_courses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.batch_courses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.batch_courses TO authenticated;

-- is_member_of has a default role-array argument, so the one-argument call
-- resolves to the existing (uuid, text[]) function.
CREATE POLICY batch_courses_member_select
  ON public.batch_courses FOR SELECT TO authenticated
  USING (private.is_member_of(institute_id));

CREATE POLICY batch_courses_owner_insert
  ON public.batch_courses FOR INSERT TO authenticated
  WITH CHECK (
    private.is_member_of(institute_id, ARRAY['owner'])
  );

CREATE POLICY batch_courses_owner_delete
  ON public.batch_courses FOR DELETE TO authenticated
  USING (private.is_member_of(institute_id, ARRAY['owner']));

INSERT INTO public.schema_migrations (version, description)
VALUES ('20261116000000', 'Support multiple course packages per teaching batch')
ON CONFLICT (version) DO NOTHING;
