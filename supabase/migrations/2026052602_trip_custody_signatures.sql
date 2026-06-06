-- KARGAX - Trip custody signatures for warehouse-to-warehouse private fleet

ALTER TABLE public.trip_signature_evidences
    DROP CONSTRAINT IF EXISTS trip_signature_evidences_signature_stage_check;

ALTER TABLE public.trip_signature_evidences
    ADD CONSTRAINT trip_signature_evidences_signature_stage_check
    CHECK (
        signature_stage IN (
            'origin_dispatch',
            'delivery_pod',
            'origin_warehouse_release',
            'origin_driver_acceptance',
            'destination_driver_handoff',
            'destination_warehouse_receipt'
        )
    );

COMMENT ON COLUMN public.trip_signature_evidences.signature_stage IS
    'Custody signature stage. origin_dispatch/delivery_pod are legacy customer-final stages; warehouse-to-warehouse uses four custody stages.';
