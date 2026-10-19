-- ====================================================================
-- TRIPVAHAN DATABASE MIGRATION:
-- ATOMIC BOOKING CONFIRMATION, REBOOKING INDEXES & CANCELLATION LIFECYCLE
-- File: supabase/migrations/20261020_atomic_booking_lifecycle.sql
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT SIGN-OFF)
-- ====================================================================
-- Summary:
-- 1. Replaces unconditional 'unique_trip_booking' and 'unique_vehicle_pickup_date'
--    table constraints with concurrency-safe partial unique indexes (excluding
--    'Cancelled' records) so legitimate rebooking after cancellation is possible.
-- 2. Installs public.confirm_booking_transaction(...) for atomic, all-or-nothing
--    booking confirmation, vehicle advisory locking, authoritative quote pricing,
--    and automatic declining of competing quotes in a single transaction.
-- 3. Installs public.cancel_booking_transaction(...) for authorized, atomic
--    journey cancellation and cascade resetting of trip and quotation statuses.
-- 4. Restricts EXECUTE permissions to authenticated and service_role callers.
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. REBOOKING INDEX HARDENING
-- Drop rigid unconditional unique constraints; install partial unique indexes.
-- ====================================================================

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS unique_trip_booking;
DROP INDEX IF EXISTS public.unique_active_trip_booking;
CREATE UNIQUE INDEX unique_active_trip_booking 
  ON public.bookings (trip_request_id) 
  WHERE journey_status IS DISTINCT FROM 'Cancelled';

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS unique_vehicle_pickup_date;
DROP INDEX IF EXISTS public.unique_active_vehicle_pickup_date;
CREATE UNIQUE INDEX unique_active_vehicle_pickup_date 
  ON public.bookings (vehicle_reg, pickup_date) 
  WHERE journey_status IS DISTINCT FROM 'Cancelled';


-- ====================================================================
-- 2. ATOMIC BOOKING CONFIRMATION TRANSACTION
-- ====================================================================

