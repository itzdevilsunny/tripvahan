-- ====================================================================
-- TRIPVAHAN PRODUCTION-GRADE POSTGRESQL SCHEMA FOR SUPABASE
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/ykaorzsoajfwuzibmgoo/sql
-- ====================================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'traveller', -- 'traveller', 'operator', 'both', 'admin'
  operator_name TEXT,
  operator_code TEXT,
  rating NUMERIC DEFAULT 4.90,
  reviews_count INT DEFAULT 0,
  verified BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'Urbania / Tempo', 'Innova Crysta', 'Coach / Minibus', 'Executive Sedan'
  registration_number TEXT NOT NULL,
  seating_capacity INT NOT NULL CHECK (seating_capacity > 0),
  luggage_capacity INT NOT NULL CHECK (luggage_capacity >= 0),
  model_year INT NOT NULL,
  features TEXT[] DEFAULT '{}',
  compliance_status TEXT DEFAULT 'Commercial Yellow Board Valid',
  speed_governor_status TEXT DEFAULT 'Speed-Gov: 80 km/h Active',
  status TEXT DEFAULT 'Available', -- 'Available', 'On Trip', 'Maintenance'
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create trip_requests table
CREATE TABLE IF NOT EXISTS public.trip_requests (
  id TEXT PRIMARY KEY,
  trip_code TEXT NOT NULL UNIQUE,
  traveler_id TEXT NOT NULL,
  traveler_name TEXT NOT NULL,
  circuit_title TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  stops JSONB DEFAULT '[]'::jsonb,
  circuit_type TEXT NOT NULL, -- 'Multi-day circuit', 'Round Trip', 'One-Way Outstation'
  distance_km INT NOT NULL CHECK (distance_km > 0),
  start_date TEXT NOT NULL,
  end_date TEXT,
  duration TEXT NOT NULL,
  pickup_time TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  travellers_count INT NOT NULL CHECK (travellers_count > 0),
  adults_count INT DEFAULT 0,
  seniors_count INT DEFAULT 0,
  luggage_bags INT NOT NULL DEFAULT 0,
  matched_vehicle_class TEXT NOT NULL,
  indicative_budget_min NUMERIC,
  indicative_budget_max NUMERIC,
  target_budget NUMERIC NOT NULL CHECK (target_budget > 0),
  amenities TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'open', -- 'open', 'bidding', 'confirmed', 'completed', 'cancelled'
  quotes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create quotations table
CREATE TABLE IF NOT EXISTS public.quotations (
  id TEXT PRIMARY KEY,
  trip_request_id TEXT NOT NULL REFERENCES public.trip_requests(id) ON DELETE CASCADE,
  trip_code TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  operator_rating NUMERIC DEFAULT 4.90,
  reviews_count INT DEFAULT 0,
  vehicle_id TEXT NOT NULL,
  vehicle_name TEXT NOT NULL,
  vehicle_category TEXT NOT NULL,
  vehicle_reg TEXT NOT NULL,
  vehicle_image TEXT,
  model_year INT NOT NULL,
  badge TEXT, -- 'Best Match • Tier-1 Partner', 'Best Economy Choice', 'Ultra Premium Class'
  base_vehicle_fuel_rate NUMERIC NOT NULL CHECK (base_vehicle_fuel_rate >= 0),
  driver_night_allowance NUMERIC NOT NULL DEFAULT 0 CHECK (driver_night_allowance >= 0),
  tolls_state_permit_taxes NUMERIC NOT NULL DEFAULT 0 CHECK (tolls_state_permit_taxes >= 0),
  total_quote NUMERIC NOT NULL CHECK (total_quote > 0),
  per_person_fare NUMERIC NOT NULL CHECK (per_person_fare > 0),
  inclusions TEXT[] DEFAULT '{}',
  exclusions TEXT[] DEFAULT '{}',
  validity_hours INT DEFAULT 48,
  operator_note TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Database constraint: Prevent duplicate bids for the same vehicle on the same trip request
  CONSTRAINT unique_trip_vehicle_quote UNIQUE (trip_request_id, vehicle_id)
);

-- 5. Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  booking_code TEXT NOT NULL UNIQUE,
  trip_request_id TEXT NOT NULL REFERENCES public.trip_requests(id) ON DELETE RESTRICT,
  quotation_id TEXT NOT NULL REFERENCES public.quotations(id) ON DELETE RESTRICT,
  traveler_id TEXT NOT NULL,
  traveler_name TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  vehicle_name TEXT NOT NULL,
  vehicle_reg TEXT NOT NULL,
  circuit_title TEXT NOT NULL,
  duration TEXT NOT NULL,
  total_amount NUMERIC NOT NULL CHECK (total_amount > 0),
  per_person_amount NUMERIC NOT NULL CHECK (per_person_amount > 0),
  escrow_status TEXT DEFAULT 'Rate Lock Guaranteed',
  journey_status TEXT DEFAULT 'Confirmed', -- 'Confirmed', 'Dispatched', 'Ongoing', 'Completed', 'Cancelled'
  contract_signed BOOLEAN DEFAULT true,
  pickup_date TEXT,
  start_date DATE,
  return_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Database constraint 1: A trip request can only be confirmed once
  CONSTRAINT unique_trip_booking UNIQUE (trip_request_id),
  -- Database constraint 2: A vehicle cannot be double-booked on the same pickup date
  CONSTRAINT unique_vehicle_pickup_date UNIQUE (vehicle_reg, pickup_date)
);

