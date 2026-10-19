-- ====================================================================
-- TRIPVAHAN DATABASE INTEGRITY REPAIR MIGRATION
-- File: 20261019_targeted_security_repair.sql
-- Project: ykaorzsoajfwuzibmgoo
-- Target Database: Supabase PostgreSQL
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT SIGN-OFF)
-- ====================================================================
-- Summary:
-- This migration installs missing database-level invariant protection
-- triggers and functions identified during production catalog inspection:
-- 1. Attaches trg_check_vehicle_updates on public.vehicles.
-- 2. Defines & attaches trg_protect_profile_updates on public.profiles.
-- 3. Defines & attaches trg_protect_quotation_updates on public.quotations.
-- 4. Defines & attaches trg_protect_booking_updates on public.bookings.
-- 5. Defines & attaches trg_protect_trip_request_updates on public.trip_requests.
-- 6. Preserves existing trg_check_vehicle_booking_overlap without modification.
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. PROFILES PROTECTION
-- Invariant: User ID is immutable. Users cannot self-elevate 'verified' status.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.trg_protect_profile_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Prevent altering profile primary key
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile ID is immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Block users from self-elevating verification status
  IF NEW.verified IS DISTINCT FROM OLD.verified AND NEW.verified = true AND OLD.verified = false THEN
    -- Allow only service_role (Admin API / Supabase dashboard) to approve verification
    IF COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role' 
       AND COALESCE(auth.role(), '') != 'service_role' THEN
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


-- ====================================================================
-- 2. VEHICLES PROTECTION
-- Invariant: Operator ID and registration number are immutable.
-- Unverified operators cannot force 'Verified' compliance.
-- Note: Function already existed in production, but had no trigger attached.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.trg_protect_vehicle_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_verified BOOLEAN;
BEGIN
  -- Operator ownership cannot be transferred
  IF NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
    RAISE EXCEPTION 'Vehicle operator_id is immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Commercial registration number cannot be rewritten once registered
  IF NEW.registration_number IS DISTINCT FROM OLD.registration_number AND OLD.registration_number IS NOT NULL THEN
    RAISE EXCEPTION 'Vehicle commercial registration number is immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Validate against verified operator status in profiles
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


-- ====================================================================
-- 3. QUOTATIONS PROTECTION
-- Invariant: Operator and trip linkages are immutable.
-- Agreed total & breakdown prices are locked once quotation is accepted/declined.
-- Status transitions are restricted to known valid states.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.trg_protect_quotation_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Immutability of ownership and target trip linkage
  IF NEW.operator_id IS DISTINCT FROM OLD.operator_id OR NEW.trip_request_id IS DISTINCT FROM OLD.trip_request_id THEN
    RAISE EXCEPTION 'Quotation operator_id and trip_request_id are immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Financial lock: once accepted or declined, financial terms and vehicle cannot be modified
  IF OLD.status IN ('accepted', 'declined') THEN
    IF NEW.total_quote IS DISTINCT FROM OLD.total_quote OR
       NEW.per_person_fare IS DISTINCT FROM OLD.per_person_fare OR
       NEW.base_vehicle_fuel_rate IS DISTINCT FROM OLD.base_vehicle_fuel_rate OR
       NEW.driver_night_allowance IS DISTINCT FROM OLD.driver_night_allowance OR
       NEW.tolls_state_permit_taxes IS DISTINCT FROM OLD.tolls_state_permit_taxes OR
       NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR
       NEW.vehicle_reg IS DISTINCT FROM OLD.vehicle_reg THEN
      RAISE EXCEPTION 'Quotation prices, allowances, and vehicle details are locked once accepted or declined'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Validate status values
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


-- ====================================================================
-- 4. BOOKINGS PROTECTION
-- Invariant: Agreed booking fare, booking code, quotation ID, and trip ID
-- are strictly immutable. Cannot reopen Cancelled or Completed journeys.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.trg_protect_booking_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Immutable financial & relational linkages
  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
     NEW.per_person_amount IS DISTINCT FROM OLD.per_person_amount OR
     NEW.trip_request_id IS DISTINCT FROM OLD.trip_request_id OR
     NEW.quotation_id IS DISTINCT FROM OLD.quotation_id OR
     NEW.traveler_id IS DISTINCT FROM OLD.traveler_id THEN
    RAISE EXCEPTION 'Booking prices, traveler, quotation, and trip linkage are immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Immutable booking code
  IF NEW.booking_code IS DISTINCT FROM OLD.booking_code THEN
    RAISE EXCEPTION 'Booking code is immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Validate journey status transitions
  IF NEW.journey_status IS DISTINCT FROM OLD.journey_status THEN
    IF NEW.journey_status NOT IN ('Confirmed', 'Dispatched', 'Ongoing', 'Completed', 'Cancelled') THEN
      RAISE EXCEPTION 'Invalid journey status: %', NEW.journey_status
        USING ERRCODE = '22023';
    END IF;

    -- Terminal states cannot be reopened
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


-- ====================================================================
-- 5. TRIP REQUESTS PROTECTION
-- Invariant: Traveler ID is immutable. Status transitions are restricted.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.trg_protect_trip_request_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
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
