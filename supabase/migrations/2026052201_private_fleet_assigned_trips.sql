-- =============================================================================
-- KARGAX - PRIVATE FLEET ASSIGNED TRIPS
-- =============================================================================
-- Makes private fleet assignments explicit for driver accept/reject UX.

ALTER TABLE public.cargo_offers
    ADD COLUMN IF NOT EXISTS private_fleet_assignment_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS private_fleet_rejected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS private_fleet_rejected_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS private_fleet_rejection_reason TEXT;

ALTER TABLE public.cargo_offers
    DROP CONSTRAINT IF EXISTS cargo_offers_private_fleet_assignment_status_check;

ALTER TABLE public.cargo_offers
    ADD CONSTRAINT cargo_offers_private_fleet_assignment_status_check
    CHECK (private_fleet_assignment_status IN ('pending', 'accepted', 'rejected'));

UPDATE public.cargo_offers
SET private_fleet_assignment_status = 'accepted'
WHERE is_private_fleet = TRUE
  AND (
      private_fleet_confirmed_at IS NOT NULL
      OR status IN ('reserved', 'in_progress', 'completed')
  )
  AND private_fleet_assignment_status <> 'accepted';

UPDATE public.cargo_offers
SET private_fleet_assignment_status = 'pending'
WHERE is_private_fleet = TRUE
  AND status = 'assigned'
  AND private_fleet_confirmed_at IS NULL
  AND private_fleet_assignment_status <> 'rejected';

CREATE INDEX IF NOT EXISTS idx_cargo_offers_private_assignment_status
    ON public.cargo_offers(is_private_fleet, private_fleet_assignment_status, private_fleet_trucker_id, status);

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
    'application_received',
    'application_accepted',
    'application_rejected',
    'offer_published',
    'offer_expired',
    'new_message',
    'inspection_loading_completed',
    'inspection_delivery_completed',
    'inspection_issue_reported',
    'trip_started',
    'trip_completed',
    'fleet_invitation_accepted',
    'private_fleet_assignment',
    'private_fleet_assignment_rejected',
    'private_fleet_expense_released',
    'private_fleet_freight_released',
    'private_fleet_incident',
    'private_fleet_signature_captured'
));

COMMENT ON COLUMN public.cargo_offers.private_fleet_assignment_status IS
'Driver-facing private fleet assignment state: pending, accepted or rejected.';

COMMENT ON COLUMN public.cargo_offers.private_fleet_rejection_reason IS
'Optional reason supplied by the private fleet driver when returning an assigned trip to the company.';
