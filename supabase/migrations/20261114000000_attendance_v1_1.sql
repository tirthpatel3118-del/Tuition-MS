-- EduLedger attendance v1.1. Additive, tenant-scoped attendance foundation.
-- Existing students.batch_id is retained and backfilled into student_batches.

BEGIN;

CREATE TABLE public.student_batches (
    institute_id UUID NOT NULL,
    student_id UUID NOT NULL,
    batch_id UUID NOT NULL,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (institute_id, student_id, batch_id),
    CONSTRAINT fk_student_batches_student FOREIGN KEY (institute_id, student_id)
        REFERENCES public.students (institute_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_student_batches_batch FOREIGN KEY (institute_id, batch_id)
        REFERENCES public.batches (institute_id, id) ON DELETE CASCADE
);
CREATE INDEX student_batches_batch_idx ON public.student_batches (institute_id, batch_id, student_id);

-- Backfill first; keep batch_id untouched for old clients and rollback compatibility.
INSERT INTO public.student_batches (institute_id, student_id, batch_id)
SELECT s.institute_id, s.id, s.batch_id
FROM public.students AS s
WHERE s.batch_id IS NOT NULL
ON CONFLICT (institute_id, student_id, batch_id) DO NOTHING;
-- Compatibility rule for older clients: a non-NULL legacy batch_id adds a
-- membership and becomes the legacy/default batch; NULL never deletes membership
-- because that scalar field cannot represent the other active batch memberships.
-- Membership inserts/deletes project a deterministic legacy/default batch back
-- to students.batch_id. Trigger-depth guards prevent the two paths recursing.
CREATE OR REPLACE FUNCTION private.sync_legacy_student_batch_membership()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'students' THEN
        IF NEW.batch_id IS NOT NULL THEN
            INSERT INTO public.student_batches (institute_id, student_id, batch_id)
            VALUES (NEW.institute_id, NEW.id, NEW.batch_id)
            ON CONFLICT (institute_id, student_id, batch_id) DO NOTHING;
        ELSE
            -- A legacy NULL cannot mean removal of all memberships; project
            -- the oldest remaining membership back into the legacy field.
            UPDATE public.students AS s
               SET batch_id = (
                   SELECT sb.batch_id FROM public.student_batches AS sb
                   WHERE sb.institute_id = NEW.institute_id AND sb.student_id = NEW.id
                   ORDER BY sb.enrolled_at, sb.batch_id LIMIT 1
               )
             WHERE s.institute_id = NEW.institute_id AND s.id = NEW.id
               AND s.batch_id IS DISTINCT FROM (
                   SELECT sb.batch_id FROM public.student_batches AS sb
                   WHERE sb.institute_id = NEW.institute_id AND sb.student_id = NEW.id
                   ORDER BY sb.enrolled_at, sb.batch_id LIMIT 1
               );
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        UPDATE public.students
           SET batch_id = NEW.batch_id
         WHERE institute_id = NEW.institute_id AND id = NEW.student_id
           AND batch_id IS NULL;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.students AS s
           SET batch_id = (
               SELECT sb.batch_id
               FROM public.student_batches AS sb
               WHERE sb.institute_id = OLD.institute_id AND sb.student_id = OLD.student_id
               ORDER BY sb.enrolled_at, sb.batch_id
               LIMIT 1
           )
         WHERE s.institute_id = OLD.institute_id AND s.id = OLD.student_id
           AND s.batch_id = OLD.batch_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;
ALTER FUNCTION private.sync_legacy_student_batch_membership() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.sync_legacy_student_batch_membership() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER students_sync_legacy_batch_membership
AFTER INSERT OR UPDATE OF batch_id ON public.students
FOR EACH ROW EXECUTE FUNCTION private.sync_legacy_student_batch_membership();
CREATE TRIGGER student_batches_sync_legacy_batch_id
AFTER INSERT OR DELETE ON public.student_batches
FOR EACH ROW EXECUTE FUNCTION private.sync_legacy_student_batch_membership();
CREATE TABLE public.batch_schedule_days (
    institute_id UUID NOT NULL,
    batch_id UUID NOT NULL,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- PostgreSQL DOW: Sunday=0
    starts_at TIME,
    ends_at TIME,
    PRIMARY KEY (institute_id, batch_id, weekday),
    CHECK ((starts_at IS NULL AND ends_at IS NULL) OR
           (starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at)),
    FOREIGN KEY (institute_id, batch_id)
        REFERENCES public.batches (institute_id, id) ON DELETE CASCADE
);

CREATE TABLE public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL,
    student_id UUID NOT NULL,
    batch_id UUID NOT NULL,
    attendance_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Leave')),
    marked_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_attendance_tenant UNIQUE (institute_id, id),
    CONSTRAINT uq_attendance_student_batch_day UNIQUE
        (institute_id, student_id, batch_id, attendance_date),
    FOREIGN KEY (institute_id, student_id, batch_id)
        REFERENCES public.student_batches (institute_id, student_id, batch_id) ON DELETE RESTRICT
);
CREATE INDEX attendance_batch_date_idx
    ON public.attendance_records (institute_id, batch_id, attendance_date);

