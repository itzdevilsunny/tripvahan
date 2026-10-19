-- ====================================================================
-- TRIPVAHAN DATABASE MIGRATION: PHASE 2 COMPLETE SECURITY & LIFECYCLE ROLLOUT
-- File: supabase/migrations/20261020_phase2_complete_security_rollout.sql
-- Status: VERIFIED & AUDITED (Ready for execution on Staging)
-- ====================================================================
-- This single migration applies all Phase 2 security enhancements:
-- 1. Tightens RLS policies across all tables and installs profile integrity triggers.
-- 2. Installs rebooking partial unique indexes (excluding Cancelled records).
-- 3. Installs public.confirm_booking_transaction and public.cancel_booking_transaction.
-- 4. Ensures compliance tracking columns on profiles and creates operator_verification_audit.
-- 5. Installs public.verify_operator_transaction for atomic operator verification.
-- 6. Creates public.operator_documents table and configures private storage bucket policies.
-- 7. Installs public.review_operator_document_transaction for atomic document reviews.
-- ====================================================================

BEGIN;

-- ====================================================================
-- PART 1: PUBLIC.PROFILES RLS & PRIVILEGE ESCALATION PROTECTION
-- ====================================================================

-- 1.1 Ensure compliance & audit tracking columns exist on profiles
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS decided_by TEXT;

-- 1.2 Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Self Profile Insert" ON public.profiles;
CREATE POLICY "Self Profile Insert" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = id);

DROP POLICY IF EXISTS "Self Profile Update" ON public.profiles;
CREATE POLICY "Self Profile Update" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- 1.3 Trigger: Block self-privilege escalation to admin or verified status
CREATE OR REPLACE FUNCTION public.protect_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Profile ID is strictly immutable
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Profile ID is immutable' USING ERRCODE = '42501';
    END IF;

    IF COALESCE(auth.role(), '') != 'service_role' THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Forbidden: You cannot modify your own platform role' USING ERRCODE = '42501';
        END IF;
        IF NEW.verified IS DISTINCT FROM OLD.verified THEN
            RAISE EXCEPTION 'Forbidden: You cannot modify your own verification status' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Clean up older conflicting trigger if present, then attach unified trigger
DROP TRIGGER IF EXISTS trg_check_profile_updates ON public.profiles;
DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_privilege_escalation();


-- ====================================================================
-- PART 2: VEHICLES, TRIPS, QUOTATIONS & BOOKINGS RLS HARDENING
-- ====================================================================

-- Vehicles RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operator Vehicle Insert" ON public.vehicles;
CREATE POLICY "Operator Vehicle Insert" ON public.vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = operator_id);

DROP POLICY IF EXISTS "Operator Vehicle Update" ON public.vehicles;
CREATE POLICY "Operator Vehicle Update" ON public.vehicles
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = operator_id)
  WITH CHECK (auth.uid()::text = operator_id);

-- Trip Requests RLS
ALTER TABLE public.trip_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Traveler Trip Insert" ON public.trip_requests;
CREATE POLICY "Traveler Trip Insert" ON public.trip_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = traveler_id);

DROP POLICY IF EXISTS "Traveler Trip Update" ON public.trip_requests;
CREATE POLICY "Traveler Trip Update" ON public.trip_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = traveler_id)
  WITH CHECK (
    auth.uid()::text = traveler_id
    AND status IN ('open', 'bidding', 'confirmed', 'completed', 'cancelled')
  );

-- Quotations RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operator Quote Insert" ON public.quotations;
CREATE POLICY "Operator Quote Insert" ON public.quotations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = operator_id);

DROP POLICY IF EXISTS "Operator Quote Update" ON public.quotations;
CREATE POLICY "Operator Quote Update" ON public.quotations
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = operator_id)
  WITH CHECK (
    auth.uid()::text = operator_id
    AND status IN ('pending', 'accepted', 'declined', 'expired')
  );

-- Bookings RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Traveler Booking Insert" ON public.bookings;
CREATE POLICY "Traveler Booking Insert" ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = traveler_id);

