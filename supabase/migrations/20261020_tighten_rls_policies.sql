-- ====================================================================
-- TRIPVAHAN DATABASE SECURITY MIGRATION:
-- ELIMINATE PERMISSIVE RLS CONDITIONS & ENFORCE STRICT ROW OWNERSHIP
-- File: supabase/migrations/20261020_tighten_rls_policies.sql
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT SIGN-OFF)
-- ====================================================================
-- Summary:
-- This migration hardens all Row Level Security (RLS) policies by:
-- 1. Eliminating anonymous insert bypasses ('OR auth.uid() IS NULL')
--    across profiles, vehicles, trip_requests, quotations, and bookings.
-- 2. Eliminating status-based universal update bypasses ('OR status IN (...)')
--    which previously permitted any user to mutate other users' records.
-- 3. Requiring authenticated identity and explicit row-level ownership
--    matching auth.uid() on all INSERT and UPDATE operations.
-- 4. Preserving public read access on marketplace listings where intended.
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. PROFILES TABLE RLS POLICIES
-- ====================================================================

-- 1.1 INSERT: Only authenticated user can create their own profile
DROP POLICY IF EXISTS "Self Profile Insert" ON public.profiles;
CREATE POLICY "Self Profile Insert" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = id);

-- 1.2 UPDATE: Only account owner can update their own profile
DROP POLICY IF EXISTS "Self Profile Update" ON public.profiles;
CREATE POLICY "Self Profile Update" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- 1.3 INTEGRITY TRIGGER: Block self-privilege escalation to admin or verified status
CREATE OR REPLACE FUNCTION public.protect_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF COALESCE(auth.role(), '') != 'service_role' THEN
        -- Case 1: Caller modifying their own profile (self-privilege escalation strictly forbidden)
        IF auth.uid()::text = NEW.id THEN
            IF NEW.role IS DISTINCT FROM OLD.role THEN
                RAISE EXCEPTION 'Forbidden: You cannot modify your own platform role' USING ERRCODE = '42501';
            END IF;
            IF NEW.verified IS DISTINCT FROM OLD.verified THEN
                RAISE EXCEPTION 'Forbidden: You cannot modify your own verification status' USING ERRCODE = '42501';
            END IF;
        ELSE
            -- Case 2: Modifying someone else's profile (requires platform administrator role)
            IF NOT EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid()::text AND role = 'admin'
            ) THEN
                RAISE EXCEPTION 'Forbidden: Administrator privileges required to modify user verification or role' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_privilege_escalation();


-- ====================================================================
-- 2. VEHICLES TABLE RLS POLICIES
-- ====================================================================

-- 2.1 INSERT: Only authenticated operator can register their fleet vehicles
DROP POLICY IF EXISTS "Operator Vehicle Insert" ON public.vehicles;
CREATE POLICY "Operator Vehicle Insert" ON public.vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = operator_id);

-- 2.2 UPDATE: Only the vehicle's owning operator can update vehicle specs
DROP POLICY IF EXISTS "Operator Vehicle Update" ON public.vehicles;
CREATE POLICY "Operator Vehicle Update" ON public.vehicles
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = operator_id)
  WITH CHECK (auth.uid()::text = operator_id);


-- ====================================================================
-- 3. TRIP REQUESTS TABLE RLS POLICIES
-- ====================================================================

-- 3.1 INSERT: Only authenticated traveller can submit a trip request
DROP POLICY IF EXISTS "Traveler Trip Insert" ON public.trip_requests;
CREATE POLICY "Traveler Trip Insert" ON public.trip_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = traveler_id);

-- 3.2 UPDATE: Only the trip owner can modify their trip request
-- (Removes the permissive 'OR status IN (...)' loophole)
DROP POLICY IF EXISTS "Traveler Trip Update" ON public.trip_requests;
CREATE POLICY "Traveler Trip Update" ON public.trip_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = traveler_id)
  WITH CHECK (
    auth.uid()::text = traveler_id
    AND status IN ('open', 'bidding', 'confirmed', 'completed', 'cancelled')
  );


-- ====================================================================
-- 4. QUOTATIONS TABLE RLS POLICIES
-- ====================================================================

-- 4.1 INSERT: Only authenticated operator can submit a quote under their own ID
DROP POLICY IF EXISTS "Operator Quote Insert" ON public.quotations;
CREATE POLICY "Operator Quote Insert" ON public.quotations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = operator_id);

-- 4.2 UPDATE: Only the submitting operator can update their quote
-- (Removes the permissive 'OR status IN (...)' loophole)
DROP POLICY IF EXISTS "Operator Quote Update" ON public.quotations;
CREATE POLICY "Operator Quote Update" ON public.quotations
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = operator_id)
  WITH CHECK (
    auth.uid()::text = operator_id
    AND status IN ('pending', 'accepted', 'declined', 'expired')
  );


-- ====================================================================
-- 5. BOOKINGS TABLE RLS POLICIES
-- ====================================================================

-- 5.1 INSERT: Only authenticated traveller can confirm a booking under their own ID
DROP POLICY IF EXISTS "Traveler Booking Insert" ON public.bookings;
CREATE POLICY "Traveler Booking Insert" ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = traveler_id);

-- 5.2 UPDATE: Only the booking traveller can update their booking record
-- (Removes the permissive 'OR journey_status IN (...)' loophole)
DROP POLICY IF EXISTS "Traveler Booking Update" ON public.bookings;
CREATE POLICY "Traveler Booking Update" ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = traveler_id)
  WITH CHECK (
    auth.uid()::text = traveler_id
    AND journey_status IN ('Confirmed', 'Dispatched', 'Ongoing', 'Completed', 'Cancelled')
  );

COMMIT;