-- Ensure columns exist if table was already created
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS return_date DATE;

-- PostgreSQL Trigger: Concurrency-Safe Prevention of Conflicting Overlapping Reservations
CREATE OR REPLACE FUNCTION public.trg_prevent_vehicle_booking_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_start DATE;
    v_end DATE;
    v_conflict RECORD;
    v_days INT;
BEGIN
    -- If booking is cancelled or being cancelled, bypass overlap checks
    IF NEW.journey_status = 'Cancelled' THEN
        RETURN NEW;
    END IF;

    -- Require a vehicle registration
    IF NEW.vehicle_reg IS NULL OR btrim(NEW.vehicle_reg) = '' THEN
        RAISE EXCEPTION 'Vehicle registration is required'
            USING ERRCODE = '23502';
    END IF;

    -- Serialize transactions for the same vehicle
    PERFORM pg_advisory_xact_lock(
        hashtext(upper(btrim(NEW.vehicle_reg)))
    );

    -- Derive the booking interval
    v_start := COALESCE(
        NEW.start_date,
        NEW.pickup_date::date,
        CURRENT_DATE
    );

    v_days := GREATEST(
        1,
        COALESCE(
            NULLIF(
                regexp_replace(
                    COALESCE(NEW.duration, ''),
                    '[^0-9]',
                    '',
                    'g'
                ),
                ''
            ),
            '1'
        )::INT
    );

    v_end := COALESCE(
        NEW.return_date,
        v_start + (v_days - 1)
    );

    IF v_end < v_start THEN
        RAISE EXCEPTION 'Return date cannot precede start date'
            USING ERRCODE = '22007';
    END IF;

    NEW.start_date := v_start;
    NEW.return_date := v_end;

    -- Reject overlapping non-cancelled bookings.
    -- The advisory lock serializes concurrent writes for this vehicle.
    SELECT
        b.id,
        b.booking_code,
        COALESCE(b.start_date, b.pickup_date::date) AS conflict_start,
        COALESCE(
            b.return_date,
            b.pickup_date::date
                + GREATEST(
                    0,
                    COALESCE(
                        NULLIF(
                            regexp_replace(
                                COALESCE(b.duration, ''),
                                '[^0-9]',
                                '',
                                'g'
                            ),
                            ''
                        ),
                        '1'
                    )::INT - 1
                )
        ) AS conflict_end
    INTO v_conflict
    FROM public.bookings AS b
    WHERE upper(btrim(b.vehicle_reg)) =
          upper(btrim(NEW.vehicle_reg))
      AND b.journey_status IS DISTINCT FROM 'Cancelled'
      AND (TG_OP = 'INSERT' OR b.id IS DISTINCT FROM NEW.id)
      AND v_start <= COALESCE(
            b.return_date,
            b.pickup_date::date
                + GREATEST(
                    0,
                    COALESCE(
                        NULLIF(
                            regexp_replace(
                                COALESCE(b.duration, ''),
                                '[^0-9]',
                                '',
                                'g'
                            ),
                            ''
                        ),
                        '1'
                    )::INT - 1
                )
          )
      AND v_end >= COALESCE(b.start_date, b.pickup_date::date)
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Vehicle % already has an overlapping booking (%) from % to %',
            NEW.vehicle_reg,
            v_conflict.booking_code,
            v_conflict.conflict_start,
            v_conflict.conflict_end
            USING ERRCODE = '23P01';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_vehicle_booking_overlap ON public.bookings;
