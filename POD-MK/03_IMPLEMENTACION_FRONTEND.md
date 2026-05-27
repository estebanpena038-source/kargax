# 03 — Implementación frontend

## Objetivo

Convertir `Inspecciones` en **Evidencia Digital Marketplace** sin romper enlaces existentes y sin mezclar con flota privada.

## Archivos a crear

```txt
frontend/src/lib/pod-marketplace/index.ts
frontend/src/lib/pod-marketplace/types.ts
frontend/src/lib/pod-marketplace/api.ts
frontend/src/app/pod-marketplace/page.tsx
frontend/src/app/pod-marketplace/[offerId]/page.tsx
frontend/src/app/pod-marketplace/[offerId]/components.tsx
```

## Archivos a modificar

```txt
frontend/src/app/inspecciones/page.tsx
frontend/src/app/inspecciones/[offerId]/page.tsx
frontend/src/components/layouts/DashboardLayout.tsx
frontend/public/locales/es-CO/common.json
frontend/public/locales/en/common.json
frontend/public/locales/pt-BR/common.json
frontend/src/app/ofertas/mis-ofertas/page.tsx
```

## Paso 1 — Crear lib `pod-marketplace`

Copiar:

```txt
frontend/src/lib/inspections/*
```

A:

```txt
frontend/src/lib/pod-marketplace/*
```

### `frontend/src/lib/pod-marketplace/index.ts`

```ts
export type {
  MarketplacePodStatus,
  MarketplacePodPhase,
  MarketplacePodEventType,
  MarketplacePodItemStatus,
  MarketplacePodPhoto,
  MarketplacePodManifestItem,
  MarketplacePodTimelineEvent,
  MarketplacePodSummary,
  MarketplacePodReport,
  GetMarketplacePodReportResponse,
  MarketplacePodNotification,
} from './types';

export {
  REJECTION_REASON_LABELS,
  EVENT_TYPE_LABELS,
  calculateCompliancePercent,
  getStatusColor,
  getStatusBadgeClasses,
  formatMarketplacePodDate,
  formatRelativeTime,
  getInitials,
  isValidMarketplacePodReport,
} from './types';

export {
  getMarketplacePodReport,
  getMarketplacePodList,
  marketplacePodApi,
} from './api';
```

## Paso 2 — Filtro anti-flota privada en API

En `frontend/src/lib/pod-marketplace/api.ts`, la consulta de detalle debe incluir `is_private_fleet` y bloquear privados.

### Tipo DB

```ts
interface DbCargoOffer {
  id: string;
  is_private_fleet: boolean | null;
  business_id: string;
  assigned_trucker_id: string | null;
  // resto de campos copiados desde inspections
}
```

### Query detalle

```ts
const { data: offer, error: offerError } = await supabase
  .from('cargo_offers')
  .select(`
    id,
    is_private_fleet,
    status,
    cargo_type,
    cargo_description,
    origin_department,
    origin_city,
    origin_address,
    destination_department,
    destination_city,
    destination_address,
    pickup_contact_name,
    pickup_contact_phone,
    delivery_contact_name,
    delivery_contact_phone,
    total_amount,
    net_amount,
    manifest_items,
    trip_photos,
    business_id,
    assigned_trucker_id,
    created_at,
    updated_at,
    arrived_at_origin_at,
    loading_started_at,
    loading_completed_at,
    pickup_verified_at,
    arrived_at_destination_at,
    unloading_started_at,
    unloading_completed_at,
    delivery_verified_at,
    origin_latitude,
    origin_longitude,
    destination_latitude,
    destination_longitude,
    trucker_origin_lat,
    trucker_origin_lng,
    trucker_destination_lat,
    trucker_destination_lng,
    gps_tolerance_meters,
    manifest_loaded_count,
    manifest_delivered_count,
    manifest_rejected_count
  `)
  .eq('id', offerId)
  .neq('is_private_fleet', true)
  .single();
```

### Guard adicional después del fetch

```ts
const dbOffer = offer as unknown as DbCargoOffer;

if (dbOffer.is_private_fleet === true) {
  return {
    success: false,
    error: 'Esta evidencia pertenece a una ruta privada. Revísala desde Flota privada.',
    errorCode: 'PRIVATE_FLEET_ROUTE_NOT_ALLOWED',
  };
}
```

> Se recomienda usar `neq('is_private_fleet', true)` para tolerar filas legacy con `null`. Si el schema garantiza `false`, se puede usar `.eq('is_private_fleet', false)`.

## Paso 3 — Query lista marketplace

`getMarketplacePodList(businessId, { limit })` debe listar solo rutas públicas.

```ts
const { data: offers, error } = await supabase
  .from('cargo_offers')
  .select(`
    id,
    is_private_fleet,
    status,
    cargo_type,
    cargo_description,
    origin_department,
    origin_city,
    destination_department,
    destination_city,
    manifest_items,
    trip_photos,
    business_id,
    assigned_trucker_id,
    created_at,
    pickup_verified_at,
    delivery_verified_at,
    manifest_loaded_count,
    manifest_delivered_count,
    manifest_rejected_count
  `)
  .eq('business_id', businessId)
  .neq('is_private_fleet', true)
  .order('created_at', { ascending: false })
  .limit(options?.limit || 50);
```

