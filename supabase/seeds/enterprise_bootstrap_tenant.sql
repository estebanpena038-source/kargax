BEGIN;

-- Official bootstrap seed placeholder for the enterprise release.
-- Run this after migrations `031-033` and adapt UUIDs to your production-like tenant.
--
-- Target operating baseline:
-- 1. One holding with one linked business
-- 2. Multi-warehouse setup
-- 3. One settled trip
-- 4. One disbursed advance with repayment trail
-- 5. One corporate approval in queue
-- 6. One admin incident replay example
--
-- Recommended execution order:
-- - create holding account and members
-- - create linked business and at least 2 warehouses
-- - create a wallet with settlement transactions
-- - create a fuel advance plus repayment rows
-- - create holding approval and support request
-- - create operation event and platform incident tied by request_id

COMMIT;