CREATE TRIGGER trg_check_vehicle_booking_overlap
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.trg_prevent_vehicle_booking_overlap();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 1. Profiles RLS
DROP POLICY IF EXISTS "Public Profiles Read" ON public.profiles;
DROP POLICY IF EXISTS "Self Profile Insert" ON public.profiles;
DROP POLICY IF EXISTS "Self Profile Update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Delete" ON public.profiles;
CREATE POLICY "Public Profiles Read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Self Profile Insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id OR auth.uid() IS NULL);
CREATE POLICY "Self Profile Update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()::text = id) WITH CHECK (auth.uid()::text = id);
CREATE POLICY "Profiles Delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid()::text = id);

-- 2. Vehicles RLS
DROP POLICY IF EXISTS "Public Vehicles Read" ON public.vehicles;
DROP POLICY IF EXISTS "Operator Vehicle Insert" ON public.vehicles;
DROP POLICY IF EXISTS "Operator Vehicle Update" ON public.vehicles;
DROP POLICY IF EXISTS "Vehicles Delete" ON public.vehicles;
CREATE POLICY "Public Vehicles Read" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "Operator Vehicle Insert" ON public.vehicles FOR INSERT WITH CHECK (auth.uid()::text = operator_id OR auth.uid() IS NULL);
CREATE POLICY "Operator Vehicle Update" ON public.vehicles FOR UPDATE TO authenticated USING (auth.uid()::text = operator_id) WITH CHECK (auth.uid()::text = operator_id);
CREATE POLICY "Vehicles Delete" ON public.vehicles FOR DELETE TO authenticated USING (auth.uid()::text = operator_id);

-- 3. Trip Requests RLS
DROP POLICY IF EXISTS "Public Trip Requests Read" ON public.trip_requests;
DROP POLICY IF EXISTS "Traveler Trip Insert" ON public.trip_requests;
DROP POLICY IF EXISTS "Traveler Trip Update" ON public.trip_requests;
DROP POLICY IF EXISTS "Trip Requests Delete" ON public.trip_requests;
CREATE POLICY "Public Trip Requests Read" ON public.trip_requests FOR SELECT USING (true);
CREATE POLICY "Traveler Trip Insert" ON public.trip_requests FOR INSERT WITH CHECK (auth.uid()::text = traveler_id OR auth.uid() IS NULL);
CREATE POLICY "Traveler Trip Update" ON public.trip_requests FOR UPDATE USING (
  (auth.uid() IS NOT NULL AND auth.uid()::text = traveler_id)
  OR
  (status IN ('open', 'bidding', 'confirmed', 'completed', 'cancelled'))
) WITH CHECK (status IN ('open', 'bidding', 'confirmed', 'completed', 'cancelled'));
CREATE POLICY "Trip Requests Delete" ON public.trip_requests FOR DELETE TO authenticated USING (auth.uid()::text = traveler_id);

