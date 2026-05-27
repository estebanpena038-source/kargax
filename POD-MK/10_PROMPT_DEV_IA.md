# 10 — Prompt listo para dev/IA/Codex

Copia este prompt para ejecutar la implementación en el repo.

---

Actúa como senior founding engineer de KargaX. Necesito convertir el módulo `Inspecciones` en **Evidencia Digital Marketplace / POD-MK**, sin mezclarlo con evidencia digital de flota privada.

## Contexto

Repo: `estebanpena038-source/kargax`  
App: `frontend/`  
DB: `supabase/migrations/`

El módulo actual `frontend/src/app/inspecciones` y `frontend/src/lib/inspections` ya funciona como reporte de evidencia basado en `cargo_offers`, `picking_events`, `trip_photos` y `manifest_items`. Debe convertirse a marketplace evidence.

## Objetivo

Crear:

```txt
frontend/src/lib/pod-marketplace/
frontend/src/app/pod-marketplace/
```

Renombrar el producto de `Inspecciones` a:

```txt
Evidencia Digital MK
Evidencia digital Marketplace
POD de cargue, ruta y entrega para rutas públicas.
```

## Reglas críticas

1. No mezclar con flota privada.
2. No consultar `trip_signature_evidences`.
3. No llamar `/api/business/fleet/signatures`.
4. No tocar wallet, Mercado Pago, billing ni liquidaciones.
5. POD-MK debe filtrar `is_private_fleet != true` en lista y detalle.
6. Mantener redirects legacy de `/inspecciones` a `/pod-marketplace`.
7. Mantener copy en español operativo.
8. No editar migraciones antiguas.

## Archivos a leer primero

```txt
frontend/src/app/inspecciones/page.tsx
frontend/src/app/inspecciones/[offerId]/page.tsx
frontend/src/app/inspecciones/[offerId]/components.tsx
frontend/src/lib/inspections/index.ts
frontend/src/lib/inspections/types.ts
frontend/src/lib/inspections/api.ts
frontend/src/components/layouts/DashboardLayout.tsx
frontend/src/app/ofertas/mis-ofertas/page.tsx
frontend/src/app/api/business/fleet/signatures/route.ts
frontend/src/app/viajes-asignados/page.tsx
frontend/src/app/viaje/[offerId]/carga/page.tsx
frontend/src/app/viaje/[offerId]/entrega/page.tsx
```

## Implementación requerida

### 1. Nuevo lib

Copiar `frontend/src/lib/inspections/*` a `frontend/src/lib/pod-marketplace/*`.

Renombrar funciones:

```txt
getInspectionReport -> getMarketplacePodReport
getInspectionList -> getMarketplacePodList
inspectionsApi -> marketplacePodApi
```

Renombrar tipos:

```txt
InspectionReport -> MarketplacePodReport
InspectionPhoto -> MarketplacePodPhoto
InspectionSummary -> MarketplacePodSummary
InspectionTimelineEvent -> MarketplacePodTimelineEvent
InspectionManifestItem -> MarketplacePodManifestItem
InspectionStatus -> MarketplacePodStatus
InspectionPhase -> MarketplacePodPhase
```

Agregar a la query de detalle:

```ts
.neq('is_private_fleet', true)
```

Agregar a la query de lista:

```ts
.eq('business_id', businessId)
.neq('is_private_fleet', true)
```

Si una ruta privada llega al detalle, devolver:

```ts
{
  success: false,
  error: 'Esta evidencia pertenece a una ruta privada. Revísala desde Flota privada.',
  errorCode: 'PRIVATE_FLEET_ROUTE_NOT_ALLOWED'
}
```

### 2. Nueva app route

Copiar:

```txt
frontend/src/app/inspecciones/page.tsx
frontend/src/app/inspecciones/[offerId]/page.tsx
frontend/src/app/inspecciones/[offerId]/components.tsx
```

a:

```txt
frontend/src/app/pod-marketplace/page.tsx
frontend/src/app/pod-marketplace/[offerId]/page.tsx
frontend/src/app/pod-marketplace/[offerId]/components.tsx
```

Actualizar imports a `@/lib/pod-marketplace`.

Actualizar links a `/pod-marketplace/${offerId}`.

Actualizar copy:

```txt
Inspecciones -> Evidencia digital Marketplace
Evidencia de cargue, ruta y entrega. -> POD de cargue, ruta y entrega para rutas públicas.
Ver expediente -> Ver expediente POD
Cadena de custodia -> Cadena de custodia marketplace
Manifiesto -> Manifiesto de ruta pública
Evidencia fotográfica -> Evidencia fotográfica del POD
```

### 3. Redirect legacy

Reemplazar `frontend/src/app/inspecciones/page.tsx` por redirect a `/pod-marketplace`.

Reemplazar `frontend/src/app/inspecciones/[offerId]/page.tsx` por redirect a `/pod-marketplace/[offerId]`.

### 4. Sidebar

En `frontend/src/components/layouts/DashboardLayout.tsx` cambiar item `inspections`:

```ts
{
  id: 'pod-marketplace',
  labelKey: 'nav.podMarketplace',
  fallbackLabel: 'Evidencia Digital MK',
  icon: ClipboardCheck,
  href: '/pod-marketplace',
  allowedUserTypes: ['business', 'admin'],
}
```

### 5. i18n

Agregar `nav.podMarketplace` en:

```txt
frontend/public/locales/es-CO/common.json
frontend/public/locales/en/common.json
frontend/public/locales/pt-BR/common.json
```

### 6. Mis Ofertas

En `frontend/src/app/ofertas/mis-ofertas/page.tsx`, agregar CTA `Evidencia` para estados:

```txt
reserved
in_progress
completed
```

Link:

```tsx
/pod-marketplace/${offer.id}
```

### 7. QA

Ejecutar:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run check
```

## Criterios de aceptación

- `/pod-marketplace` carga y muestra solo rutas públicas.
- `/pod-marketplace/[offerId]` muestra expediente POD marketplace.
- `/inspecciones` redirige.
- `/inspecciones/[offerId]` redirige.
- Sidebar dice `Evidencia Digital MK`.
- Rutas privadas no aparecen.
- Detalle de ruta privada se bloquea.
- No hay imports desde `business/fleet/signatures` ni `trip_signature_evidences` en POD-MK.
- No hay cambios en wallet, Mercado Pago, billing ni liquidaciones.

Entrega un diff claro y explica riesgos.