CREATE OR REPLACE FUNCTION public.confirm_booking_transaction(
    p_trip_request_id TEXT,
    p_quotation_id TEXT,
    p_caller_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id TEXT;
    v_trip RECORD;
    v_quote RECORD;
    v_vehicle RECORD;
    v_operator_profile RECORD;
    v_booking_id TEXT;
    v_booking_code TEXT;
    v_start_date DATE;
    v_return_date DATE;
    v_trip_days INT;
    v_created_booking RECORD;
    v_conflict RECORD;
BEGIN
    -- 1. Derive and validate authenticated caller identity
    -- Non-service_role callers are strictly bound to their auth.uid(); p_caller_id is only accepted for service_role
    IF COALESCE(auth.role(), '') = 'service_role' OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
        v_caller_id := COALESCE(
            NULLIF(btrim(p_caller_id), ''),
            auth.uid()::text,
            NULLIF(current_setting('request.jwt.claim.sub', true), '')
        );
    ELSE
        v_caller_id := COALESCE(
            auth.uid()::text,
            NULLIF(current_setting('request.jwt.claim.sub', true), '')
        );
    END IF;

    IF v_caller_id IS NULL OR btrim(v_caller_id) = '' THEN
        RAISE EXCEPTION 'Unauthorized: Authenticated session required to confirm booking'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Lock and retrieve Trip Request
    SELECT * INTO v_trip
    FROM public.trip_requests
    WHERE id = p_trip_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trip request not found'
            USING ERRCODE = 'P0002';
    END IF;

    -- Verify traveller ownership (caller must own the trip, or be service_role)
    IF v_trip.traveler_id IS DISTINCT FROM v_caller_id 
       AND COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role'
       AND COALESCE(auth.role(), '') != 'service_role' THEN
        RAISE EXCEPTION 'Forbidden: You are not authorized to confirm a booking for another traveller''s trip request'
            USING ERRCODE = '42501';
    END IF;

    -- Verify trip status is open/bidding
    IF v_trip.status IN ('confirmed', 'completed') THEN
        RAISE EXCEPTION 'Trip request % has already been booked (Status: %)', v_trip.trip_code, v_trip.status
            USING ERRCODE = '23505';
    END IF;

    IF v_trip.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot book a cancelled trip request'
            USING ERRCODE = '22023';
    END IF;

    -- Check if active non-cancelled booking already exists for this trip
    SELECT id, booking_code INTO v_conflict
    FROM public.bookings
    WHERE trip_request_id = p_trip_request_id
      AND journey_status IS DISTINCT FROM 'Cancelled'
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Trip request already has an active booking (%)', v_conflict.booking_code
            USING ERRCODE = '23505';
    END IF;

    -- 3. Lock and retrieve Quotation
    SELECT * INTO v_quote
    FROM public.quotations
    WHERE id = p_quotation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation record not found'
            USING ERRCODE = 'P0002';
    END IF;

    -- Verify quotation belongs to this trip request
    IF v_quote.trip_request_id IS DISTINCT FROM p_trip_request_id THEN
        RAISE EXCEPTION 'Quotation % does not belong to trip request %', p_quotation_id, p_trip_request_id
            USING ERRCODE = '23503';
    END IF;

    -- Verify quotation status is pending
    IF v_quote.status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'Quotation is not available for booking (Status: %)', v_quote.status
            USING ERRCODE = '22023';
    END IF;

    -- 4. Verify Operator Verification Status
    SELECT * INTO v_operator_profile
    FROM public.profiles
    WHERE id = v_quote.operator_id;

    IF NOT FOUND OR v_operator_profile.verified IS NOT TRUE THEN
        RAISE EXCEPTION 'Operator % is not verified. Unverified operators cannot receive bookings.', v_quote.operator_name
            USING ERRCODE = '42501';
    END IF;

    -- 5. Lock and verify Vehicle Specs
    SELECT * INTO v_vehicle
    FROM public.vehicles
    WHERE id = v_quote.vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle % not found in operator fleet', v_quote.vehicle_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Ensure vehicle belongs to quoting operator
    IF v_vehicle.operator_id IS DISTINCT FROM v_quote.operator_id THEN
        RAISE EXCEPTION 'Vehicle does not belong to quoting operator'
            USING ERRCODE = '42501';
    END IF;

    -- Ensure vehicle capacity satisfies passenger count
    IF v_vehicle.seating_capacity < v_trip.travellers_count THEN
        RAISE EXCEPTION 'Vehicle capacity (% seats) is insufficient for % travellers', 
            v_vehicle.seating_capacity, v_trip.travellers_count
            USING ERRCODE = '22023';
    END IF;

    -- 6. Acquire exclusive transaction advisory lock on Vehicle Registration plate
    PERFORM pg_advisory_xact_lock(hashtext(upper(btrim(v_quote.vehicle_reg))));

    -- 7. Calculate journey date intervals
    v_start_date := COALESCE(
        NULLIF(v_trip.start_date, '')::DATE,
        CURRENT_DATE
    );

    v_trip_days := GREATEST(
        1,
        COALESCE(
            NULLIF(regexp_replace(COALESCE(v_trip.duration, ''), '[^0-9]', '', 'g'), ''),
            '1'
        )::INT
    );

    v_return_date := COALESCE(
        NULLIF(v_trip.end_date, '')::DATE,
        v_start_date + (v_trip_days - 1)
    );

    -- 8. Reject overlapping active non-cancelled bookings for this vehicle
    SELECT b.id, b.booking_code, b.start_date, b.return_date INTO v_conflict
    FROM public.bookings b
    WHERE upper(btrim(b.vehicle_reg)) = upper(btrim(v_quote.vehicle_reg))
      AND b.journey_status IS DISTINCT FROM 'Cancelled'
      AND v_start_date <= COALESCE(b.return_date, b.start_date + (v_trip_days - 1))
      AND v_return_date >= b.start_date
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Vehicle % is already confirmed for booking % covering % to %',
            v_quote.vehicle_reg, v_conflict.booking_code, v_conflict.start_date, v_conflict.return_date
            USING ERRCODE = '23P01';
    END IF;

    -- 9. Insert Booking record with authoritative quotation pricing
    v_booking_id := 'bk_' || floor(extract(epoch from clock_timestamp()) * 1000)::text;
    v_booking_code := 'BK-' || floor(1000 + random() * 9000)::text;

    INSERT INTO public.bookings (
        id,
        booking_code,
        trip_request_id,
        quotation_id,
        traveler_id,
        traveler_name,
        operator_name,
        vehicle_name,
        vehicle_reg,
        circuit_title,
        duration,
        total_amount,
        per_person_amount,
        escrow_status,
        journey_status,
        contract_signed,
        pickup_date,
        start_date,
        return_date,
        created_at
    ) VALUES (
        v_booking_id,
        v_booking_code,
        v_trip.id,
        v_quote.id,
        v_trip.traveler_id,
        v_trip.traveler_name,
        v_quote.operator_name,
        v_quote.vehicle_name,
        v_quote.vehicle_reg,
        v_trip.circuit_title,
        v_trip.duration,
        v_quote.total_quote,       -- Authoritative price directly from quotation
        v_quote.per_person_fare,   -- Authoritative per-person fare
        'Rate Lock Guaranteed',
        'Confirmed',
        true,
        v_trip.start_date,
        v_start_date,
        v_return_date,
        NOW()
    )
    RETURNING * INTO v_created_booking;

    -- 10. Atomically update quotation statuses
    -- Accept the selected quotation
    UPDATE public.quotations
    SET status = 'accepted'
    WHERE id = v_quote.id;

    -- Decline competing quotations for this trip request
    UPDATE public.quotations
    SET status = 'declined'
    WHERE trip_request_id = v_trip.id
      AND id != v_quote.id
      AND status = 'pending';

    -- 11. Atomically update Trip Request status
    UPDATE public.trip_requests
    SET status = 'confirmed'
    WHERE id = v_trip.id;

    RETURN to_jsonb(v_created_booking);
END;
$$;


-- ====================================================================
-- 3. ATOMIC BOOKING CANCELLATION TRANSACTION
-- ====================================================================

CREATE OR REPLACE FUNCTION public.cancel_booking_transaction(
    p_booking_id TEXT,
    p_reason TEXT DEFAULT NULL,
    p_caller_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id TEXT;
    v_booking RECORD;
    v_quote RECORD;
    v_profile RECORD;
    v_is_traveler BOOLEAN;
    v_is_operator BOOLEAN;
    v_is_admin BOOLEAN;
    v_updated_booking RECORD;
BEGIN
    -- 1. Derive caller ID
    -- Non-service_role callers are strictly bound to their auth.uid(); p_caller_id is only accepted for service_role
    IF COALESCE(auth.role(), '') = 'service_role' OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
        v_caller_id := COALESCE(
            NULLIF(btrim(p_caller_id), ''),
            auth.uid()::text,
            NULLIF(current_setting('request.jwt.claim.sub', true), '')
        );
    ELSE
        v_caller_id := COALESCE(
            auth.uid()::text,
            NULLIF(current_setting('request.jwt.claim.sub', true), '')
        );
    END IF;

    IF v_caller_id IS NULL OR btrim(v_caller_id) = '' THEN
        RAISE EXCEPTION 'Unauthorized: Authenticated session required to cancel booking'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Lock and retrieve Booking record
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id
            USING ERRCODE = 'P0002';
    END IF;

    -- State machine terminal checks
    IF v_booking.journey_status = 'Completed' THEN
        RAISE EXCEPTION 'Conflict: Cannot cancel a completed journey'
            USING ERRCODE = '22023';
    END IF;

    IF v_booking.journey_status = 'Cancelled' THEN
        RAISE EXCEPTION 'Conflict: Booking is already cancelled'
            USING ERRCODE = '22023';
    END IF;

    -- 3. Retrieve caller profile to verify role
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = v_caller_id;

    -- Retrieve assigned operator from quotation
    SELECT * INTO v_quote
    FROM public.quotations
    WHERE id = v_booking.quotation_id;

    v_is_traveler := (v_booking.traveler_id = v_caller_id);
    v_is_operator := (FOUND AND v_quote.operator_id = v_caller_id) 
                  OR (v_profile.operator_name IS NOT NULL AND v_profile.operator_name = v_booking.operator_name);
    v_is_admin := (v_profile.role = 'admin') 
               OR (COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role')
               OR (COALESCE(auth.role(), '') = 'service_role');

    IF NOT (v_is_traveler OR v_is_operator OR v_is_admin) THEN
        RAISE EXCEPTION 'Forbidden: You are not authorized to cancel this booking'
            USING ERRCODE = '42501';
    END IF;

    -- 4. Transition booking to Cancelled
    UPDATE public.bookings
    SET journey_status = 'Cancelled'
    WHERE id = v_booking.id
    RETURNING * INTO v_updated_booking;

    -- 5. Cascade reset trip request: return to 'open' to permit rebooking
    IF v_booking.trip_request_id IS NOT NULL THEN
        UPDATE public.trip_requests
        SET status = 'open'
        WHERE id = v_booking.trip_request_id
          AND status = 'confirmed';
    END IF;

    -- 6. Cascade reset quotation: return to 'pending'
    IF v_booking.quotation_id IS NOT NULL THEN
        UPDATE public.quotations
        SET status = 'pending'
        WHERE id = v_booking.quotation_id
          AND status = 'accepted';
    END IF;

    RETURN to_jsonb(v_updated_booking);
END;
$$;


-- ====================================================================
-- 4. RESTRICTED FUNCTION PRIVILEGES (LEAST PRIVILEGE)
-- ====================================================================

REVOKE ALL ON FUNCTION public.confirm_booking_transaction(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_booking_transaction(TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cancel_booking_transaction(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_booking_transaction(TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
