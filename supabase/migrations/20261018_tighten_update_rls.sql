-- ====================================================================
-- TRIPVAHAN DATABASE SECURITY MIGRATION:
-- TIGHTEN ALL UPDATE RLS POLICIES & ENFORCE INVARIANT BUSINESS RULES
-- Project: ykaorzsoajfwuzibmgoo
-- Target Database: Supabase PostgreSQL
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. HARDEN RLS UPDATE POLICIES (ELIMINATE 'OR auth.uid() IS NULL')
-- ====================================================================

-- 1.1 Profiles: Only authenticated user can update their own profile
DROP POLICY IF EXISTS "Self Profile Update" ON public.profiles;
CREATE POLICY "Self Profile Update" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- 1.2 Vehicles: Only authenticated operator can update their own vehicles
DROP POLICY IF EXISTS "Operator Vehicle Update" ON public.vehicles;
CREATE POLICY "Operator Vehicle Update" ON public.vehicles
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = operator_id)
  WITH CHECK (auth.uid()::text = operator_id);

-- 1.3 Trip Requests: Authenticated traveller or valid status transitions
DROP POLICY IF EXISTS "Traveler Trip Update" ON public.trip_requests;
CREATE POLICY "Traveler Trip Update" ON public.trip_requests
  FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid()::text = traveler_id)
    OR
    (status IN ('open', 'bidding', 'confirmed', 'completed', 'cancelled'))
  )
  WITH CHECK (
    status IN ('open', 'bidding', 'confirmed', 'completed', 'cancelled')
  );

-- 1.4 Quotations: Authenticated operator or valid quotation status transitions
DROP POLICY IF EXISTS "Operator Quote Update" ON public.quotations;
CREATE POLICY "Operator Quote Update" ON public.quotations
  FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid()::text = operator_id)
    OR
    (status IN ('pending', 'accepted', 'declined', 'expired'))
  )
  WITH CHECK (
    status IN ('pending', 'accepted', 'declined', 'expired')
  );

-- 1.5 Bookings: Authenticated traveller or valid journey status transitions
DROP POLICY IF EXISTS "Traveler Booking Update" ON public.bookings;
CREATE POLICY "Traveler Booking Update" ON public.bookings
  FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid()::text = traveler_id)
    OR
    (journey_status IN ('Confirmed', 'Dispatched', 'Ongoing', 'Completed', 'Cancelled'))
  )
  WITH CHECK (
    journey_status IN ('Confirmed', 'Dispatched', 'Ongoing', 'Completed', 'Cancelled')
  );


-- ====================================================================
-- 2. DATABASE INVARIANT ENFORCEMENT TRIGGERS (LEAST PRIVILEGE)
-- ====================================================================

-- 2.1 Profiles: Prevent users from self-approving verification
CREATE OR REPLACE FUNCTION public.trg_protect_profile_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prevent modifying profile ID
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile ID is immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Block users from self-elevating verification status
  IF NEW.verified IS DISTINCT FROM OLD.verified AND NEW.verified = true AND OLD.verified = false THEN
    -- Only service_role or admin can approve verification
    IF COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role' AND auth.role() != 'service_role' THEN
      RAISE EXCEPTION 'Unauthorized: Profile verification can only be approved by platform administrators'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_profile_updates ON public.profiles;
CREATE TRIGGER trg_check_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_profile_updates();


-- 2.2 Vehicles: Prevent transferring ownership or faking verified compliance
CREATE OR REPLACE FUNCTION public.trg_protect_vehicle_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_verified BOOLEAN;
BEGIN
  -- Vehicle ownership cannot be transferred
  IF NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
    RAISE EXCEPTION 'Vehicle operator_id is immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Plate registration number cannot be changed once recorded
  IF NEW.registration_number IS DISTINCT FROM OLD.registration_number AND OLD.registration_number IS NOT NULL THEN
    RAISE EXCEPTION 'Vehicle commercial registration number is immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Ensure vehicle status cannot be Available if operator is not verified
  SELECT verified INTO v_is_verified
  FROM public.profiles
  WHERE id = NEW.operator_id;

  IF v_is_verified IS NOT TRUE THEN
    NEW.status := 'Pending Verification';
    NEW.compliance_status := 'Pending Operator Verification';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_vehicle_updates ON public.vehicles;
