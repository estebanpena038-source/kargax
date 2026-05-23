-- =============================================================================
-- KARGAX — Migration: Add onboarding_completed to user_profiles
-- Date: 2026-04-28
-- Purpose: Track onboarding completion state for gated auth flow
-- =============================================================================

-- Step 1: Add column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.user_profiles.onboarding_completed
IS 'Whether the user has completed the post-registration onboarding flow';

-- Step 2: Backfill — mark existing business users who have complete profiles
-- as already onboarded (they registered before this field existed)
UPDATE public.user_profiles up
SET onboarding_completed = true
WHERE up.user_type = 'business'
  AND EXISTS (
      SELECT 1
      FROM public.business_profiles bp
      WHERE bp.user_id = up.id
        AND bp.company_name IS NOT NULL
        AND bp.company_name != 'Mi Empresa'
  );

-- Step 3: Backfill — mark existing trucker users who have profiles as onboarded
UPDATE public.user_profiles up
SET onboarding_completed = true
WHERE up.user_type = 'trucker'
  AND EXISTS (
      SELECT 1
      FROM public.trucker_profiles tp
      WHERE tp.user_id = up.id
  );

-- Step 4: Index for fast lookup on auth gate
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding
ON public.user_profiles (id, onboarding_completed)
WHERE onboarding_completed = false;

-- =============================================================================
-- DONE — Run this in Supabase SQL Editor before deploying frontend
-- =============================================================================
