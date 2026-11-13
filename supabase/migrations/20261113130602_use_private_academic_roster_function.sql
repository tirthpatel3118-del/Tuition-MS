-- Keep the Data API view security-invoker while exposing only fields returned
-- by a private, authorization-checked function. This avoids a public view that
-- runs with its owner's RLS privileges.
CREATE OR REPLACE FUNCTION private.get_academic_students()
RETURNS TABLE (
    id UUID,
    institute_id UUID,
    course_id UUID,
    batch_id UUID,
    roll_number TEXT,
    full_name TEXT,
    status TEXT,
    admission_date DATE,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

ALTER FUNCTION private.get_academic_students() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.get_academic_students() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_academic_students() TO authenticated;

CREATE OR REPLACE VIEW public.academic_students
WITH (security_barrier = true, security_invoker = true) AS
SELECT * FROM private.get_academic_students();

ALTER VIEW public.academic_students OWNER TO postgres;
REVOKE ALL ON public.academic_students FROM PUBLIC, anon;
GRANT SELECT ON public.academic_students TO authenticated;
