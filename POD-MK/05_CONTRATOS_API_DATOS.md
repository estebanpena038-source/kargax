# 05 — Contratos API y datos para POD-MK

## Contrato principal

```ts
export type MarketplacePodStatus =
  | 'pending'
  | 'in_progress'
  | 'loading'
  | 'delivery'
  | 'completed'
  | 'cancelled';

export type MarketplacePodPhase = 'loading' | 'delivery';

export interface MarketplacePodReport {
  offerId: string;
  status: MarketplacePodStatus;
  phase: MarketplacePodPhase;
  trucker: MarketplacePodTruckerInfo;
  route: MarketplacePodRouteInfo;
  cargoType?: string;
  cargoDescription?: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  arrivedAtOriginAt?: string;
  loadingStartedAt?: string;
  loadingCompletedAt?: string;
  pickupVerifiedAt?: string;
  arrivedAtDestinationAt?: string;
  unloadingStartedAt?: string;
  unloadingCompletedAt?: string;
  deliveryVerifiedAt?: string;
  originLocation?: MarketplacePodVerifiedLocation;
  destinationLocation?: MarketplacePodVerifiedLocation;
  summary: MarketplacePodSummary;
  manifestItems: MarketplacePodManifestItem[];
  timeline: MarketplacePodTimelineEvent[];
  photos: MarketplacePodPhoto[];
}
```

## API pública del módulo

```ts
export async function getMarketplacePodReport(
  offerId: string
): Promise<GetMarketplacePodReportResponse>;

export async function getMarketplacePodList(
  businessId: string,
  options?: {
    limit?: number;
    status?: MarketplacePodStatus | 'all' | 'issues';
  }
): Promise<GetMarketplacePodListResponse>;
```

## Respuesta detalle

```ts
export interface GetMarketplacePodReportResponse {
  success: boolean;
  data?: MarketplacePodReport;
  error?: string;
  errorCode?:
    | 'NOT_FOUND'
    | 'FORBIDDEN'
    | 'PRIVATE_FLEET_ROUTE_NOT_ALLOWED'
    | 'MARKETPLACE_POD_QUERY_FAILED'
    | string;
}
```

## Respuesta lista

```ts
export interface MarketplacePodListItem {
  offerId: string;
  status: MarketplacePodStatus;
  phase: MarketplacePodPhase;
  trucker: {
    id: string;
    fullName: string;
  };
  route: {
    originCity: string;
    destinationCity: string;
  };
  summary: MarketplacePodSummary;
  createdAt: string;
}

export interface GetMarketplacePodListResponse {
  success: boolean;
  data?: MarketplacePodListItem[];
  error?: string;
  errorCode?: string;
}
```

## Event types

Mantener los eventos actuales porque son correctos para POD:

```ts
export type MarketplacePodEventType =
  | 'arrival_origin'
  | 'loading_started'
  | 'item_loaded'
  | 'item_load_issue'
  | 'loading_completed'
  | 'pickup_verified'
  | 'arrival_destination'
  | 'unloading_started'
  | 'item_delivered'
  | 'item_rejected'
  | 'unloading_completed'
  | 'delivery_verified'
  | 'photo_added';
```

## Fuentes de datos por campo

| Campo POD-MK | Fuente |
|---|---|
| `offerId` | `cargo_offers.id` |
| `status` | `cargo_offers.status`, `pickup_verified_at`, `delivery_verified_at` |
| `phase` | calculado por `pickup_verified_at` |
| `trucker` | `cargo_offers.assigned_trucker_id` -> `user_profiles` |
| `route` | `origin_*`, `destination_*` |
| `manifestItems` | `cargo_offers.manifest_items` enriquecido con `picking_events` |
| `timeline` | `picking_events` ordenado por `created_at` |
| `photos` | `cargo_offers.trip_photos` + `picking_events.photo_urls` |
| `summary` | cálculo frontend/lib |

## Errores de UX

```ts
const POD_MARKETPLACE_ERRORS = {
  NOT_FOUND: 'No encontramos este expediente POD.',
  FORBIDDEN: 'No tienes permiso para ver esta evidencia.',
  PRIVATE_FLEET_ROUTE_NOT_ALLOWED: 'Esta evidencia pertenece a una ruta privada. Revísala desde Flota privada.',
  QUERY_FAILED: 'No pudimos cargar la evidencia digital. Intenta de nuevo.',
};
```

## Regla de compatibilidad

Durante el primer release se pueden mantener aliases para acelerar migración:

```ts
export type MarketplacePodStatus = InspectionStatus;
```

Pero la recomendación final es renombrar tipos para que el dominio quede limpio y no siga apareciendo `Inspection` en el nuevo módulo.
