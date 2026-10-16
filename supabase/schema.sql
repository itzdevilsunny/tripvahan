-- ====================================================================
-- TRIPVAHAN POSTGRESQL SCHEMA FOR SUPABASE
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/ykaorzsoajfwuzibmgoo/sql
-- ====================================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'traveller', -- 'traveller', 'operator', 'both'
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
  category TEXT NOT NULL, -- 'Urbania / Tempo', 'Innova Crysta', 'BharatBenz Coach', 'Executive Sedan'
  registration_number TEXT NOT NULL,
  seating_capacity INT NOT NULL,
  luggage_capacity INT NOT NULL,
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
  distance_km INT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  duration TEXT NOT NULL,
  pickup_time TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  travellers_count INT NOT NULL,
  adults_count INT DEFAULT 0,
  seniors_count INT DEFAULT 0,
  luggage_bags INT NOT NULL,
  matched_vehicle_class TEXT NOT NULL,
  indicative_budget_min NUMERIC,
  indicative_budget_max NUMERIC,
  target_budget NUMERIC NOT NULL,
  amenities TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'open', -- 'open', 'bidding', 'confirmed', 'completed', 'cancelled'
  quotes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create quotations table
CREATE TABLE IF NOT EXISTS public.quotations (
  id TEXT PRIMARY KEY,
  trip_request_id TEXT NOT NULL,
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
  base_vehicle_fuel_rate NUMERIC NOT NULL,
  driver_night_allowance NUMERIC NOT NULL,
  tolls_state_permit_taxes NUMERIC NOT NULL,
  total_quote NUMERIC NOT NULL,
  per_person_fare NUMERIC NOT NULL,
  inclusions TEXT[] DEFAULT '{}',
  exclusions TEXT[] DEFAULT '{}',
  validity_hours INT DEFAULT 48,
  operator_note TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  booking_code TEXT NOT NULL UNIQUE,
  trip_request_id TEXT NOT NULL,
  quotation_id TEXT NOT NULL,
  traveler_id TEXT NOT NULL,
  traveler_name TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  vehicle_name TEXT NOT NULL,
  vehicle_reg TEXT NOT NULL,
  circuit_title TEXT NOT NULL,
  duration TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  per_person_amount NUMERIC NOT NULL,
  escrow_status TEXT DEFAULT 'Secured in Escrow',
  journey_status TEXT DEFAULT 'Confirmed', -- 'Confirmed', 'Dispatched', 'Ongoing', 'Completed'
  contract_signed BOOLEAN DEFAULT true,
  pickup_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (RLS) for public prototype demo / or enable with permissive policy:
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for anon / authenticated access
DO $$
BEGIN
  CREATE POLICY "Public Read Profiles" ON public.profiles FOR SELECT USING (true);
  CREATE POLICY "Public Insert Profiles" ON public.profiles FOR INSERT WITH CHECK (true);
  CREATE POLICY "Public Update Profiles" ON public.profiles FOR UPDATE USING (true);

  CREATE POLICY "Public Read Vehicles" ON public.vehicles FOR SELECT USING (true);
  CREATE POLICY "Public Insert Vehicles" ON public.vehicles FOR INSERT WITH CHECK (true);
  CREATE POLICY "Public Update Vehicles" ON public.vehicles FOR UPDATE USING (true);

  CREATE POLICY "Public Read TripRequests" ON public.trip_requests FOR SELECT USING (true);
  CREATE POLICY "Public Insert TripRequests" ON public.trip_requests FOR INSERT WITH CHECK (true);
  CREATE POLICY "Public Update TripRequests" ON public.trip_requests FOR UPDATE USING (true);

  CREATE POLICY "Public Read Quotations" ON public.quotations FOR SELECT USING (true);
  CREATE POLICY "Public Insert Quotations" ON public.quotations FOR INSERT WITH CHECK (true);
  CREATE POLICY "Public Update Quotations" ON public.quotations FOR UPDATE USING (true);

  CREATE POLICY "Public Read Bookings" ON public.bookings FOR SELECT USING (true);
  CREATE POLICY "Public Insert Bookings" ON public.bookings FOR INSERT WITH CHECK (true);
  CREATE POLICY "Public Update Bookings" ON public.bookings FOR UPDATE USING (true);
EXCEPTION WHEN others THEN
  NULL;
END $$;
