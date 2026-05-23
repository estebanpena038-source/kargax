-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 020: ADD RESERVED STATUS TO ENUM
-- 
-- FIX: The offer_status enum was missing the 'reserved' value that migration
-- 019 and the payment APIs expect to use. This causes PostgreSQL error 22P02:
-- "invalid input value for enum offer_status: 'reserved'"
--
-- This migration adds 'reserved' to the enum to fix the payment flow.
-- The 'reserved' status represents: Payment confirmed, awaiting pickup PIN.
--
-- Correct status flow:
-- draft -> active -> reserved -> in_progress -> completed
--
-- =============================================================================

-- Add 'reserved' value to the offer_status enum
-- AFTER 'active' to maintain logical order in the flow
-- IF NOT EXISTS prevents errors if run multiple times
DO $$ 
BEGIN
    -- PostgreSQL 9.1+ supports ADD VALUE with IF NOT EXISTS
    ALTER TYPE offer_status ADD VALUE IF NOT EXISTS 'reserved' AFTER 'active';
EXCEPTION
    WHEN duplicate_object THEN 
        -- Value already exists, ignore error
        RAISE NOTICE 'Value already exists in enum, skipping...';
END $$;

-- Add comment documenting the status meanings
COMMENT ON TYPE offer_status IS 
'Offer status enum:
  - draft: Borrador, no visible al público
  - active: Publicada, aceptando aplicaciones
  - reserved: Pago confirmado, esperando PIN de recogida
  - in_progress: Camionero asignado, carga verificada, en transporte
  - completed: Entrega completada y verificada
  - cancelled: Cancelada por empresa
  - expired: Expirada sin asignar';
