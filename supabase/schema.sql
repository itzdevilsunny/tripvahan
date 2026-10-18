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
  escrow_status TEXT DEFAULT 'Secured in Escrow',
  journey_status TEXT DEFAULT 'Confirmed', -- 'Confirmed', 'Dispatched', 'Ongoing', 'Completed', 'Cancelled'
  contract_signed BOOLEAN DEFAULT true,
  pickup_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Database constraint 1: A trip request can only be confirmed once
  CONSTRAINT unique_trip_booking UNIQUE (trip_request_id),
  -- Database constraint 2: A vehicle cannot be double-booked on the same pickup date
  CONSTRAINT unique_vehicle_pickup_date UNIQUE (vehicle_reg, pickup_date)
);

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
CREATE POLICY "Public Profiles Read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Self Profile Insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id OR auth.uid() IS NULL);
CREATE POLICY "Self Profile Update" ON public.profiles FOR UPDATE USING (auth.uid()::text = id OR auth.uid() IS NULL);

-- 2. Vehicles RLS
DROP POLICY IF EXISTS "Public Vehicles Read" ON public.vehicles;
DROP POLICY IF EXISTS "Operator Vehicle Insert" ON public.vehicles;
DROP POLICY IF EXISTS "Operator Vehicle Update" ON public.vehicles;
CREATE POLICY "Public Vehicles Read" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "Operator Vehicle Insert" ON public.vehicles FOR INSERT WITH CHECK (auth.uid()::text = operator_id OR auth.uid() IS NULL);
CREATE POLICY "Operator Vehicle Update" ON public.vehicles FOR UPDATE USING (auth.uid()::text = operator_id OR auth.uid() IS NULL);

-- 3. Trip Requests RLS
DROP POLICY IF EXISTS "Public Trip Requests Read" ON public.trip_requests;
DROP POLICY IF EXISTS "Traveler Trip Insert" ON public.trip_requests;
DROP POLICY IF EXISTS "Traveler Trip Update" ON public.trip_requests;
CREATE POLICY "Public Trip Requests Read" ON public.trip_requests FOR SELECT USING (true);
CREATE POLICY "Traveler Trip Insert" ON public.trip_requests FOR INSERT WITH CHECK (auth.uid()::text = traveler_id OR auth.uid() IS NULL);
CREATE POLICY "Traveler Trip Update" ON public.trip_requests FOR UPDATE USING (auth.uid()::text = traveler_id OR auth.uid() IS NULL);

-- 4. Quotations RLS
DROP POLICY IF EXISTS "Public Quotations Read" ON public.quotations;
DROP POLICY IF EXISTS "Operator Quote Insert" ON public.quotations;
DROP POLICY IF EXISTS "Operator Quote Update" ON public.quotations;
CREATE POLICY "Public Quotations Read" ON public.quotations FOR SELECT USING (true);
CREATE POLICY "Operator Quote Insert" ON public.quotations FOR INSERT WITH CHECK (auth.uid()::text = operator_id OR auth.uid() IS NULL);
CREATE POLICY "Operator Quote Update" ON public.quotations FOR UPDATE USING (auth.uid()::text = operator_id OR auth.uid() IS NULL);

-- 5. Bookings RLS
DROP POLICY IF EXISTS "Public Bookings Read" ON public.bookings;
DROP POLICY IF EXISTS "Traveler Booking Insert" ON public.bookings;
DROP POLICY IF EXISTS "Traveler Booking Update" ON public.bookings;
CREATE POLICY "Public Bookings Read" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "Traveler Booking Insert" ON public.bookings FOR INSERT WITH CHECK (auth.uid()::text = traveler_id OR auth.uid() IS NULL);
CREATE POLICY "Traveler Booking Update" ON public.bookings FOR UPDATE USING (auth.uid()::text = traveler_id OR auth.uid() IS NULL);