CREATE TABLE public.attendance_correction_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL,
    attendance_id UUID NOT NULL,
    requested_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    requested_status TEXT NOT NULL CHECK (requested_status IN ('Present', 'Absent', 'Late', 'Leave')),
    request_reason TEXT NOT NULL CHECK (char_length(trim(request_reason)) >= 5),
    decision TEXT NOT NULL DEFAULT 'Pending' CHECK (decision IN ('Pending', 'Approved', 'Rejected')),
    decided_by UUID REFERENCES auth.users (id) ON DELETE RESTRICT,
    decision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    CONSTRAINT uq_attendance_correction_tenant UNIQUE (institute_id, id),
    FOREIGN KEY (institute_id, attendance_id)
        REFERENCES public.attendance_records (institute_id, id) ON DELETE CASCADE,
    CHECK ((decision = 'Pending' AND decided_by IS NULL AND decided_at IS NULL AND decision_reason IS NULL)
        OR (decision IN ('Approved', 'Rejected') AND decided_by IS NOT NULL
            AND decided_at IS NOT NULL AND char_length(trim(decision_reason)) >= 5))
);
CREATE UNIQUE INDEX one_pending_attendance_correction
    ON public.attendance_correction_requests (institute_id, attendance_id)
    WHERE decision = 'Pending';

CREATE TABLE public.attendance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL,
    attendance_id UUID NOT NULL,
    actor_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('MARK', 'OWNER_EDIT', 'CORRECTION_APPROVED')),
    old_status TEXT CHECK (old_status IS NULL OR old_status IN ('Present', 'Absent', 'Late', 'Leave')),
    new_status TEXT NOT NULL CHECK (new_status IN ('Present', 'Absent', 'Late', 'Leave')),
    reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (institute_id, attendance_id)
        REFERENCES public.attendance_records (institute_id, id) ON DELETE RESTRICT
);
CREATE INDEX attendance_audit_tenant_record_idx
    ON public.attendance_audit_logs (institute_id, attendance_id, created_at);

