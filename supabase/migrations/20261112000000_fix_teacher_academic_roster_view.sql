-- Explicit owner-managed teacher-to-batch assignments. This migration replaces
-- the earlier institute-membership-only academic roster predicate; teachers
-- receive no student rows until an owner assigns their user to the student's
-- batch in the same institute.

CREATE TABLE IF NOT EXISTS public.teacher_batch_assignments (
    institute_id UUID NOT NULL,
    batch_id UUID NOT NULL,
    teacher_user_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT pk_teacher_batch_assignments
        PRIMARY KEY (institute_id, batch_id, teacher_user_id),
    CONSTRAINT fk_teacher_batch_assignments_batch
        FOREIGN KEY (institute_id, batch_id)
        REFERENCES public.batches (institute_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_teacher_batch_assignments_teacher
        FOREIGN KEY (institute_id, teacher_user_id)
        REFERENCES public.institute_members (institute_id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_teacher_batch_assignments_teacher
    ON public.teacher_batch_assignments (institute_id, teacher_user_id, batch_id);

ALTER TABLE public.teacher_batch_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teacher_batch_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.teacher_batch_assignments TO authenticated;

CREATE POLICY teacher_batch_assignments_member_select
    ON public.teacher_batch_assignments FOR SELECT TO authenticated
    USING (
        private.is_member_of(institute_id, ARRAY['owner'])
        OR (
            teacher_user_id = auth.uid()
            AND private.is_member_of(institute_id, ARRAY['teacher'])
        )
    );

CREATE POLICY teacher_batch_assignments_owner_insert
    ON public.teacher_batch_assignments FOR INSERT TO authenticated
    WITH CHECK (
        private.is_member_of(institute_id, ARRAY['owner'])
        AND EXISTS (
            SELECT 1
            FROM public.institute_members AS teacher
            WHERE teacher.institute_id = teacher_batch_assignments.institute_id
              AND teacher.user_id = teacher_batch_assignments.teacher_user_id
              AND teacher.role = 'teacher'
        )
    );

CREATE POLICY teacher_batch_assignments_owner_delete
    ON public.teacher_batch_assignments FOR DELETE TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']));

-- Let active teacher workspaces refresh immediately after Owner changes.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
           SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND schemaname = 'public'
             AND tablename = 'teacher_batch_assignments'
       ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_batch_assignments';
    END IF;
END $$;

-- Change the teachers on a batch as one Owner-checked transaction. This is a
-- security-invoker function: the assignment table's RLS policies and grants
-- are enforced for the authenticated caller on every statement.
CREATE OR REPLACE FUNCTION public.set_teacher_batch_assignments(
    p_institute_id UUID,
    p_batch_id UUID,
    p_teacher_user_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_teacher_user_ids UUID[] := COALESCE(p_teacher_user_ids, ARRAY[]::UUID[]);
BEGIN
    IF NOT private.is_member_of(p_institute_id, ARRAY['owner']) THEN
        RAISE EXCEPTION 'Access Denied: Only institute owners can assign teachers to batches.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.batches
        WHERE institute_id = p_institute_id AND id = p_batch_id
    ) THEN
        RAISE EXCEPTION 'Batch not found in this institute.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_teacher_user_ids) AS requested(user_id)
        LEFT JOIN public.institute_members AS teacher
          ON teacher.institute_id = p_institute_id
         AND teacher.user_id = requested.user_id
         AND teacher.role = 'teacher'
        WHERE teacher.user_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Every assigned user must be a teacher in this institute.';
    END IF;

    DELETE FROM public.teacher_batch_assignments AS assignment
    WHERE assignment.institute_id = p_institute_id
      AND assignment.batch_id = p_batch_id
      AND NOT (assignment.teacher_user_id = ANY(v_teacher_user_ids));

    INSERT INTO public.teacher_batch_assignments (institute_id, batch_id, teacher_user_id)
    SELECT p_institute_id, p_batch_id, requested.user_id
    FROM unnest(v_teacher_user_ids) AS requested(user_id)
    ON CONFLICT (institute_id, batch_id, teacher_user_id) DO NOTHING;
END;
$$;

ALTER FUNCTION public.set_teacher_batch_assignments(UUID, UUID, UUID[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_teacher_batch_assignments(UUID, UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_teacher_batch_assignments(UUID, UUID, UUID[]) TO authenticated;

-- The view deliberately bypasses the finance-only students RLS policy, but
-- exposes academic columns only and applies the full authorization predicate
-- before returning any row. The assignment check is tenant-bound and live, so
-- deleting an assignment or changing the member role revokes access at once.
CREATE OR REPLACE VIEW public.academic_students
WITH (security_barrier = true, security_invoker = false) AS
SELECT s.id, s.institute_id, s.course_id, s.batch_id, s.roll_number,
       s.full_name, s.status, s.admission_date, s.created_at
FROM public.students AS s
WHERE private.is_member_of(s.institute_id, ARRAY['owner'])
   OR (
       s.batch_id IS NOT NULL
       AND private.is_member_of(s.institute_id, ARRAY['teacher'])
       AND EXISTS (
           SELECT 1
           FROM public.teacher_batch_assignments AS assignment
           JOIN public.institute_members AS teacher
             ON teacher.institute_id = assignment.institute_id
            AND teacher.user_id = assignment.teacher_user_id
            AND teacher.role = 'teacher'
           WHERE assignment.institute_id = s.institute_id
             AND assignment.batch_id = s.batch_id
             AND assignment.teacher_user_id = auth.uid()
       )
   );

ALTER VIEW public.academic_students OWNER TO postgres;
REVOKE ALL ON public.academic_students FROM PUBLIC, anon;
GRANT SELECT ON public.academic_students TO authenticated;
