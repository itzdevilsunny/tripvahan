-- ====================================================================
-- TRIPVAHAN DATABASE MIGRATION:
-- PREVENT DATABASE-LEVEL PRIVILEGE ESCALATION ON PROFILE INSERT
-- File: supabase/migrations/20261020_prevent_profile_role_escalation_on_insert.sql
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT SIGN-OFF)
-- ====================================================================
-- Summary:
-- 1. Updates public.protect_profile_privilege_escalation() function to
--    protect BOTH INSERT and UPDATE operations.
-- 2. Blocks direct Supabase API inserts from specifying role = 'admin'.
-- 3. Blocks direct Supabase API inserts from setting verified = true on operator accounts.
-- 4. Hardens RLS policy "Self Profile Insert" on public.profiles with role & verified constraints.
-- 5. Preserves legitimate self-registration for 'traveller' and 'operator' (with verified=false).
-- ====================================================================

BEGIN;

-- 1. Update trigger function to evaluate both INSERT and UPDATE operations
CREATE OR REPLACE FUNCTION public.protect_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Profile ID is strictly immutable on UPDATE
    IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Profile ID is immutable' USING ERRCODE = '42501';
    END IF;

    -- Security checks for non-service_role callers (authenticated end users & anonymous callers)
    IF COALESCE(auth.role(), '') != 'service_role' THEN
        IF TG_OP = 'INSERT' THEN
            -- Privilege Escalation Barrier 1: Direct insert of 'admin' role is strictly prohibited
            IF NEW.role = 'admin' THEN
                RAISE EXCEPTION 'Forbidden: Administrator accounts cannot be self-registered or inserted via client APIs' USING ERRCODE = '42501';
            END IF;

            -- Privilege Escalation Barrier 2: Direct insert of verified=true for commercial operators is prohibited
            IF NEW.role = 'operator' AND NEW.verified IS TRUE THEN
                RAISE EXCEPTION 'Forbidden: Commercial fleet operators require administrator compliance verification before activation' USING ERRCODE = '42501';
            END IF;

            -- Identity Ownership Barrier: Callers can only insert their own profile matching auth.uid()
            IF auth.uid() IS NULL OR auth.uid()::text != NEW.id THEN
                RAISE EXCEPTION 'Forbidden: Cannot insert profile for another user identity' USING ERRCODE = '42501';
            END IF;

        ELSIF TG_OP = 'UPDATE' THEN
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
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Attach trigger to execute BEFORE INSERT OR UPDATE on public.profiles
DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_privilege_escalation();

-- 3. Harden Row Level Security policy for INSERT on public.profiles
DROP POLICY IF EXISTS "Self Profile Insert" ON public.profiles;
CREATE POLICY "Self Profile Insert" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = id 
    AND (role IS NULL OR role IN ('traveller', 'operator'))
    AND (role != 'operator' OR verified IS NOT TRUE)
  );

COMMIT;
