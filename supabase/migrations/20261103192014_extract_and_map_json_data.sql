DO $$
DECLARE
    v_dev_inst UUID := '00000000-0000-0000-0000-000000000001';
    v_batches_json JSONB;
    v_batch JSONB;
    v_fees_json JSONB;
    v_st_batches_json JSONB;
    v_c_id TEXT;
    v_fee_val TEXT;
    v_s_id TEXT;
    v_b_id TEXT;
    v_old_batch_id TEXT;
    v_resolved_uuid UUID;
    v_mapped_course_id UUID;
    v_existing_map_uuid UUID;
    v_numeric_fee NUMERIC(10, 2);
    v_cap INT;
BEGIN
    -- 1. Explicitly Backfill institute_id on ALL Existing Records
    UPDATE public.courses SET institute_id = v_dev_inst WHERE institute_id IS NULL;
    UPDATE public.students SET institute_id = v_dev_inst WHERE institute_id IS NULL;
    UPDATE public.payments SET institute_id = v_dev_inst WHERE institute_id IS NULL;
    UPDATE public.receipts SET institute_id = v_dev_inst WHERE institute_id IS NULL;
    UPDATE public.installments SET institute_id = v_dev_inst WHERE institute_id IS NULL;

    -- 2. Migrate Course Fees from settings (Key = 'course_fees')
    -- If fee is missing, preserve as NULL (Never invent 15000)
    IF to_regclass('public.settings') IS NOT NULL THEN
        EXECUTE 'SELECT value FROM public.settings WHERE key = $1' INTO v_fees_json USING 'course_fees';
    END IF;
    IF v_fees_json IS NOT NULL AND jsonb_typeof(v_fees_json) = 'object' THEN
        FOR v_c_id, v_fee_val IN SELECT * FROM jsonb_each_text(v_fees_json) LOOP
            IF public.try_cast_uuid(v_c_id) IS NOT NULL THEN
                v_numeric_fee := public.try_cast_numeric(v_fee_val);
                IF v_numeric_fee IS NOT NULL AND v_numeric_fee >= 0 THEN
                    UPDATE public.courses 
                    SET course_fee = v_numeric_fee 
                    WHERE id = v_c_id::uuid AND institute_id = v_dev_inst;
                ELSE
                    INSERT INTO public._migration_anomalies (entity_type, entity_identifier, issue_code, issue_description, raw_payload)
                    VALUES ('COURSE_FEE', v_c_id, 'INVALID_FEE_VALUE', 'Course fee value is non-numeric or negative: ' || COALESCE(v_fee_val, 'NULL'), v_fees_json)
                    ON CONFLICT DO NOTHING;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- Log courses with NULL fee for administrative review
    INSERT INTO public._migration_anomalies (entity_type, entity_identifier, issue_code, issue_description)
    SELECT 'COURSE', id::text, 'MISSING_FEE', 'Course fee missing in settings; preserved as NULL'
    FROM public.courses
    WHERE course_fee IS NULL
    ON CONFLICT DO NOTHING;

    -- 3. Migrate Batches with Idempotent Mapping Table
    IF to_regclass('public.settings') IS NOT NULL THEN
        EXECUTE 'SELECT value FROM public.settings WHERE key = $1' INTO v_batches_json USING 'batches';
    END IF;
    IF v_batches_json IS NOT NULL AND jsonb_typeof(v_batches_json) = 'array' THEN
        FOR v_batch IN SELECT * FROM jsonb_array_elements(v_batches_json) LOOP
            v_old_batch_id := v_batch->>'id';

            IF v_old_batch_id IS NULL OR trim(v_old_batch_id) = '' THEN
                INSERT INTO public._migration_anomalies
                    (entity_type, entity_identifier, issue_code, issue_description, raw_payload)
                VALUES
                    ('BATCH', COALESCE(v_batch->>'name', 'unknown'), 'INVALID_BATCH_ID',
                     'Batch has no usable legacy identifier; it was not migrated.', v_batch)
                ON CONFLICT DO NOTHING;
                CONTINUE;
            END IF;
            
            -- Retrieve persisted mapping if already present
            SELECT new_uuid INTO v_existing_map_uuid 
            FROM public._migration_batch_id_map 
            WHERE old_id = v_old_batch_id;

            IF v_existing_map_uuid IS NOT NULL THEN
                v_resolved_uuid := v_existing_map_uuid;
            ELSE
                v_resolved_uuid := public.try_cast_uuid(v_old_batch_id);
                IF v_resolved_uuid IS NULL THEN
                    v_resolved_uuid := gen_random_uuid();
                END IF;
            END IF;

            v_mapped_course_id := public.try_cast_uuid(v_batch->>'courseId');
            IF v_mapped_course_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM public.courses WHERE id = v_mapped_course_id AND institute_id = v_dev_inst
            ) THEN
                v_mapped_course_id := NULL;
            END IF;

            INSERT INTO public._migration_batch_id_map (old_id, new_uuid, batch_name, course_id, migration_status)
            VALUES (
                v_old_batch_id,
                v_resolved_uuid,
                v_batch->>'name',
                v_mapped_course_id,
                CASE WHEN v_mapped_course_id IS NULL THEN 'ORPHAN_NO_COURSE' ELSE 'VALID' END
            ) ON CONFLICT (old_id) DO NOTHING;

            v_cap := COALESCE(public.try_cast_numeric(v_batch->>'capacity')::int, 30);
            IF v_cap <= 0 THEN v_cap := 30; END IF;

            IF v_mapped_course_id IS NOT NULL THEN
                INSERT INTO public.batches (
                    id, institute_id, course_id, name, timing, capacity, course_fee, status
                ) VALUES (
                    v_resolved_uuid,
                    v_dev_inst,
                    v_mapped_course_id,
                    COALESCE(v_batch->>'name', 'General Batch'),
                    COALESCE(v_batch->>'timing', '09:00 AM - 11:00 AM'),
                    v_cap,
                    public.try_cast_numeric(v_batch->>'courseFee'),
                    CASE WHEN v_batch->>'status' = 'Inactive' THEN 'Inactive' ELSE 'Active' END
                ) ON CONFLICT (id) DO NOTHING;
            ELSE
                INSERT INTO public._migration_anomalies (entity_type, entity_identifier, issue_code, issue_description, raw_payload)
                VALUES ('BATCH', v_old_batch_id, 'ORPHAN_BATCH', 'Batch course mapping could not be resolved.', v_batch)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- 4. Migrate Student-Batch Assignments
    IF to_regclass('public.settings') IS NOT NULL THEN
        EXECUTE 'SELECT value FROM public.settings WHERE key = $1' INTO v_st_batches_json USING 'student_batches';
    END IF;
    IF v_st_batches_json IS NOT NULL AND jsonb_typeof(v_st_batches_json) = 'object' THEN
        FOR v_s_id, v_b_id IN SELECT * FROM jsonb_each_text(v_st_batches_json) LOOP
            IF public.try_cast_uuid(v_s_id) IS NOT NULL THEN
                SELECT new_uuid INTO v_resolved_uuid 
                FROM public._migration_batch_id_map 
                WHERE old_id = v_b_id AND migration_status = 'VALID';

                IF v_resolved_uuid IS NOT NULL THEN
                    UPDATE public.students 
                    SET batch_id = v_resolved_uuid 
                    WHERE id = v_s_id::uuid AND institute_id = v_dev_inst;
                ELSE
                    INSERT INTO public._migration_anomalies (entity_type, entity_identifier, issue_code, issue_description)
                    VALUES ('STUDENT_BATCH', v_s_id, 'UNRESOLVED_BATCH', 'Batch identifier ' || COALESCE(v_b_id, 'NULL') || ' not found in mapping.')
                    ON CONFLICT DO NOTHING;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 5. Migrate Settings
    IF to_regclass('public.settings') IS NOT NULL THEN
        EXECUTE 'INSERT INTO public.institute_settings (institute_id, key, value) SELECT $1, key, value FROM public.settings WHERE key = $2 ON CONFLICT (institute_id, key) DO UPDATE SET value = EXCLUDED.value' USING v_dev_inst, 'app_settings';
    END IF;

    -- 6. Initialize Multi-Year Receipt Counter
    INSERT INTO public.institute_receipt_counters (institute_id, year, prefix, last_number)
    SELECT 
        v_dev_inst,
        to_char(now(), 'YYYY'),
        'REC',
        COALESCE(MAX(SUBSTRING(receipt_number FROM '[0-9]+$')::BIGINT), 0)
    FROM public.receipts
    WHERE institute_id = v_dev_inst
    ON CONFLICT (institute_id, year) DO NOTHING;
END $$;

INSERT INTO public.schema_migrations (version, description)
VALUES ('20261104000003', 'Extract JSON settings, backfill tenant records, and map batches')
ON CONFLICT (version) DO NOTHING;

