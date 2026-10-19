-- ====================================================================
-- TRIPVAHAN DATABASE MIGRATION:
-- SECURE OPERATOR DOCUMENT METADATA, PRIVATE STORAGE POLICIES & REVIEW LIFECYCLE
-- File: supabase/migrations/20261020_operator_documents.sql
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT SIGN-OFF)
-- ====================================================================
-- Summary:
-- 1. Creates public.operator_documents metadata table for commercial vehicle
--    registration certificates, tourist permits, speed governor fitness,
--    insurance, and PUC certificates.
-- 2. Enforces partial unique indexes allowing only one active approved or pending
--    document per category per operator while retaining rejected audit history.
-- 3. Configures private Supabase Storage bucket ('operator-documents') and RLS
--    policies restricting uploads and downloads strictly to the owning operator
--    and authorized platform administrators.
-- 4. Installs public.review_operator_document_transaction(...) for atomic
--    review decisions and integrated audit trail logging.
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. OPERATOR DOCUMENTS TABLE
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
    file_size INT NOT NULL CHECK (file_size > 0 AND file_size <= 5242880), -- 5 MB Max
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

-- Partial unique index: At most one pending or approved document of a given type per operator
DROP INDEX IF EXISTS public.unique_active_operator_doc;
CREATE UNIQUE INDEX unique_active_operator_doc 
    ON public.operator_documents (operator_id, doc_type) 
    WHERE status IN ('approved', 'pending');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_operator_docs_operator 
    ON public.operator_documents(operator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operator_docs_vehicle 
    ON public.operator_documents(vehicle_id) 
    WHERE vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operator_docs_status 
    ON public.operator_documents(status);

CREATE INDEX IF NOT EXISTS idx_operator_docs_expiry 
    ON public.operator_documents(expiry_date);


-- ====================================================================
-- 2. ROW-LEVEL SECURITY ON OPERATOR DOCUMENTS TABLE
-- ====================================================================

ALTER TABLE public.operator_documents ENABLE ROW LEVEL SECURITY;

-- SELECT: Operators see only their own documents; Admins see all; Travellers see NONE
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

-- INSERT: Operators can upload metadata only for their own profile with status = 'pending'
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

-- UPDATE: Admins can update status, reason, notes; Operators can update pending docs
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

-- DELETE: Platform admins only
DROP POLICY IF EXISTS "Admins can delete documents" ON public.operator_documents;
CREATE POLICY "Admins can delete documents"
    ON public.operator_documents
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()::text
              AND role = 'admin'
        )
    );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access on operator documents" ON public.operator_documents;
CREATE POLICY "Service role full access on operator documents"
    ON public.operator_documents
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- ====================================================================
-- 3. SUPABASE PRIVATE STORAGE BUCKET CONFIGURATION & POLICIES
-- ====================================================================

-- Bucket registration: private, 5 MB limit, strict mime types
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

-- Storage Policy 1: Operators can upload to their own folder: operator-documents/{operator_id}/*
DROP POLICY IF EXISTS "Operators upload own documents" ON storage.objects;
CREATE POLICY "Operators upload own documents"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'operator-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage Policy 2: Operators can read/download their own documents
DROP POLICY IF EXISTS "Operators read own documents" ON storage.objects;
CREATE POLICY "Operators read own documents"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'operator-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage Policy 3: Platform administrators can view and download all operator documents
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

-- Storage Policy 4: Service role full access
DROP POLICY IF EXISTS "Service role storage full access" ON storage.objects;
CREATE POLICY "Service role storage full access"
    ON storage.objects
    FOR ALL
    TO service_role
    USING (bucket_id = 'operator-documents')
    WITH CHECK (bucket_id = 'operator-documents');


-- ====================================================================
-- 4. ATOMIC DOCUMENT REVIEW & AUDIT TRANSACTION
-- ====================================================================

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
    v_operator RECORD;
    v_new_status TEXT;
    v_clean_reason TEXT;
    v_clean_notes TEXT;
    v_updated_doc RECORD;
    v_audit_id TEXT;
BEGIN
    -- 1. Derive authenticated caller ID
    v_caller_id := COALESCE(
        NULLIF(btrim(p_caller_id), ''),
        auth.uid()::text,
        NULLIF(current_setting('request.jwt.claim.sub', true), '')
    );

    IF v_caller_id IS NULL OR btrim(v_caller_id) = '' THEN
        RAISE EXCEPTION 'Unauthorized: Authenticated administrator session required'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Verify caller has admin role
    SELECT * INTO v_admin
    FROM public.profiles
    WHERE id = v_caller_id;

    IF NOT FOUND OR (v_admin.role IS DISTINCT FROM 'admin'
       AND COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role'
       AND COALESCE(auth.role(), '') != 'service_role') THEN
        RAISE EXCEPTION 'Forbidden: Administrator privileges required to review operator documents'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Lock document record
    SELECT * INTO v_doc
    FROM public.operator_documents
    WHERE id = p_document_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document record % not found', p_document_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Self-approval guard: Admin cannot review their own operator account documents
    IF v_doc.operator_id = v_caller_id THEN
        RAISE EXCEPTION 'Forbidden: Administrators cannot review or approve their own documents'
            USING ERRCODE = '42501';
    END IF;

    -- Normalize review action
    v_new_status := lower(btrim(p_status));
    v_clean_reason := NULLIF(btrim(p_reason), '');
    v_clean_notes := NULLIF(btrim(p_notes), '');

    IF v_new_status = 'approved' THEN
        v_clean_reason := NULL;
    ELSIF v_new_status = 'rejected' THEN
        IF v_clean_reason IS NULL THEN
            RAISE EXCEPTION 'Rejection reason is mandatory when declining an operator document'
                USING ERRCODE = '22023';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid review status "%". Must be approved or rejected', p_status
            USING ERRCODE = '22023';
    END IF;

    -- 4. Update document status
    UPDATE public.operator_documents
    SET status = v_new_status,
        reviewed_by = v_caller_id,
        reviewer_name = COALESCE(v_admin.full_name, v_admin.email, 'Platform Administrator'),
        reviewed_at = NOW(),
        rejection_reason = v_clean_reason,
        reviewer_notes = v_clean_notes,
        updated_at = NOW()
    WHERE id = v_doc.id
    RETURNING * INTO v_updated_doc;

    -- 5. Append entry to operator_verification_audit
    v_audit_id := 'aud_doc_' || floor(extract(epoch from clock_timestamp()) * 1000)::text;

    SELECT * INTO v_operator
    FROM public.profiles
    WHERE id = v_doc.operator_id;

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
        v_doc.operator_id,
        COALESCE(v_operator.operator_name, v_operator.full_name, 'Operator'),
        v_caller_id,
        COALESCE(v_admin.full_name, 'Platform Administrator'),
        v_admin.email,
        v_new_status,
        (v_doc.status = 'approved'),
        (v_new_status = 'approved'),
        v_clean_reason,
        '[Document Review: ' || v_doc.title || '] ' || COALESCE(v_clean_notes, ''),
        'doc_review_' || v_doc.id,
        NOW()
    );

    RETURN to_jsonb(v_updated_doc);
END;
$$;

-- Restricted Function Execution
REVOKE ALL ON FUNCTION public.review_operator_document_transaction(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_operator_document_transaction(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