CREATE OR REPLACE FUNCTION private.can_access_attendance_batch(p_institute_id UUID, p_batch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT private.is_member_of(p_institute_id, ARRAY['owner'])
        OR (private.is_member_of(p_institute_id, ARRAY['teacher']) AND EXISTS (
            SELECT 1
            FROM public.teacher_batch_assignments AS a
            JOIN public.institute_members AS m
              ON m.institute_id = a.institute_id AND m.user_id = a.teacher_user_id
             AND m.role = 'teacher'
            WHERE a.institute_id = p_institute_id AND a.batch_id = p_batch_id
              AND a.teacher_user_id = auth.uid()
        ));
$$;
ALTER FUNCTION private.can_access_attendance_batch(UUID, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.can_access_attendance_batch(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_access_attendance_batch(UUID, UUID) TO authenticated;

ALTER TABLE public.student_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_schedule_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.student_batches, public.batch_schedule_days, public.attendance_records,
    public.attendance_correction_requests, public.attendance_audit_logs FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.student_batches TO authenticated;
CREATE POLICY student_batches_select ON public.student_batches FOR SELECT TO authenticated
    USING (private.can_access_attendance_batch(institute_id, batch_id));
CREATE POLICY student_batches_owner_insert ON public.student_batches FOR INSERT TO authenticated
    WITH CHECK (private.is_member_of(institute_id, ARRAY['owner']));
CREATE POLICY student_batches_owner_delete ON public.student_batches FOR DELETE TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_schedule_days TO authenticated;
CREATE POLICY batch_schedule_read ON public.batch_schedule_days FOR SELECT TO authenticated
    USING (private.can_access_attendance_batch(institute_id, batch_id));
CREATE POLICY batch_schedule_owner_insert ON public.batch_schedule_days FOR INSERT TO authenticated
    WITH CHECK (private.is_member_of(institute_id, ARRAY['owner']));
CREATE POLICY batch_schedule_owner_update ON public.batch_schedule_days FOR UPDATE TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']))
    WITH CHECK (private.is_member_of(institute_id, ARRAY['owner']));
CREATE POLICY batch_schedule_owner_delete ON public.batch_schedule_days FOR DELETE TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']));

-- Attendance writes happen only through the checked RPCs below.
GRANT SELECT ON public.attendance_records TO authenticated;
CREATE POLICY attendance_read ON public.attendance_records FOR SELECT TO authenticated
    USING (private.can_access_attendance_batch(institute_id, batch_id));
GRANT SELECT, INSERT ON public.attendance_correction_requests TO authenticated;
CREATE POLICY attendance_correction_read ON public.attendance_correction_requests FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']) OR (requested_by = auth.uid() AND private.is_member_of(institute_id, ARRAY['teacher'])));
CREATE POLICY attendance_correction_teacher_insert ON public.attendance_correction_requests FOR INSERT TO authenticated
    WITH CHECK (
        requested_by = auth.uid()
        AND private.is_member_of(institute_id, ARRAY['teacher'])
        AND decision = 'Pending'
        AND EXISTS (
            SELECT 1 FROM public.attendance_records ar
            WHERE ar.institute_id = attendance_correction_requests.institute_id
              AND ar.id = attendance_correction_requests.attendance_id
              AND private.can_access_attendance_batch(ar.institute_id, ar.batch_id)
        )
    );
GRANT SELECT ON public.attendance_audit_logs TO authenticated;
CREATE POLICY attendance_audit_owner_read ON public.attendance_audit_logs FOR SELECT TO authenticated
    USING (private.is_member_of(institute_id, ARRAY['owner']));

CREATE OR REPLACE FUNCTION public.mark_attendance(
    p_institute_id UUID, p_student_id UUID, p_batch_id UUID,
    p_attendance_date DATE, p_status TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
    IF p_status NOT IN ('Present', 'Absent', 'Late', 'Leave') THEN
        RAISE EXCEPTION 'Invalid attendance status.';
    END IF;
    IF NOT private.can_access_attendance_batch(p_institute_id, p_batch_id) THEN
        RAISE EXCEPTION 'Access denied for this batch.';
    END IF;
    INSERT INTO public.attendance_records (institute_id, student_id, batch_id, attendance_date, status, marked_by)
    VALUES (p_institute_id, p_student_id, p_batch_id, p_attendance_date, p_status, auth.uid())
    RETURNING id INTO v_id;
    INSERT INTO public.attendance_audit_logs
        (institute_id, attendance_id, actor_id, action, old_status, new_status, reason)
    VALUES (p_institute_id, v_id, auth.uid(), 'MARK', NULL, p_status, 'Initial attendance mark');
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_attendance_correction(
    p_institute_id UUID, p_request_id UUID, p_decision TEXT, p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_request public.attendance_correction_requests%ROWTYPE;
        v_old_status TEXT;
BEGIN
    IF NOT private.is_member_of(p_institute_id, ARRAY['owner']) THEN
        RAISE EXCEPTION 'Only an institute owner can decide attendance corrections.';
    END IF;
    IF p_decision NOT IN ('Approved', 'Rejected') OR char_length(trim(COALESCE(p_reason, ''))) < 5 THEN
        RAISE EXCEPTION 'A valid decision and reason of at least five characters are required.';
    END IF;
    SELECT * INTO v_request FROM public.attendance_correction_requests
    WHERE institute_id = p_institute_id AND id = p_request_id FOR UPDATE;
    IF NOT FOUND OR v_request.decision <> 'Pending' THEN
        RAISE EXCEPTION 'Pending correction request not found.';
    END IF;
    IF p_decision = 'Approved' THEN
        SELECT status INTO v_old_status FROM public.attendance_records
        WHERE institute_id = p_institute_id AND id = v_request.attendance_id FOR UPDATE;
        UPDATE public.attendance_records SET status = v_request.requested_status
        WHERE institute_id = p_institute_id AND id = v_request.attendance_id;
        INSERT INTO public.attendance_audit_logs
            (institute_id, attendance_id, actor_id, action, old_status, new_status, reason)
        VALUES (p_institute_id, v_request.attendance_id, auth.uid(), 'CORRECTION_APPROVED',
                v_old_status, v_request.requested_status, p_reason);
    END IF;
    UPDATE public.attendance_correction_requests
       SET decision = p_decision, decided_by = auth.uid(), decision_reason = trim(p_reason), decided_at = now()
     WHERE institute_id = p_institute_id AND id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_edit_attendance(
    p_institute_id UUID, p_attendance_id UUID, p_status TEXT, p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_old_status TEXT;
BEGIN
    IF NOT private.is_member_of(p_institute_id, ARRAY['owner']) THEN
        RAISE EXCEPTION 'Only an institute owner can edit attendance.';
    END IF;
    IF p_status NOT IN ('Present', 'Absent', 'Late', 'Leave') OR char_length(trim(COALESCE(p_reason, ''))) < 5 THEN
        RAISE EXCEPTION 'A valid status and reason of at least five characters are required.';
    END IF;
    SELECT status INTO v_old_status FROM public.attendance_records
    WHERE institute_id = p_institute_id AND id = p_attendance_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Attendance record not found.'; END IF;
    UPDATE public.attendance_records SET status = p_status
    WHERE institute_id = p_institute_id AND id = p_attendance_id;
    INSERT INTO public.attendance_audit_logs
        (institute_id, attendance_id, actor_id, action, old_status, new_status, reason)
    VALUES (p_institute_id, p_attendance_id, auth.uid(), 'OWNER_EDIT', v_old_status, p_status, trim(p_reason));
END;
$$;

ALTER FUNCTION public.mark_attendance(UUID, UUID, UUID, DATE, TEXT) OWNER TO postgres;
ALTER FUNCTION public.decide_attendance_correction(UUID, UUID, TEXT, TEXT) OWNER TO postgres;
ALTER FUNCTION public.owner_edit_attendance(UUID, UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mark_attendance(UUID, UUID, UUID, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_attendance_correction(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_edit_attendance(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_attendance(UUID, UUID, UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_attendance_correction(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_edit_attendance(UUID, UUID, TEXT, TEXT) TO authenticated;

-- Preserve the existing roster columns for client compatibility. Each student
-- is returned once per membership; owners also see unassigned students with a
-- NULL batch_id. Teachers see only rows in currently assigned batches.
CREATE OR REPLACE FUNCTION private.get_academic_students()
RETURNS TABLE (
    id UUID, institute_id UUID, course_id UUID, batch_id UUID, roll_number TEXT,
    full_name TEXT, status TEXT, admission_date DATE, created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT s.id, s.institute_id, s.course_id, sb.batch_id, s.roll_number,
           s.full_name, s.status, s.admission_date, s.created_at
    FROM public.students s
    JOIN public.student_batches sb ON sb.institute_id = s.institute_id AND sb.student_id = s.id
    WHERE private.can_access_attendance_batch(sb.institute_id, sb.batch_id)
    UNION ALL
    SELECT s.id, s.institute_id, s.course_id, NULL::uuid, s.roll_number,
           s.full_name, s.status, s.admission_date, s.created_at
    FROM public.students s
    WHERE private.is_member_of(s.institute_id, ARRAY['owner'])
      AND NOT EXISTS (SELECT 1 FROM public.student_batches sb
                      WHERE sb.institute_id = s.institute_id AND sb.student_id = s.id);
$$;
ALTER FUNCTION private.get_academic_students() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.get_academic_students() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_academic_students() TO authenticated;
CREATE OR REPLACE VIEW public.academic_students
WITH (security_barrier = true, security_invoker = true) AS
SELECT * FROM private.get_academic_students();
ALTER VIEW public.academic_students OWNER TO postgres;
REVOKE ALL ON public.academic_students FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.academic_students TO authenticated;

INSERT INTO public.schema_migrations (version, description)
VALUES ('20261104000009', 'EduLedger v1.1 tenant-scoped attendance and student-batch memberships')
ON CONFLICT (version) DO NOTHING;

COMMIT;
