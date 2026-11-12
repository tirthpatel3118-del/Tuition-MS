-- Let the limited academic roster view apply its explicit institute membership
-- predicate before the finance-only students table policy filters its rows.
-- The view owner is postgres; its selected columns and membership condition keep
-- teacher access limited to academic roster data in institutes they belong to.
CREATE OR REPLACE VIEW public.academic_students
WITH (security_barrier = true, security_invoker = false) AS
SELECT s.id, s.institute_id, s.course_id, s.batch_id, s.roll_number,
       s.full_name, s.status, s.admission_date, s.created_at
FROM public.students AS s
WHERE private.is_member_of(s.institute_id);

ALTER VIEW public.academic_students OWNER TO postgres;
REVOKE ALL ON public.academic_students FROM PUBLIC, anon;
GRANT SELECT ON public.academic_students TO authenticated;
