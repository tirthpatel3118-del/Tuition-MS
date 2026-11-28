BEGIN;

ALTER TABLE private.website_inquiries
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE OR REPLACE FUNCTION public.platform_admin_demo_update_request(
  p_inquiry_id uuid, p_status text, p_admin_notes text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_reference text;
BEGIN
  PERFORM private.require_platform_admin();
  IF p_status NOT IN ('reviewing','approved','rejected')
    OR char_length(COALESCE(p_admin_notes,'')) > 4000 THEN
    RAISE EXCEPTION 'Invalid demo request update.';
  END IF;

  UPDATE private.website_inquiries
  SET status=p_status,
      admin_notes=COALESCE(p_admin_notes,''),
      approved_at=CASE
        WHEN p_status='approved' THEN now()
        WHEN p_status='rejected' THEN NULL
        ELSE approved_at
      END,
      updated_at=now()
  WHERE id=p_inquiry_id AND enquiry_type='Product demo'
  RETURNING reference_code INTO v_reference;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demo request not found.'; END IF;

  IF p_status='rejected' THEN
    UPDATE private.website_demo_access
    SET revoked_at=COALESCE(revoked_at,now())
    WHERE inquiry_id=p_inquiry_id AND revoked_at IS NULL;
  END IF;

  INSERT INTO private.website_demo_audit(inquiry_id,actor_id,action,details)
  VALUES (
    p_inquiry_id,auth.uid(),
    CASE p_status WHEN 'reviewing' THEN 'REQUEST_REVIEWING'
      WHEN 'approved' THEN 'REQUEST_APPROVED' ELSE 'REQUEST_REJECTED' END,
    jsonb_build_object('status',p_status,'has_internal_note',char_length(COALESCE(p_admin_notes,''))>0)
  );
  INSERT INTO private.website_notifications(
    notification_type,related_type,related_id,reference_code,title,message
  )
  VALUES (
    'inquiry_status_changed','inquiry',p_inquiry_id,v_reference,
    'Demo request updated','Demo request status changed to ' || p_status || '.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_demo_issue_access(p_inquiry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_token text;
  v_access_id uuid;
  v_reference text;
  v_status text;
  v_approved_at timestamptz;
  v_link_expiry timestamptz;
BEGIN
  PERFORM private.require_platform_admin();
  SELECT reference_code,status,approved_at
    INTO v_reference,v_status,v_approved_at
  FROM private.website_inquiries
  WHERE id=p_inquiry_id AND enquiry_type='Product demo'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demo request not found.'; END IF;
  IF v_status NOT IN ('approved','link_generated') OR v_approved_at IS NULL THEN
    RAISE EXCEPTION 'Approve this demo request before generating access.';
  END IF;

  v_link_expiry := v_approved_at + interval '48 hours';
  IF v_link_expiry <= now() THEN
    RAISE EXCEPTION 'The 48-hour approval window has expired. Review and approve this request again before issuing a new link.';
  END IF;

  UPDATE private.website_demo_access
  SET revoked_at=COALESCE(revoked_at,now())
  WHERE inquiry_id=p_inquiry_id AND revoked_at IS NULL;

  v_token := encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO private.website_demo_access(
    inquiry_id,token_hash,link_expires_at,duration_minutes,created_by
  )
  VALUES (
    p_inquiry_id,encode(extensions.digest(v_token,'sha256'),'hex'),
    v_link_expiry,20,v_actor
  )
  RETURNING id INTO v_access_id;

  UPDATE private.website_inquiries
  SET status='link_generated',updated_at=now()
  WHERE id=p_inquiry_id;

  INSERT INTO private.website_demo_audit(inquiry_id,demo_access_id,actor_id,action,details)
  VALUES (
    p_inquiry_id,v_access_id,v_actor,'LINK_ISSUED',
    jsonb_build_object('link_expires_at',v_link_expiry,'duration_minutes',20)
  );
  INSERT INTO private.website_notifications(
    notification_type,related_type,related_id,reference_code,title,message
  )
  VALUES (
    'inquiry_status_changed','inquiry',p_inquiry_id,v_reference,
    'Demo access link generated','A private demo invitation link was generated.'
  );

  RETURN jsonb_build_object(
    'access_id',v_access_id,'token',v_token,
    'link_expires_at',v_link_expiry,'duration_minutes',20
  );
END;
$function$;

COMMIT;