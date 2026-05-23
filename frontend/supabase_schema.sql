-- =============================================================================
-- KARGAX - SUPABASE DATABASE SCHEMA
-- Enterprise-Grade PostgreSQL Schema with Maximum Security
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

-- =============================================================================
-- STEP 1: Enable Required Extensions
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- STEP 2: Create Custom Types (ENUMs)
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE user_type AS ENUM ('trucker', 'business', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- STEP 3: Create Tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USER PROFILES (Main user data table)
-- Links to auth.users via id
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    user_type user_type NOT NULL DEFAULT 'trucker',
    document_type TEXT,
    document_number TEXT,
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment on table
COMMENT ON TABLE public.user_profiles IS 'Public user profiles, created automatically on auth signup';

-- -----------------------------------------------------------------------------
-- BUSINESS PROFILES (Additional data for business users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    nit TEXT,
    industry TEXT,
    address TEXT,
    city TEXT,
    department TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2) DEFAULT 0,
    total_shipments INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.business_profiles IS 'Extended profile for business users';

-- -----------------------------------------------------------------------------
-- TRUCKER PROFILES (Additional data for trucker users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trucker_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    license_number TEXT,
    license_type TEXT,
    license_expiry DATE,
    years_experience INTEGER DEFAULT 0,
    vehicle_types JSONB DEFAULT '[]',
    service_areas JSONB DEFAULT '[]',
    is_verified BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2) DEFAULT 0,
    total_trips INTEGER DEFAULT 0,
    available BOOLEAN DEFAULT TRUE,
    current_location JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.trucker_profiles IS 'Extended profile for trucker users';

-- =============================================================================
-- STEP 4: Create Indexes for Performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type ON public.user_profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON public.user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id ON public.business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_city ON public.business_profiles(city);
CREATE INDEX IF NOT EXISTS idx_trucker_profiles_user_id ON public.trucker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_trucker_profiles_available ON public.trucker_profiles(available);

-- =============================================================================
-- STEP 5: Create Trigger Functions
-- =============================================================================

-- Function: Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_type user_type;
BEGIN
    -- Get user type from metadata, default to 'trucker'
    v_user_type := COALESCE(
        (NEW.raw_user_meta_data->>'user_type')::user_type,
        'trucker'
    );

    -- Insert into user_profiles
    INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        phone,
        user_type,
        document_type,
        document_number,
        is_verified,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
        NEW.raw_user_meta_data->>'phone',
        v_user_type,
        NEW.raw_user_meta_data->>'document_type',
        NEW.raw_user_meta_data->>'document_number',
        CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
        true,
        NOW(),
        NOW()
    );

    -- If business, create business profile
    IF v_user_type = 'business' THEN
        INSERT INTO public.business_profiles (
            user_id,
            company_name,
            nit,
            industry,
            address,
            city,
            department,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'company_name', 'Mi Empresa'),
            NEW.raw_user_meta_data->>'nit',
            NEW.raw_user_meta_data->>'industry',
            NEW.raw_user_meta_data->>'address',
            NEW.raw_user_meta_data->>'city',
            NEW.raw_user_meta_data->>'department',
            NOW(),
            NOW()
        );
    END IF;

    -- If trucker, create trucker profile
    IF v_user_type = 'trucker' THEN
        INSERT INTO public.trucker_profiles (
            user_id,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            NOW(),
            NOW()
        );
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN others THEN
        -- Log error but don't fail the signup
        RAISE WARNING 'Error creating user profile: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Function: Update is_verified when email is confirmed
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Only update if email was just confirmed
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        UPDATE public.user_profiles
        SET is_verified = true, updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- =============================================================================
-- STEP 6: Create Triggers
-- =============================================================================

-- Trigger: Create profile on new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Update verified status on email confirmation
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmed();

-- Triggers: Auto-update updated_at
DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON public.user_profiles;
CREATE TRIGGER set_updated_at_user_profiles
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_business_profiles ON public.business_profiles;
CREATE TRIGGER set_updated_at_business_profiles
    BEFORE UPDATE ON public.business_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_trucker_profiles ON public.trucker_profiles;
CREATE TRIGGER set_updated_at_trucker_profiles
    BEFORE UPDATE ON public.trucker_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- STEP 7: Enable Row Level Security (RLS) - MAXIMUM SECURITY
-- =============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucker_profiles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 8: Create RLS Policies
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USER PROFILES POLICIES
-- -----------------------------------------------------------------------------

-- Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

-- Policy: Authenticated users can view basic public profile info
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.user_profiles;
CREATE POLICY "Authenticated users can view profiles"
    ON public.user_profiles FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Users can update only their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy: System can insert profiles (via trigger)
DROP POLICY IF EXISTS "System can insert profiles" ON public.user_profiles;
CREATE POLICY "System can insert profiles"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Policy: Users cannot delete their own profile (must use account deletion)
DROP POLICY IF EXISTS "Users cannot delete profiles" ON public.user_profiles;
CREATE POLICY "Users cannot delete profiles"
    ON public.user_profiles FOR DELETE
    USING (false);

-- -----------------------------------------------------------------------------
-- BUSINESS PROFILES POLICIES
-- -----------------------------------------------------------------------------

-- Policy: Business owners can view their own business
DROP POLICY IF EXISTS "Business owners can view own business" ON public.business_profiles;
CREATE POLICY "Business owners can view own business"
    ON public.business_profiles FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: All authenticated users can view business info (for marketplace)
DROP POLICY IF EXISTS "Authenticated can view business info" ON public.business_profiles;
CREATE POLICY "Authenticated can view business info"
    ON public.business_profiles FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Business owners can update their own business
DROP POLICY IF EXISTS "Business owners can update own business" ON public.business_profiles;
CREATE POLICY "Business owners can update own business"
    ON public.business_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: System can insert business profiles
DROP POLICY IF EXISTS "System can insert business profiles" ON public.business_profiles;
CREATE POLICY "System can insert business profiles"
    ON public.business_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- TRUCKER PROFILES POLICIES
-- -----------------------------------------------------------------------------

-- Policy: Truckers can view their own profile
DROP POLICY IF EXISTS "Truckers can view own profile" ON public.trucker_profiles;
CREATE POLICY "Truckers can view own profile"
    ON public.trucker_profiles FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: All authenticated users can view trucker info (for marketplace)
DROP POLICY IF EXISTS "Authenticated can view trucker info" ON public.trucker_profiles;
CREATE POLICY "Authenticated can view trucker info"
    ON public.trucker_profiles FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Truckers can update their own profile
DROP POLICY IF EXISTS "Truckers can update own profile" ON public.trucker_profiles;
CREATE POLICY "Truckers can update own profile"
    ON public.trucker_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: System can insert trucker profiles
DROP POLICY IF EXISTS "System can insert trucker profiles" ON public.trucker_profiles;
CREATE POLICY "System can insert trucker profiles"
    ON public.trucker_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- STEP 9: Grant Permissions
-- =============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant table permissions
GRANT SELECT ON public.user_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.user_profiles TO authenticated;

GRANT SELECT ON public.business_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.business_profiles TO authenticated;

GRANT SELECT ON public.trucker_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.trucker_profiles TO authenticated;

-- =============================================================================
-- DONE! 
-- Now go to Authentication > Email Templates in Supabase Dashboard
-- to customize confirmation email
-- =============================================================================
