# 04 — Supabase, RLS e índices

## Decisión de base de datos

Para MVP de POD-MK **no se requiere tabla nueva**. La evidencia ya existe en:

```txt
cargo_offers.manifest_items
cargo_offers.trip_photos
picking_events
user_profiles
offer_applications
```

La implementación puede ser 100% frontend/lib si las políticas RLS existentes permiten al business leer sus propias ofertas y eventos relacionados.

## Cuándo crear migración

Crear migración nueva solo si se necesita:

1. Índices para performance.
2. RPC server-side para acceso controlado.
3. Share links públicos con token.
4. Auditoría de descargas/export PDF.
5. Ajustes RLS si las políticas actuales no cubren POD-MK.

No editar migraciones viejas.

## Migración opcional de índices

Nombre sugerido:

```txt
supabase/migrations/YYYYMMDDHHMMSS_pod_marketplace_indexes.sql
```

SQL propuesto:

```sql
-- POD-MK: acelerar listado de evidencias marketplace por empresa.
create index if not exists idx_cargo_offers_pod_marketplace_business_status_created
on public.cargo_offers (business_id, status, created_at desc)
where coalesce(is_private_fleet, false) = false;

-- POD-MK: acelerar timeline de evidencia por oferta.
create index if not exists idx_picking_events_offer_created_at
on public.picking_events (offer_id, created_at asc);

-- POD-MK: acelerar acceso del transportador aceptado si se habilita vista detalle para trucker.
create index if not exists idx_offer_applications_offer_trucker_status
on public.offer_applications (offer_id, trucker_id, status);
```

## RPC opcional recomendado si RLS es débil

Si las consultas directas desde cliente pueden filtrar mal o si hay dudas de RLS multiempresa, crear RPC server-side con `security definer` y checks explícitos.

Nombre sugerido:

```sql
public.get_marketplace_pod_report(p_offer_id uuid)
```

Reglas internas:

```txt
1. Resolver auth.uid().
2. Cargar perfil.
3. Cargar cargo_offer.
4. Rechazar si coalesce(is_private_fleet, false) = true.
5. Permitir si:
   - admin,
   - business dueño,
   - trucker asignado,
   - trucker con offer_applications.status = accepted.
6. Devolver payload mínimo o IDs para que frontend consulte detalle.
```

## Políticas RLS esperadas

### `cargo_offers`

Debe permitir:

```txt
business owner -> sus ofertas
admin -> todas
assigned/accepted trucker -> su ruta operativa
```

Debe bloquear:

```txt
otras empresas
otros transportadores
usuarios anónimos
```

### `picking_events`

Debe permitir lectura solo si el usuario puede leer la oferta relacionada.

### Storage `trip-photos`

Si el bucket es público, el riesgo está en URLs ya emitidas. Si es privado, las URLs deben firmarse solo para usuarios autorizados. Para MVP, si el bucket actual usa publicUrl, mantener el patrón existente y documentar que no es share público controlado.

## Prohibido en esta fase

No crear:

- Link público sin token.
- PDF público sin expiración.
- Política que permita `select *` a authenticated.
- RPC que ignore `business_id`.
- Consulta que incluya `is_private_fleet = true`.

## Checklist de seguridad para aprobar

- [ ] `POD-MK` filtra `is_private_fleet != true` en lista.
- [ ] `POD-MK` filtra `is_private_fleet != true` en detalle.
- [ ] Rutas privadas retornan error o redirect a flota privada.
- [ ] No se consulta `trip_signature_evidences`.
- [ ] No se llama `/api/business/fleet/signatures`.
- [ ] No se toca wallet ni Mercado Pago.
- [ ] RLS impide ver rutas de otra empresa.
- [ ] Trucker no puede listar expedientes de empresa.
