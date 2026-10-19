-- ====================================================================
-- TRIPVAHAN DATABASE MIGRATION:
-- PERSISTENT OPERATOR VERIFICATION AUDIT TRAIL & ATOMIC REVIEW TRANSACTION
-- File: supabase/migrations/20261020_operator_verification_audit.sql
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT SIGN-OFF)
-- ====================================================================
-- Summary:
-- 1. Creates public.operator_verification_audit table for permanent, immutable
--    historical recording of operator verification decisions.
-- 2. Enforces Row-Level Security (RLS) restricting read access strictly to
--    administrators and service_role, and prevents modifications/deletions.
-- 3. Installs public.verify_operator_transaction(...) stored procedure for
--    atomic, all-or-nothing operator approval/rejection and audit insertion.
-- 4. Restricts EXECUTE permissions to authenticated and service_role callers.
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. OPERATOR VERIFICATION SCHEMA PREREQUISITES & AUDIT TABLE
-- ====================================================================

-- Ensure compliance tracking columns exist on profiles table
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS decided_by TEXT;

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

-- Indexes for rapid operational queries and admin inspection
CREATE INDEX IF NOT EXISTS idx_operator_audit_operator_id 
    ON public.operator_verification_audit(operator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operator_audit_admin_id 
    ON public.operator_verification_audit(admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operator_audit_action_created 
    ON public.operator_verification_audit(action, created_at DESC);

-- ====================================================================
-- 2. ROW-LEVEL SECURITY & ACCESS CONTROLS
-- Audit records are protected from ordinary users and operators.
-- ====================================================================

ALTER TABLE public.operator_verification_audit ENABLE ROW LEVEL SECURITY;

-- SELECT: Only verified platform administrators and service_role may inspect audit records
DROP POLICY IF EXISTS "Admins can view operator verification audit logs" ON public.operator_verification_audit;
CREATE POLICY "Admins can view operator verification audit logs"
    ON public.operator_verification_audit
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
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

-- IMMUTABILITY PROTECTION: Audit records are append-only.
-- Hard prevent UPDATE and DELETE by ordinary users, operators, and authenticated roles.
REVOKE UPDATE, DELETE ON public.operator_verification_audit FROM PUBLIC, authenticated;


-- ====================================================================
-- 3. ATOMIC OPERATOR VERIFICATION TRANSACTION FUNCTION
-- ====================================================================

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
    -- 1. Derive authenticated caller ID
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
        RAISE EXCEPTION 'Unauthorized: Authenticated administrator session required'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Verify caller is an active platform administrator
    SELECT * INTO v_admin
    FROM public.profiles
    WHERE id = v_caller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: Administrator profile not found'
            USING ERRCODE = '42501';
    END IF;

    IF v_admin.role IS DISTINCT FROM 'admin' 
       AND COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role'
       AND COALESCE(auth.role(), '') != 'service_role' THEN
        RAISE EXCEPTION 'Forbidden: Platform administrator role required to perform operator verification'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Self-approval guard: Admins cannot verify their own operator accounts
    IF v_caller_id = p_operator_id THEN
        RAISE EXCEPTION 'Forbidden: Platform administrators cannot verify or modify their own operator account'
            USING ERRCODE = '42501';
    END IF;

    -- 4. Lock and retrieve operator profile
    SELECT * INTO v_operator
    FROM public.profiles
    WHERE id = p_operator_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Operator profile not found: %', p_operator_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Normalize action
    v_action_norm := lower(btrim(p_action));
    v_previous_state := COALESCE(v_operator.verified, false);
    v_clean_reason := NULLIF(btrim(p_reason), '');
    v_clean_notes := NULLIF(btrim(p_notes), '');

    IF v_action_norm = 'approve' THEN
        v_new_state := true;
        v_clean_reason := NULL;
    ELSIF v_action_norm = 'reject' THEN
        v_new_state := false;
        IF v_clean_reason IS NULL THEN
            RAISE EXCEPTION 'A specific statutory rejection reason is mandatory when declining an operator'
                USING ERRCODE = '22023';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid verification action "%". Allowed values: approve, reject'
            USING ERRCODE = '22023';
    END IF;

    -- 5. Update Operator Profile
    UPDATE public.profiles
    SET verified = v_new_state,
        rejection_reason = v_clean_reason,
        decided_at = NOW(),
        decided_by = COALESCE(v_admin.full_name, v_admin.email, 'Platform Administrator')
    WHERE id = p_operator_id;

    -- 6. Update associated fleet compliance status
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

    -- 7. Insert permanent audit record
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
        v_caller_id,
        COALESCE(v_admin.full_name, 'Platform Administrator'),
        v_admin.email,
        CASE WHEN v_new_state = true THEN 'approved' ELSE 'rejected' END,
        v_previous_state,
        v_new_state,
        v_clean_reason,
        v_clean_notes,
        p_correlation_id,
        NOW()
    )
    RETURNING * INTO v_audit_entry;

    -- Return JSON payload of the transaction result
    RETURN jsonb_build_object(
        'success', true,
        'action', CASE WHEN v_new_state = true THEN 'approved' ELSE 'rejected' END,
        'operator_id', p_operator_id,
        'previous_state', v_previous_state,
        'new_state', v_new_state,
        'audit_entry', to_jsonb(v_audit_entry)
    );
END;
$$;


-- ====================================================================
-- 4. RESTRICTED FUNCTION PRIVILEGES (LEAST PRIVILEGE)
-- ====================================================================

REVOKE ALL ON FUNCTION public.verify_operator_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_operator_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