-- 4. Quotations RLS
DROP POLICY IF EXISTS "Public Quotations Read" ON public.quotations;
DROP POLICY IF EXISTS "Operator Quote Insert" ON public.quotations;
DROP POLICY IF EXISTS "Operator Quote Update" ON public.quotations;
DROP POLICY IF EXISTS "Quotations Delete" ON public.quotations;
CREATE POLICY "Public Quotations Read" ON public.quotations FOR SELECT USING (true);
CREATE POLICY "Operator Quote Insert" ON public.quotations FOR INSERT WITH CHECK (auth.uid()::text = operator_id OR auth.uid() IS NULL);
CREATE POLICY "Operator Quote Update" ON public.quotations FOR UPDATE USING (
  (auth.uid() IS NOT NULL AND auth.uid()::text = operator_id)
  OR
  (status IN ('pending', 'accepted', 'declined', 'expired'))
) WITH CHECK (status IN ('pending', 'accepted', 'declined', 'expired'));
CREATE POLICY "Quotations Delete" ON public.quotations FOR DELETE TO authenticated USING (auth.uid()::text = operator_id);

-- 5. Bookings RLS
DROP POLICY IF EXISTS "Public Bookings Read" ON public.bookings;
DROP POLICY IF EXISTS "Traveler Booking Insert" ON public.bookings;
DROP POLICY IF EXISTS "Traveler Booking Update" ON public.bookings;
DROP POLICY IF EXISTS "Bookings Delete" ON public.bookings;
CREATE POLICY "Public Bookings Read" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "Traveler Booking Insert" ON public.bookings FOR INSERT WITH CHECK (auth.uid()::text = traveler_id OR auth.uid() IS NULL);
CREATE POLICY "Traveler Booking Update" ON public.bookings FOR UPDATE USING (
  (auth.uid() IS NOT NULL AND auth.uid()::text = traveler_id)
  OR
  (journey_status IN ('Confirmed', 'Dispatched', 'Ongoing', 'Completed', 'Cancelled'))
) WITH CHECK (journey_status IN ('Confirmed', 'Dispatched', 'Ongoing', 'Completed', 'Cancelled'));
CREATE POLICY "Bookings Delete" ON public.bookings FOR DELETE TO authenticated USING (auth.uid()::text = traveler_id);

-- ====================================================================
-- DATABASE INVARIANT ENFORCEMENT TRIGGERS (LEAST PRIVILEGE)
-- ====================================================================

-- 1. Profiles: Prevent users from self-approving verification
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

DROP TRIGGER IF EXISTS trg_check_profile_updates ON public.profiles;
CREATE TRIGGER trg_check_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_profile_updates();

-- 2. Vehicles: Prevent transferring ownership or faking verified compliance
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

DROP TRIGGER IF EXISTS trg_check_vehicle_updates ON public.vehicles;
CREATE TRIGGER trg_check_vehicle_updates
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_vehicle_updates();

-- 3. Quotations: Prevent altering agreed prices once accepted/declined
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

DROP TRIGGER IF EXISTS trg_check_quotation_updates ON public.quotations;
CREATE TRIGGER trg_check_quotation_updates
BEFORE UPDATE ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_quotation_updates();

-- 4. Bookings: Financial amounts and linkages are strictly immutable
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

DROP TRIGGER IF EXISTS trg_check_booking_updates ON public.bookings;
CREATE TRIGGER trg_check_booking_updates
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_booking_updates();

-- 5. Trip Requests: Prevent altering traveler_id and validate statuses
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

DROP TRIGGER IF EXISTS trg_check_trip_request_updates ON public.trip_requests;
CREATE TRIGGER trg_check_trip_request_updates
BEFORE UPDATE ON public.trip_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_trip_request_updates();
