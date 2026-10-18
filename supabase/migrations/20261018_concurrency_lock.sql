-- ====================================================================
-- TRIPVAHAN PRODUCTION DATABASE MIGRATION:
-- CONCURRENCY-SAFE OVERLAPPING BOOKING LOCK & ENFORCEMENT
-- Project: ykaorzsoajfwuzibmgoo
-- Target Database: Supabase PostgreSQL
-- ====================================================================

-- 1. Ensure start_date and return_date columns exist in public.bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS return_date DATE;

-- 2. Concurrency-Safe Overlapping Booking Trigger with Transaction Advisory Lock
CREATE OR REPLACE FUNCTION trg_prevent_vehicle_booking_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_conflict RECORD;
  v_days INT;
BEGIN
  -- Acquire an exclusive transaction advisory lock on the vehicle registration.
  -- This serializes all concurrent inserts/updates for the SAME vehicle registration
  -- across ALL distributed serverless lambda instances and containers worldwide.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.vehicle_reg));

  -- Determine start_date and return_date
  v_start := COALESCE(NEW.start_date, NEW.pickup_date::date, CURRENT_DATE);
  v_days := GREATEST(1, COALESCE(NULLIF(regexp_replace(NEW.duration, '[^0-9]', '', 'g'), ''), '1')::INT);
  v_end := COALESCE(NEW.return_date, v_start + (v_days - 1));

  NEW.start_date := v_start;
  NEW.return_date := v_end;

  -- Check for existing active overlapping bookings for the same vehicle
  -- (Now holding the lock, so any transaction that just committed will be visible)
  SELECT id, booking_code, pickup_date, duration, start_date, return_date INTO v_conflict
  FROM public.bookings
  WHERE vehicle_reg = NEW.vehicle_reg
    AND journey_status != 'Cancelled'
    AND id != NEW.id
    AND (
      v_start <= COALESCE(return_date, (pickup_date::date + GREATEST(0, COALESCE(NULLIF(regexp_replace(duration, '[^0-9]', '', 'g'), ''), '1')::INT - 1)))
      AND
      v_end >= COALESCE(start_date, pickup_date::date)
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Vehicle % is already confirmed for booking % covering % to %. Overlapping multi-day reservations are prohibited.',
      NEW.vehicle_reg, v_conflict.booking_code, COALESCE(v_conflict.start_date, v_conflict.pickup_date::date), COALESCE(v_conflict.return_date, (v_conflict.pickup_date::date + GREATEST(0, COALESCE(NULLIF(regexp_replace(v_conflict.duration, '[^0-9]', '', 'g'), ''), '1')::INT - 1)))
      USING ERRCODE = '23P01'; -- PostgreSQL exclusion_violation
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_vehicle_booking_overlap ON public.bookings;
CREATE TRIGGER trg_check_vehicle_booking_overlap
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_vehicle_booking_overlap();

-- 3. RLS Delete Policy for bookings and related tables
DROP POLICY IF EXISTS "Bookings Delete" ON public.bookings;
CREATE POLICY "Bookings Delete" ON public.bookings FOR DELETE USING (true);

DROP POLICY IF EXISTS "Trip Requests Delete" ON public.trip_requests;
CREATE POLICY "Trip Requests Delete" ON public.trip_requests FOR DELETE USING (true);

DROP POLICY IF EXISTS "Quotations Delete" ON public.quotations;
CREATE POLICY "Quotations Delete" ON public.quotations FOR DELETE USING (true);

DROP POLICY IF EXISTS "Vehicles Delete" ON public.vehicles;
CREATE POLICY "Vehicles Delete" ON public.vehicles FOR DELETE USING (true);

DROP POLICY IF EXISTS "Profiles Delete" ON public.profiles;
CREATE POLICY "Profiles Delete" ON public.profiles FOR DELETE USING (true);