DROP POLICY IF EXISTS "Traveler Booking Update" ON public.bookings;
CREATE POLICY "Traveler Booking Update" ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = traveler_id)
  WITH CHECK (
    auth.uid()::text = traveler_id
    AND journey_status IN ('Confirmed', 'Dispatched', 'Ongoing', 'Completed', 'Cancelled')
  );


-- ====================================================================
-- PART 3: REBOOKING CONSTRAINTS & ATOMIC BOOKING LIFECYCLE
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

-- Atomic Confirmation Transaction Function
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

    SELECT * INTO v_trip
    FROM public.trip_requests
    WHERE id = p_trip_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trip request not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_trip.traveler_id IS DISTINCT FROM v_caller_id 
       AND COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role'
       AND COALESCE(auth.role(), '') != 'service_role' THEN
        RAISE EXCEPTION 'Forbidden: You are not authorized to confirm a booking for another traveller''s trip request'
            USING ERRCODE = '42501';
    END IF;

    IF v_trip.status IN ('confirmed', 'completed') THEN
        RAISE EXCEPTION 'Trip request % has already been booked (Status: %)', v_trip.trip_code, v_trip.status
            USING ERRCODE = '23505';
    END IF;

    IF v_trip.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot book a cancelled trip request' USING ERRCODE = '22023';
    END IF;

    SELECT id, booking_code INTO v_conflict
    FROM public.bookings
    WHERE trip_request_id = p_trip_request_id
      AND journey_status IS DISTINCT FROM 'Cancelled'
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Trip request already has an active booking (%)', v_conflict.booking_code
            USING ERRCODE = '23505';
    END IF;

    SELECT * INTO v_quote
    FROM public.quotations
    WHERE id = p_quotation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation record not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_quote.trip_request_id IS DISTINCT FROM p_trip_request_id THEN
        RAISE EXCEPTION 'Quotation % does not belong to trip request %', p_quotation_id, p_trip_request_id
            USING ERRCODE = '23503';
    END IF;

    IF v_quote.status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'Quotation is not available for booking (Status: %)', v_quote.status
            USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_operator_profile
    FROM public.profiles
    WHERE id = v_quote.operator_id;

    IF NOT FOUND OR v_operator_profile.verified IS NOT TRUE THEN
        RAISE EXCEPTION 'Operator % is not verified. Unverified operators cannot receive bookings.', v_quote.operator_name
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_vehicle
    FROM public.vehicles
    WHERE id = v_quote.vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle specification record not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_vehicle.seating_capacity < v_trip.travellers_count THEN
        RAISE EXCEPTION 'Vehicle seating capacity (%) is insufficient for travellers count (%)',
            v_vehicle.seating_capacity, v_trip.travellers_count
            USING ERRCODE = '22023';
    END IF;

    v_start_date := COALESCE(NULLIF(v_trip.start_date, '')::DATE, CURRENT_DATE);
    v_trip_days := GREATEST(1,
        COALESCE(
            NULLIF(regexp_replace(COALESCE(v_trip.duration, ''), '[^0-9]', '', 'g'), ''),
            '1'
        )::INT
    );

    v_return_date := COALESCE(
        NULLIF(v_trip.end_date, '')::DATE,
        v_start_date + (v_trip_days - 1)
    );

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
        upper(btrim(v_quote.vehicle_reg)),
        v_trip.circuit_title,
        v_trip.duration,
        v_quote.total_quote,
        v_quote.per_person_fare,
        'Rate Lock Guaranteed',
        'Confirmed',
        true,
        v_start_date,
        v_start_date,
        v_return_date,
        NOW()
    ) RETURNING * INTO v_created_booking;

    UPDATE public.quotations
    SET status = 'accepted'
    WHERE id = v_quote.id;

    UPDATE public.quotations
    SET status = 'declined'
    WHERE trip_request_id = v_trip.id
      AND id != v_quote.id
      AND status = 'pending';

    UPDATE public.trip_requests
    SET status = 'confirmed'
    WHERE id = v_trip.id;

    RETURN to_jsonb(v_created_booking);