CREATE TRIGGER trg_check_vehicle_updates
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_vehicle_updates();


-- 2.3 Quotations: Prevent altering agreed prices once accepted/declined
CREATE OR REPLACE FUNCTION public.trg_protect_quotation_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Quotation ownership and trip binding cannot change
  IF NEW.operator_id IS DISTINCT FROM OLD.operator_id OR NEW.trip_request_id IS DISTINCT FROM OLD.trip_request_id THEN
    RAISE EXCEPTION 'Quotation operator_id and trip_request_id are immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Once accepted or declined, prices and vehicle cannot be modified
  IF OLD.status IN ('accepted', 'declined') THEN
    IF NEW.total_quote IS DISTINCT FROM OLD.total_quote OR
       NEW.per_person_fare IS DISTINCT FROM OLD.per_person_fare OR
       NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR
       NEW.vehicle_reg IS DISTINCT FROM OLD.vehicle_reg THEN
      RAISE EXCEPTION 'Quotation prices and vehicle details are locked once accepted or declined'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Enforce valid status transitions
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('pending', 'accepted', 'declined', 'expired') THEN
      RAISE EXCEPTION 'Invalid quotation status: %', NEW.status
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_quotation_updates ON public.quotations;
CREATE TRIGGER trg_check_quotation_updates
BEFORE UPDATE ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_quotation_updates();


-- 2.4 Bookings: Financial amounts and linkages are strictly immutable
CREATE OR REPLACE FUNCTION public.trg_protect_booking_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Financial amounts, trip request, and quotation linkages cannot be altered
  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
     NEW.per_person_amount IS DISTINCT FROM OLD.per_person_amount OR
     NEW.trip_request_id IS DISTINCT FROM OLD.trip_request_id OR
     NEW.quotation_id IS DISTINCT FROM OLD.quotation_id THEN
    RAISE EXCEPTION 'Booking prices, quotation, and trip linkage are immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Prevent altering booking code
  IF NEW.booking_code IS DISTINCT FROM OLD.booking_code THEN
    RAISE EXCEPTION 'Booking code is immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Validate journey_status transitions
  IF NEW.journey_status IS DISTINCT FROM OLD.journey_status THEN
    IF NEW.journey_status NOT IN ('Confirmed', 'Dispatched', 'Ongoing', 'Completed', 'Cancelled') THEN
      RAISE EXCEPTION 'Invalid journey status: %', NEW.journey_status
        USING ERRCODE = '22023';
    END IF;

    -- Cannot reopen a Cancelled or Completed booking
    IF OLD.journey_status IN ('Cancelled', 'Completed') AND NEW.journey_status NOT IN ('Cancelled', 'Completed') THEN
      RAISE EXCEPTION 'Cannot reopen a % booking', OLD.journey_status
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_booking_updates ON public.bookings;
CREATE TRIGGER trg_check_booking_updates
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_booking_updates();


-- 2.5 Trip Requests: Prevent altering traveler_id and validate statuses
CREATE OR REPLACE FUNCTION public.trg_protect_trip_request_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Traveler ownership cannot change
  IF NEW.traveler_id IS DISTINCT FROM OLD.traveler_id THEN
    RAISE EXCEPTION 'Trip request traveler_id is immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Validate status transitions
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('open', 'bidding', 'confirmed', 'completed', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid trip request status: %', NEW.status
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_trip_request_updates ON public.trip_requests;
CREATE TRIGGER trg_check_trip_request_updates
BEFORE UPDATE ON public.trip_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_trip_request_updates();

COMMIT;
