-- =============================================================================
-- KARGAX - RUN ALL MIGRATIONS
-- Ejecutar este archivo para aplicar todas las migraciones en orden
-- =============================================================================

-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard > SQL Editor
-- 2. Ejecuta cada archivo en orden numérico
-- 3. O ejecuta este archivo que incluye todos

-- =============================================================================
-- ORDEN DE EJECUCIÓN:
-- =============================================================================
-- 
-- 001_users.sql          ✅ YA EJECUTADO (via supabase_schema.sql)
-- 002_cargo_offers.sql   ⏳ Ejecutar ahora
-- 003_offer_applications.sql  ⏳ Ejecutar ahora
-- 004_offer_views.sql    ⏳ Ejecutar ahora
-- 005_offer_photos.sql   ⏳ Ejecutar ahora
--
-- =============================================================================

-- Para ejecutar todos de una vez, copia y pega el contenido de:
-- 002_cargo_offers.sql
-- 003_offer_applications.sql
-- 004_offer_views.sql
-- 005_offer_photos.sql

-- O ejecuta cada uno individualmente en el SQL Editor de Supabase.

SELECT 'Migraciones listas para ejecutar. Ver archivos individuales.' AS mensaje;