END;
$$;

-- Atomic Cancellation Transaction Function
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

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.journey_status = 'Completed' THEN
        RAISE EXCEPTION 'Conflict: Cannot cancel a completed journey' USING ERRCODE = '22023';
    END IF;

    IF v_booking.journey_status = 'Cancelled' THEN
        RAISE EXCEPTION 'Conflict: Booking is already in Cancelled state' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_booking.quotation_id IS NOT NULL THEN
        SELECT * INTO v_quote
        FROM public.quotations
        WHERE id = v_booking.quotation_id;
    END IF;

    v_is_traveler := (v_booking.traveler_id = v_caller_id);
    v_is_operator := (v_quote.operator_id IS NOT NULL AND v_quote.operator_id = v_caller_id);
    v_is_admin := (
        v_profile.role = 'admin'
        OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
        OR COALESCE(auth.role(), '') = 'service_role'
    );

    IF NOT (v_is_traveler OR v_is_operator OR v_is_admin) THEN
        RAISE EXCEPTION 'Forbidden: You are not authorized to cancel booking %', p_booking_id
            USING ERRCODE = '42501';
    END IF;

    UPDATE public.bookings
    SET journey_status = 'Cancelled'
    WHERE id = p_booking_id
    RETURNING * INTO v_updated_booking;

    IF v_booking.trip_request_id IS NOT NULL THEN
        UPDATE public.trip_requests
        SET status = 'open'
        WHERE id = v_booking.trip_request_id
          AND status = 'confirmed';
    END IF;

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
-- PART 4: OPERATOR VERIFICATION AUDIT & ATOMIC REVIEW
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.operator_verification_audit (
    id TEXT PRIMARY KEY,
    operator_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    operator_name TEXT NOT NULL,
    admin_id TEXT NOT NULL REFERENCES public.profiles(id),
    admin_name TEXT,
    admin_email TEXT,
    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'suspended', 'revoked')),
    previous_state BOOLEAN,
    new_state BOOLEAN NOT NULL,
    decision_reason TEXT,
    notes TEXT,
    correlation_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operator_audit_operator_id 
    ON public.operator_verification_audit(operator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operator_audit_admin_id 
    ON public.operator_verification_audit(admin_id, created_at DESC);

ALTER TABLE public.operator_verification_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view operator verification audit logs" ON public.operator_verification_audit;
CREATE POLICY "Admins can view operator verification audit logs"
    ON public.operator_verification_audit
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()::text
              AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Service role full access on operator verification audit" ON public.operator_verification_audit;
CREATE POLICY "Service role full access on operator verification audit"
    ON public.operator_verification_audit
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

REVOKE UPDATE, DELETE ON public.operator_verification_audit FROM PUBLIC, authenticated;

-- Atomic Operator Verification Transaction
CREATE OR REPLACE FUNCTION public.verify_operator_transaction(
    p_operator_id TEXT,
    p_action TEXT,
    p_reason TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_caller_id TEXT DEFAULT NULL,
    p_correlation_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id TEXT;
    v_admin RECORD;
    v_operator RECORD;
    v_previous_state BOOLEAN;
    v_new_state BOOLEAN;
    v_audit_id TEXT;
    v_action_norm TEXT;
    v_audit_entry RECORD;
    v_clean_reason TEXT;
    v_clean_notes TEXT;
BEGIN
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
        RAISE EXCEPTION 'Unauthorized: Authenticated administrator session required'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_admin
    FROM public.profiles
    WHERE id = v_caller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: Administrator profile not found' USING ERRCODE = '42501';
    END IF;

    IF v_admin.role IS DISTINCT FROM 'admin' 
       AND COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role'
       AND COALESCE(auth.role(), '') != 'service_role' THEN
        RAISE EXCEPTION 'Forbidden: Platform administrator role required to perform operator verification'
            USING ERRCODE = '42501';
    END IF;

    IF v_caller_id = p_operator_id THEN
        RAISE EXCEPTION 'Forbidden: Platform administrators cannot verify or modify their own operator account'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_operator
    FROM public.profiles
    WHERE id = p_operator_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Operator profile not found: %', p_operator_id USING ERRCODE = 'P0002';
    END IF;

    v_action_norm := lower(btrim(p_action));
    v_previous_state := v_operator.verified;
    v_clean_reason := NULLIF(btrim(p_reason), '');
    v_clean_notes := NULLIF(btrim(p_notes), '');

    IF v_action_norm IN ('approve', 'approved') THEN
        v_new_state := true;
        v_clean_reason := NULL;
    ELSIF v_action_norm IN ('reject', 'rejected', 'revoke', 'revoked', 'suspend', 'suspended') THEN
        v_new_state := false;
        IF v_clean_reason IS NULL THEN
            RAISE EXCEPTION 'A specific statutory rejection reason is mandatory when declining an operator'
                USING ERRCODE = '22023';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid verification action "%". Allowed values: approve, reject', p_action
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.profiles
    SET verified = v_new_state,
        rejection_reason = v_clean_reason,
        decided_at = NOW(),
        decided_by = COALESCE(v_admin.full_name, v_admin.email, 'Platform Administrator')
    WHERE id = p_operator_id;

    IF v_new_state = true THEN
        UPDATE public.vehicles
        SET compliance_status = 'Verified Commercial Fleet',
            status = 'Available'
        WHERE operator_id = p_operator_id;
    ELSE
        UPDATE public.vehicles
        SET compliance_status = 'Compliance Rejected: ' || v_clean_reason,
            status = 'Pending Verification'
        WHERE operator_id = p_operator_id;
    END IF;

    v_audit_id := 'aud_' || floor(extract(epoch from clock_timestamp()) * 1000)::text;

    INSERT INTO public.operator_verification_audit (
        id,
        operator_id,
        operator_name,
        admin_id,
        admin_name,
        admin_email,
        action,
        previous_state,
        new_state,
        decision_reason,
        notes,
        correlation_id,
        created_at
    ) VALUES (
        v_audit_id,
        p_operator_id,
        COALESCE(v_operator.operator_name, v_operator.full_name, 'Operator'),
        v_admin.id,
        COALESCE(v_admin.full_name, 'Admin User'),
        v_admin.email,
        CASE WHEN v_new_state = true THEN 'approved' ELSE 'rejected' END,
        v_previous_state,
        v_new_state,
        v_clean_reason,
        v_clean_notes,
        p_correlation_id,
        NOW()
    ) RETURNING * INTO v_audit_entry;

    RETURN jsonb_build_object(
        'success', true,
        'operator_id', p_operator_id,
        'action', CASE WHEN v_new_state = true THEN 'approved' ELSE 'rejected' END,
        'verified', v_new_state,
        'previous_state', v_previous_state,
        'rejection_reason', v_clean_reason,
        'decided_at', NOW(),
        'audit_id', v_audit_id
    );
END;
$$;


-- ====================================================================
-- PART 5: OPERATOR DOCUMENTS & PRIVATE STORAGE BUCKET POLICIES
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.operator_documents (
    id TEXT PRIMARY KEY,
    operator_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE SET NULL,
    doc_type TEXT NOT NULL CHECK (doc_type IN (
        'commercial_rc',
        'tourist_permit',
        'fitness_cert',
        'commercial_insurance',
        'puc_cert',
        'driver_license',
        'other'
    )),
    title TEXT NOT NULL,
    doc_number TEXT,
    issuing_authority TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INT NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
    mime_type TEXT NOT NULL CHECK (mime_type IN (
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
    )),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    issue_date DATE,
    expiry_date DATE,
    reviewed_by TEXT REFERENCES public.profiles(id),
    reviewer_name TEXT,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP INDEX IF EXISTS public.unique_active_operator_doc;
CREATE UNIQUE INDEX unique_active_operator_doc 
    ON public.operator_documents (operator_id, doc_type) 
    WHERE status IN ('approved', 'pending');

ALTER TABLE public.operator_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators can view their own document metadata" ON public.operator_documents;
CREATE POLICY "Operators can view their own document metadata"
    ON public.operator_documents
    FOR SELECT
    TO authenticated
    USING (
        operator_id = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()::text
              AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Operators can insert their own document metadata" ON public.operator_documents;
CREATE POLICY "Operators can insert their own document metadata"
    ON public.operator_documents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        operator_id = auth.uid()::text
        AND status = 'pending'
        AND reviewed_by IS NULL
        AND reviewed_at IS NULL
    );

DROP POLICY IF EXISTS "Admins can update document review status" ON public.operator_documents;
CREATE POLICY "Admins can update document review status"
    ON public.operator_documents
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()::text
              AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Service role full access on operator documents" ON public.operator_documents;
CREATE POLICY "Service role full access on operator documents"
    ON public.operator_documents
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Configure Private Storage Bucket 'operator-documents'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'operator-documents',
    'operator-documents',
    false,
    5242880,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Operators upload own documents" ON storage.objects;
CREATE POLICY "Operators upload own documents"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'operator-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Operators read own documents" ON storage.objects;
CREATE POLICY "Operators read own documents"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'operator-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Admins read all operator documents" ON storage.objects;
CREATE POLICY "Admins read all operator documents"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'operator-documents'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()::text
              AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Service role storage full access" ON storage.objects;
CREATE POLICY "Service role storage full access"
    ON storage.objects
    FOR ALL
    TO service_role
    USING (bucket_id = 'operator-documents')
    WITH CHECK (bucket_id = 'operator-documents');

-- Atomic Document Review Transaction
CREATE OR REPLACE FUNCTION public.review_operator_document_transaction(
    p_document_id TEXT,
    p_status TEXT,
    p_reason TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_caller_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id TEXT;
    v_admin RECORD;
    v_doc RECORD;
    v_status_norm TEXT;
    v_clean_reason TEXT;
    v_clean_notes TEXT;
    v_updated_doc RECORD;
BEGIN
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
        RAISE EXCEPTION 'Unauthorized: Authenticated administrator session required'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_admin
    FROM public.profiles
    WHERE id = v_caller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Administrator profile not found' USING ERRCODE = '42501';
    END IF;

    IF v_admin.role IS DISTINCT FROM 'admin' 
       AND COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role'
       AND COALESCE(auth.role(), '') != 'service_role' THEN
        RAISE EXCEPTION 'Forbidden: Administrator privileges required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_doc
    FROM public.operator_documents
    WHERE id = p_document_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document record % not found', p_document_id USING ERRCODE = 'P0002';
    END IF;

    IF v_doc.operator_id = v_caller_id THEN
        RAISE EXCEPTION 'Forbidden: Administrators cannot review their own documents' USING ERRCODE = '42501';
    END IF;

    v_status_norm := lower(btrim(p_status));
    v_clean_reason := NULLIF(btrim(p_reason), '');
    v_clean_notes := NULLIF(btrim(p_notes), '');

    IF v_status_norm NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid review status "%". Permitted values: approved, rejected', p_status USING ERRCODE = '22023';
    END IF;

    IF v_status_norm = 'rejected' AND v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A specific rejection reason is mandatory when declining a document' USING ERRCODE = '22023';
    END IF;

    UPDATE public.operator_documents
    SET status = v_status_norm,
        reviewed_by = v_admin.id,
        reviewer_name = COALESCE(v_admin.full_name, 'Platform Administrator'),
        reviewed_at = NOW(),
        rejection_reason = CASE WHEN v_status_norm = 'rejected' THEN v_clean_reason ELSE NULL END,
        reviewer_notes = v_clean_notes,
        updated_at = NOW()
    WHERE id = p_document_id
    RETURNING * INTO v_updated_doc;

    RETURN to_jsonb(v_updated_doc);
END;
$$;

-- Grant EXECUTE permissions to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.confirm_booking_transaction(TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_booking_transaction(TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_operator_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_operator_document_transaction(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
