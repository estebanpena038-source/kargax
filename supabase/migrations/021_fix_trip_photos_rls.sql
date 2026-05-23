-- =============================================================================
-- KARGAX - FIX TRIP-PHOTOS BUCKET RLS POLICIES
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

-- Crear bucket si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-photos', 'trip-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir fotos" ON storage.objects;
DROP POLICY IF EXISTS "Cualquiera puede ver fotos públicas" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propias fotos" ON storage.objects;

-- Política 1: Usuarios autenticados pueden subir fotos
CREATE POLICY "Usuarios autenticados pueden subir fotos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'trip-photos');

-- Política 2: Cualquiera puede ver las fotos (bucket público)
CREATE POLICY "Cualquiera puede ver fotos públicas"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'trip-photos');

-- Política 3: Usuarios pueden eliminar sus propias fotos
CREATE POLICY "Usuarios pueden eliminar sus propias fotos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'trip-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Confirmar
SELECT 'Políticas RLS de trip-photos configuradas correctamente' AS status;
