-- ====================================================================
-- TRIPVAHAN DATABASE INTEGRITY REPAIR ROLLBACK MIGRATION
-- File: 20261019_rollback_targeted_security_repair.sql
-- Project: Staging & Production Rollback
-- Target Database: Supabase PostgreSQL
-- Purpose: Restores function definitions and trigger state to the exact
--          baseline declared in supabase/schema.sql lines 347-516.
-- ====================================================================

BEGIN;

-- 1. Rollback Profiles Protection Trigger & Function
DROP TRIGGER IF EXISTS trg_check_profile_updates ON public.profiles;

CREATE OR REPLACE FUNCTION public.trg_protect_profile_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile ID is immutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.verified IS DISTINCT FROM OLD.verified AND NEW.verified = true AND OLD.verified = false THEN
    IF COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role' AND auth.role() != 'service_role' THEN
      RAISE EXCEPTION 'Unauthorized: Profile verification can only be approved by platform administrators'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_profile_updates();


-- 2. Rollback Vehicles Protection Trigger & Function
DROP TRIGGER IF EXISTS trg_check_vehicle_updates ON public.vehicles;

CREATE OR REPLACE FUNCTION public.trg_protect_vehicle_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_verified BOOLEAN;
BEGIN
  IF NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
    RAISE EXCEPTION 'Vehicle operator_id is immutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.registration_number IS DISTINCT FROM OLD.registration_number AND OLD.registration_number IS NOT NULL THEN
    RAISE EXCEPTION 'Vehicle commercial registration number is immutable'
      USING ERRCODE = '42501';
  END IF;

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

CREATE TRIGGER trg_check_vehicle_updates
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_vehicle_updates();


-- 3. Rollback Quotations Protection Trigger & Function
DROP TRIGGER IF EXISTS trg_check_quotation_updates ON public.quotations;

CREATE OR REPLACE FUNCTION public.trg_protect_quotation_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.operator_id IS DISTINCT FROM OLD.operator_id OR NEW.trip_request_id IS DISTINCT FROM OLD.trip_request_id THEN
    RAISE EXCEPTION 'Quotation operator_id and trip_request_id are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.status IN ('accepted', 'declined') THEN
    IF NEW.total_quote IS DISTINCT FROM OLD.total_quote OR
       NEW.per_person_fare IS DISTINCT FROM OLD.per_person_fare OR
       NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR
       NEW.vehicle_reg IS DISTINCT FROM OLD.vehicle_reg THEN
      RAISE EXCEPTION 'Quotation prices and vehicle details are locked once accepted or declined'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('pending', 'accepted', 'declined', 'expired') THEN
      RAISE EXCEPTION 'Invalid quotation status: %', NEW.status
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_quotation_updates
BEFORE UPDATE ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_quotation_updates();


-- 4. Rollback Bookings Protection Trigger & Function
DROP TRIGGER IF EXISTS trg_check_booking_updates ON public.bookings;

CREATE OR REPLACE FUNCTION public.trg_protect_booking_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
     NEW.per_person_amount IS DISTINCT FROM OLD.per_person_amount OR
     NEW.trip_request_id IS DISTINCT FROM OLD.trip_request_id OR
     NEW.quotation_id IS DISTINCT FROM OLD.quotation_id THEN
    RAISE EXCEPTION 'Booking prices, quotation, and trip linkage are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.booking_code IS DISTINCT FROM OLD.booking_code THEN
    RAISE EXCEPTION 'Booking code is immutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.journey_status IS DISTINCT FROM OLD.journey_status THEN
    IF NEW.journey_status NOT IN ('Confirmed', 'Dispatched', 'Ongoing', 'Completed', 'Cancelled') THEN
      RAISE EXCEPTION 'Invalid journey status: %', NEW.journey_status
        USING ERRCODE = '22023';
    END IF;

    IF OLD.journey_status IN ('Cancelled', 'Completed') AND NEW.journey_status NOT IN ('Cancelled', 'Completed') THEN
      RAISE EXCEPTION 'Cannot reopen a % booking', OLD.journey_status
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_booking_updates
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_booking_updates();


-- 5. Rollback Trip Requests Protection Trigger & Function
DROP TRIGGER IF EXISTS trg_check_trip_request_updates ON public.trip_requests;

CREATE OR REPLACE FUNCTION public.trg_protect_trip_request_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.traveler_id IS DISTINCT FROM OLD.traveler_id THEN
    RAISE EXCEPTION 'Trip request traveler_id is immutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('open', 'bidding', 'confirmed', 'completed', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid trip request status: %', NEW.status
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_trip_request_updates
BEFORE UPDATE ON public.trip_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_trip_request_updates();

COMMIT;