## Paso 4 — Crear ruta `/pod-marketplace`

Copiar:

```txt
frontend/src/app/inspecciones/page.tsx
```

A:

```txt
frontend/src/app/pod-marketplace/page.tsx
```

Cambios:

```diff
- import { getInspectionList, type InspectionStatus } from '@/lib/inspections';
+ import { getMarketplacePodList, type MarketplacePodStatus } from '@/lib/pod-marketplace';

- DashboardLayout pageTitle="Inspecciones"
+ DashboardLayout pageTitle="Evidencia Digital MK"

- <h1>Inspecciones</h1>
+ <h1>Evidencia digital Marketplace</h1>

- <p>Evidencia de cargue, ruta y entrega.</p>
+ <p>POD de cargue, ruta y entrega para rutas públicas.</p>

- <Link href={`/inspecciones/${inspection.offerId}`}
+ <Link href={`/pod-marketplace/${pod.offerId}`}
```

## Paso 5 — Crear detalle `/pod-marketplace/[offerId]`

Copiar:

```txt
frontend/src/app/inspecciones/[offerId]/page.tsx
frontend/src/app/inspecciones/[offerId]/components.tsx
```

A:

```txt
frontend/src/app/pod-marketplace/[offerId]/page.tsx
frontend/src/app/pod-marketplace/[offerId]/components.tsx
```

Cambios:

```diff
- import { getInspectionReport, type InspectionReport, type InspectionPhoto } from '@/lib/inspections';
+ import { getMarketplacePodReport, type MarketplacePodReport, type MarketplacePodPhoto } from '@/lib/pod-marketplace';

- const res = await getInspectionReport(offerId);
+ const res = await getMarketplacePodReport(offerId);
```

Copy recomendado:

```txt
ReportHeader: Expediente POD Marketplace
SummarySection: Resumen operativo
ManifestSection: Manifiesto de ruta pública
PhotoGallery: Evidencia fotográfica del POD
TimelineSection: Cadena de custodia marketplace
```

## Paso 6 — Redirects legacy

### `frontend/src/app/inspecciones/page.tsx`

```tsx
import { redirect } from 'next/navigation';

export default function LegacyInspectionsPage() {
  redirect('/pod-marketplace');
}
```

### `frontend/src/app/inspecciones/[offerId]/page.tsx`

```tsx
import { redirect } from 'next/navigation';

export default async function LegacyInspectionDetailPage({
  params,
}: {
  params: Promise<{ offerId: string }>;
}) {
  const { offerId } = await params;
  redirect(`/pod-marketplace/${offerId}`);
}
```

## Paso 7 — Navegación

Archivo:

```txt
frontend/src/components/layouts/DashboardLayout.tsx
```

Cambiar item:

```diff
- id: 'inspections',
- labelKey: 'nav.inspections',
- fallbackLabel: 'Inspecciones',
- href: '/inspecciones',
+ id: 'pod-marketplace',
+ labelKey: 'nav.podMarketplace',
+ fallbackLabel: 'Evidencia Digital MK',
+ href: '/pod-marketplace',
```

## Paso 8 — i18n

### `frontend/public/locales/es-CO/common.json`

```diff
"nav": {
  ...
- "inspections": "Inspecciones",
+ "inspections": "Evidencia Digital MK",
+ "podMarketplace": "Evidencia Digital MK",
}
```

### `frontend/public/locales/en/common.json`

```json
"podMarketplace": "Marketplace Digital Evidence"
```

### `frontend/public/locales/pt-BR/common.json`

```json
"podMarketplace": "Evidência Digital MK"
```

## Paso 9 — CTA en Mis Ofertas

Archivo:

```txt
frontend/src/app/ofertas/mis-ofertas/page.tsx
```

En acciones de `OfferCard`, agregar un botón para estados operativos:

```tsx
{(['reserved', 'in_progress', 'completed'] as OfferStatus[]).includes(offer.status) ? (
  <Button asChild size="sm" variant="outline">
    <Link href={`/pod-marketplace/${offer.id}`}>
      <Eye className="h-4 w-4" />
      Evidencia
    </Link>
  </Button>
) : null}
```

No mostrar para `draft`, `active`, `cancelled`, `expired` salvo que producto decida mostrar expediente vacío.

## Paso 10 — No tocar flota privada

No modificar:

```txt
frontend/src/app/dashboard/flota/page.tsx
frontend/src/app/viajes-asignados/page.tsx
frontend/src/app/api/business/fleet/signatures/route.ts
frontend/src/components/trips/TripSignatureCapture.tsx
frontend/src/lib/private-fleet/**
```

Solo leerlos para validar separación.
