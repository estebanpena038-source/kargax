# 01 — Investigación del repo y fuentes del proyecto

## Fuentes leídas

Se revisaron fuentes del sistema operativo IA y del repo:

- `KARGAX_AI_OPERATING_SYSTEM/AGENTS.md`
- `KARGAX_AI_OPERATING_SYSTEM/frontend/AGENTS.md`
- `KARGAX_AI_OPERATING_SYSTEM/supabase/AGENTS.md`
- `KARGAX_AI_OPERATING_SYSTEM/docs/ai/KARGAX_ARCHITECTURE_MAP.md`
- `KARGAX_AI_OPERATING_SYSTEM/docs/ai/SOURCES.md`
- `WALLET/04_FLOTA_PRIVADA_COMPROBANTES.md`
- `WALLET/05_ARCHIVOS_A_EDITAR_EXACTOS.md`
- Repo GitHub: `estebanpena038-source/kargax`

## Reglas importantes detectadas

1. `frontend/` es la app principal.
2. `supabase/migrations/` es la historia oficial de base de datos.
3. No editar migraciones antiguas.
4. No debilitar RLS.
5. No mezclar datos multiempresa.
6. Billing, wallet, Mercado Pago, RLS y datos multiempresa son riesgo alto.
7. Copy de producto debe seguir en español, claro y operativo.
8. KargaX vende “entrega probada”: foto/firma/PIN/POD/hora/novedad/soporte.

## Hallazgos principales del código

### 1. El módulo `inspecciones` ya existe

Rutas actuales:

```txt
frontend/src/app/inspecciones/page.tsx
frontend/src/app/inspecciones/[offerId]/page.tsx
frontend/src/app/inspecciones/[offerId]/components.tsx
```

Lib actual:

```txt
frontend/src/lib/inspections/index.ts
frontend/src/lib/inspections/types.ts
frontend/src/lib/inspections/api.ts
```

### 2. `inspecciones` no está modelado como flota privada

El API actual lee:

```txt
cargo_offers
picking_events
user_profiles
trip_photos / manifest_items
```

Eso es exactamente el núcleo del POD marketplace.

### 3. La navegación aún lo llama Inspecciones

Archivo:

```txt
frontend/src/components/layouts/DashboardLayout.tsx
```

Item actual:

```txt
id: 'inspections'
labelKey: 'nav.inspections'
fallbackLabel: 'Inspecciones'
href: '/inspecciones'
```

Debe cambiarse a POD-MK.

### 4. La flota privada tiene flujo propio

Archivos clave:

```txt
frontend/src/app/dashboard/flota/page.tsx
frontend/src/app/viajes-asignados/page.tsx
frontend/src/lib/private-fleet/driver-trip-actions.ts
frontend/src/app/api/business/fleet/signatures/route.ts
frontend/src/components/trips/TripSignatureCapture.tsx
```

La flota privada maneja:

- Conductores privados.
- Viajes asignados por empresa.
- Firma de despacho y firma de receptor.
- Tabla `trip_signature_evidences`.
- Endpoint `/api/business/fleet/signatures`.
- Notificaciones privadas.
- Comprobantes/liquidación interna.

### 5. El flujo operativo `/viaje/[offerId]` es compartido pero bifurcado

Rutas:

```txt
frontend/src/app/viaje/[offerId]/page.tsx
frontend/src/app/viaje/[offerId]/carga/page.tsx
frontend/src/app/viaje/[offerId]/entrega/page.tsx
```

Estas rutas pueden servir a marketplace y privada, pero internamente ya diferencian por:

```txt
is_private_fleet
assigned_trucker_id
private_fleet_trucker_id
offer_applications accepted
pickup_pin
delivery_pin
```

Para POD-MK, se debe consumir la evidencia ya generada por estos flujos, pero filtrando rutas públicas.

## Conclusión técnica

`Inspecciones` debe ser renombrado/forkeado a `pod-marketplace`. No se debe crear desde cero ni copiar flota privada. La base funcional correcta ya existe; el trabajo real es:

- renombrar,
- aislar,
- filtrar marketplace,
- corregir copy,
- actualizar navegación,
- agregar QA de separación privado/marketplace.
