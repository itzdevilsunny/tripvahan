-- ====================================================================
-- TRIPVAHAN SECURITY HARDENING: TIGHTEN RLS DELETE POLICIES
-- Project: ykaorzsoajfwuzibmgoo
-- Purpose: Replace permissive 'USING (true)' DELETE policies with
--          strict authentication and row-ownership checks.
-- ====================================================================

-- 1. Bookings: Only the traveller who made the booking or service_role can delete
DROP POLICY IF EXISTS "Bookings Delete" ON public.bookings;
CREATE POLICY "Bookings Delete" ON public.bookings
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = traveler_id);

-- 2. Trip Requests: Only the traveller who created the request can delete
DROP POLICY IF EXISTS "Trip Requests Delete" ON public.trip_requests;
CREATE POLICY "Trip Requests Delete" ON public.trip_requests
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = traveler_id);

-- 3. Quotations: Only the operator who submitted the quote can delete
DROP POLICY IF EXISTS "Quotations Delete" ON public.quotations;
CREATE POLICY "Quotations Delete" ON public.quotations
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = operator_id);

-- 4. Vehicles: Only the operator who owns the vehicle can delete
DROP POLICY IF EXISTS "Vehicles Delete" ON public.vehicles;
CREATE POLICY "Vehicles Delete" ON public.vehicles
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = operator_id);

-- 5. Profiles: Only the account owner can delete their own profile
DROP POLICY IF EXISTS "Profiles Delete" ON public.profiles;
CREATE POLICY "Profiles Delete" ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = id);
