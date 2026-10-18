-- ====================================================================
-- TRIPVAHAN ADMIN SAFE OPERATOR & FLEET VERIFICATION SCRIPT
-- Execute in Supabase SQL Editor: https://supabase.com/dashboard/project/ykaorzsoajfwuzibmgoo/editor
-- ====================================================================
-- INSTRUCTIONS:
-- 1. Replace 'TARGET_OPERATOR_EMAIL' with the operator's registered email.
-- 2. Replace 'TARGET_VEHICLE_REGISTRATION' with the verified commercial plate (Yellow Board).
-- 3. Run the script. It performs safety assertions before making any changes.
-- ====================================================================

DO $$
DECLARE
  -- >>> SET TARGET OPERATOR DETAILS HERE <<<
  v_target_email TEXT := 'TARGET_OPERATOR_EMAIL@example.com';
  v_target_plate TEXT := 'DL 01 TA 1234';

  v_op_id TEXT;
  v_op_name TEXT;
  v_veh_id TEXT;
  v_veh_name TEXT;
BEGIN
  -- 1. Locate and validate operator profile
  SELECT id, operator_name INTO v_op_id, v_op_name
  FROM public.profiles
  WHERE lower(btrim(email)) = lower(btrim(v_target_email))
    AND role = 'operator';

  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: No operator profile found with email % (or role is not operator)', v_target_email;
  END IF;

  -- 2. Locate and validate that the commercial vehicle belongs to this operator
  SELECT id, name INTO v_veh_id, v_veh_name
  FROM public.vehicles
  WHERE operator_id = v_op_id
    AND upper(btrim(registration_number)) = upper(btrim(v_target_plate));

  IF v_veh_id IS NULL THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: Vehicle with plate % does not exist or does not belong to operator % (ID: %)',
      v_target_plate, v_target_email, v_op_id;
  END IF;

  -- 3. Atomically approve operator profile
  UPDATE public.profiles
  SET verified = true
  WHERE id = v_op_id;

  -- 4. Atomically activate vehicle compliance status
  UPDATE public.vehicles
  SET status = 'Available',
      compliance_status = 'Verified Commercial Fleet'
  WHERE id = v_veh_id;

  -- 5. Confirmation output
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'TRIPVAHAN VERIFICATION SUCCESSFUL';
  RAISE NOTICE 'Operator ID: % (%)', v_op_id, v_op_name;
  RAISE NOTICE 'Verified Vehicle: % - % (Plate: %)', v_veh_id, v_veh_name, v_target_plate;
  RAISE NOTICE 'Operator is now authorized to quote with Verified Badge.';
  RAISE NOTICE '=======================================================';
END;
$$;
