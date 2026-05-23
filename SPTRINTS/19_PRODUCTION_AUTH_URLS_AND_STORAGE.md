# CERRADO - SPRINT 19

# 19 - Production Auth URLs And Storage

## Estado

- artifact status: `completed`
- cerrado el: `2026-05-19`
- prioridad: maxima antes de pilotos
- owner: CTO / Founding Engineer

## Implementacion cerrada 2026-05-19

- `offer-photos` queda creado por migracion real en `supabase/migrations/005_offer_photos.sql`, con limite de 10 MB y MIME types `image/jpeg`, `image/png`, `image/webp`.
- `/api/health` valida DB, entorno publico y buckets requeridos: `offer-photos`, `trip-photos`, `trip-signatures`, `warehouse-sku-images`.
- `/api/health` falla si falta un bucket requerido o si la URL publica queda local en produccion estricta.
- `public-app-url.ts` y `runtime-env.ts` quedan como fuente canonica para evitar localhost en staging/produccion.
- Invitaciones de equipo y flota privada ya usan resolucion publica con `buildPublicAppUrl`/`resolvePublicAppUrl`.
- Typecheck frontend ejecutado y limpio.

## Proposito

Dejar auth, emails, invitaciones, dominios publicos y storage listos para staging/produccion. Este sprint existe porque un link a `localhost` o un bucket inexistente rompe confianza inmediatamente.

## Fuentes oficiales

- Supabase Redirect URLs: `https://supabase.com/docs/guides/auth/redirect-urls`
- Supabase Email Templates: `https://supabase.com/docs/guides/auth/auth-email-templates`
- Supabase Storage Buckets: `https://supabase.com/docs/guides/storage/buckets/fundamentals`
- Supabase Storage Access Control: `https://supabase.com/docs/guides/storage/security/access-control`

## Reglas de entorno

### Staging

- `NEXT_PUBLIC_APP_URL=https://kargax-staging.vercel.app`
- `ALLOWED_ORIGINS=https://kargax-staging.vercel.app`
- Supabase Site URL debe apuntar a staging si ese proyecto es staging.
- Supabase Additional Redirect URLs debe incluir:
  - `https://kargax-staging.vercel.app/auth/callback`
  - `https://kargax-staging.vercel.app/auth/reset-password`
  - `https://kargax-staging.vercel.app/auth/invite/accept`
  - `https://kargax-staging.vercel.app/registro/flota`

### Produccion

- `NEXT_PUBLIC_APP_URL=https://app.kargax.com` o dominio publico final.
- `ALLOWED_ORIGINS=https://app.kargax.com,https://kargax-staging.vercel.app` si staging debe convivir.
- Supabase Site URL productiva nunca puede ser localhost.
- Vercel production env no puede tener payment success/failure/pending en localhost.

### Local

- Localhost solo permitido con `NODE_ENV !== production`.
- El helper `resolvePublicAppUrl` puede permitir localhost en dev, nunca en produccion estricta.

## Cambios tecnicos

### Public URL resolver

- Auditar `frontend/src/lib/platform/public-app-url.ts`.
- Auditar `frontend/src/lib/server/runtime-env.ts`.
- Si `VERCEL_ENV=production` y la URL es local, lanzar error.
- Si no hay URL publica en servidor productivo, fallar temprano con mensaje claro.

### Reset password

- `frontend/src/app/recuperar-contrasena/page.tsx` debe usar redirect publico.
- `frontend/src/app/auth/reset-password/page.tsx` debe aceptar callback sin loop.
- Email template de Supabase debe usar `{{ .ConfirmationURL }}` o flujo equivalente que respete `redirectTo`.

### Invitaciones empresa

- `frontend/src/lib/server/team-invitations.ts` debe construir links con `buildPublicAppUrl`.
- `frontend/src/app/api/business/team/route.ts` no debe derivar localhost en produccion.
- Link abre accept flow y crea membership o magic link correctamente.

### Invitaciones holding

- `frontend/src/app/api/holding/members/route.ts` debe seguir la misma regla.
- Roles holding se aceptan solo desde dominio publico.

### Invitaciones flota privada

- `frontend/src/app/api/business/fleet/route.ts` debe generar link publico.
- Whatsapp message no debe incluir localhost.
- Link expira y valida invite_code.

## Storage buckets obligatorios

| Bucket | Uso | Publico | Estado objetivo |
|---|---|---|---|
| `offer-photos` | fotos de carga al publicar oferta | publico o lectura controlada | migracion real, no manual |
| `trip-photos` | evidencias de viaje/picking/POD | publico controlado o privado con signed URLs | ya existe, validar politicas |
| `trip-signatures` | firmas digitales flota privada | publico si se usa URL publica, preferible lectura controlada | existe en sprint 16, validar |
| `warehouse-sku-images` | imagenes de SKU | publico controlado | validar bucket/policies |

## Migracion requerida para `offer-photos`

- Insertar bucket con `INSERT INTO storage.buckets`.
- Definir `file_size_limit`.
- Definir `allowed_mime_types`: `image/jpeg`, `image/png`, `image/webp`.
- Politica insert para usuario autenticado.
- Politica select para usuarios autenticados o lectura publica si el producto requiere fotos visibles en marketplace.
- Politica delete/update solo owner/admin o por ruta controlada.

## QA navegador

### Reset password

1. Registrar usuario nuevo.
2. Cerrar sesion.
3. Solicitar recovery.
4. Abrir email en navegador normal.
5. Abrir email desde movil si es posible.
6. Confirmar dominio publico.
7. Cambiar password.
8. Login con password nueva.

### Invitaciones

1. Empresa invita usuario de equipo.
2. Holding invita usuario.
3. Flota privada genera invitacion conductor.
4. Abrir cada link desde navegador limpio.
5. Validar dominio publico y rol final.

### Storage

1. Publicar oferta con imagen.
2. Ver preview.
3. Publicar.
4. Abrir oferta en marketplace.
5. Confirmar que URL resuelve.

## Definition of Done

- `rg -n "localhost" frontend/src` solo muestra dev helpers o validadores que bloquean produccion.
- Todos los emails e invitaciones usan dominio publico en staging/produccion.
- `offer-photos` existe con politicas aplicadas.
- Publicacion de imagen no crashea ni recarga.
- `/api/health` reporta entorno y storage sin fallos criticos.
