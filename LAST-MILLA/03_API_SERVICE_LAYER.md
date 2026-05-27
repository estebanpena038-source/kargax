# 03 — API y service layer

## Decisión

Crear un service server-only:

```text
frontend/src/lib/server/last-mile.ts
```

Y rutas API:

```text
frontend/src/app/api/last-mile/summary/route.ts
frontend/src/app/api/last-mile/contracts/route.ts
frontend/src/app/api/last-mile/contracts/[contractId]/route.ts
frontend/src/app/api/last-mile/carriers/route.ts
frontend/src/app/api/last-mile/lanes/route.ts
frontend/src/app/api/last-mile/observations/sync/route.ts
frontend/src/app/api/last-mile/scorecards/route.ts
frontend/src/app/api/last-mile/recommendations/route.ts
frontend/src/app/api/last-mile/recommendations/[recommendationId]/route.ts
```

## Patrón obligatorio

Todas las rutas deben seguir el patrón existente de KargaX:

```ts
const requestId = getRequestId(request);
const auth = await requireAal2Route(request);
if ('response' in auth) return auth.response;
```

Razón: contratos, costos, margen y renegociación son datos sensibles de negocio.

## Autorización

Usar:

```ts
resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile)
resolveScopedBusinessId({ requestedBusinessId, resolvedBusinessId, profile })
getBusinessRoleCapabilities(effectiveRole)
```

Permisos mínimos:

| Acción | Roles |
|---|---|
| Ver dashboard | owner, admin, manager, ops_manager, finance_accountant, auditor |
| Ver costos | owner, admin, manager, finance_accountant, auditor |
| Crear/editar contratos | owner, admin, manager |
| Ejecutar sync | owner, admin, manager, finance_accountant |
| Cambiar estado de recomendación | owner, admin, manager, ops_manager, finance_accountant |
| Exportar | owner, admin, manager, finance_accountant, auditor |

`viewer` puede ver resumen operativo sin montos si se decide habilitar preview, pero no para V1 enterprise.

## Feature gate

Agregar helper:

```ts
export function hasLastMileMarginControl(subscription, plans) {
  const plan = subscription?.plan;
  const matrix = plan?.feature_matrix || {};
  return Boolean(matrix.last_mile_margin_control);
}
```

Para Scale preview:

```ts
Boolean(matrix.last_mile_margin_control_read_only)
```

## Endpoints

### `GET /api/last-mile/summary`

Query:

```text
?month=2026-05&businessId=<admin-only>
```

Response:

```ts
{
  period: { start: string; end: string };
  access: { canManageContracts: boolean; canViewFinancials: boolean; readOnly: boolean };
  metrics: {
    totalTrips: number;
    observedTrips: number;
    totalAgreedCostCop: number;
    totalFinalCostCop: number;
    leakageCop: number;
    avgOverrunPct: number;
    evidenceCompleteRate: number;
    openRecommendations: number;
    criticalRecommendations: number;
  };
  topRoutes: Array<...>;
  topCarriers: Array<...>;
  recommendations: Array<...>;
}
```

### `GET /api/last-mile/contracts`

Lista contratos por business.

Filtros:

```text
status
carrierId
laneId
providerType
```

### `POST /api/last-mile/contracts`

Crea contrato y evento `created`.

Validaciones:

- `carrierId` requerido.
- `pricingModel` requerido.
- `baseRateCop >= 0`.
- `startsAt` requerido.
- Si hay contrato activo mismo carrier/lane, permitir solo si fechas no se cruzan o pausar anterior.

### `PATCH /api/last-mile/contracts/[contractId]`

Actualiza contrato y evento de auditoría.

Regla:

- Si cambia tarifa o modelo, crear evento `rate_changed`.
- Si cambia `status`, crear evento `activated|paused|expired`.
- Nunca borrar contrato.

### `POST /api/last-mile/observations/sync`

Crea `last_mile_analysis_runs` y recalcula observaciones.

Payload:

```ts
{
  month?: string;
  offerId?: string;
  dryRun?: boolean;
}
```

Output:

```ts
{
  runId: string;
  processedOffers: number;
  createdObservations: number;
  updatedObservations: number;
  createdRecommendations: number;
  dryRun: boolean;
}
```

## Algoritmo de sync

### Paso 1: Scope

Resolver `businessId` y periodo.

### Paso 2: Cargar ofertas

Leer `cargo_offers` por business y periodo.

Campos mínimos esperados:

```text
id
business_id
status
total_amount
platform_fee
net_amount
is_private_fleet
assigned_trucker_id
private_fleet_trucker_id
origin_department
origin_city
destination_department
destination_city
cargo_type
vehicle_type
created_at
updated_at
```

### Paso 3: Resolver carrier

Orden recomendado:

1. `private_fleet_trucker_id` si `is_private_fleet = true`.
2. `assigned_trucker_id` si marketplace.
3. proveedor externo manual si existe mapping.
4. crear carrier `external_provider/prospect` solo si payload manual lo permite.

### Paso 4: Resolver lane

Crear o buscar lane por `lane_key`.

### Paso 5: Resolver contrato activo

Buscar contrato:

1. mismo carrier + lane + status active + fecha vigente;
2. mismo carrier + lane null/global;
3. contrato `marketplace_observed` si no hay manual.

### Paso 6: Calcular costos

MVP:

```text
agreed_cost_cop = cargo_offers.total_amount
expected_cost_cop = contrato calculado
final_cost_cop = total_amount o allocations según flota privada
overrun_cop = final_cost_cop - expected_cost_cop
overrun_pct = overrun_cop / expected_cost_cop
```

Flota privada:

```text
final_cost_cop = freight_payment_amount + expense_allowance_amount + allocations liberadas/held relacionadas
```

Marketplace:

```text
final_cost_cop = net_amount + platform_fee
```

No usar wallet balance.

### Paso 7: Evidence score

MVP heurístico:

```text
100 = cierre completado + evidencia mínima
70 = completado pero evidencia parcial
40 = viaje con novedad/incidente sin soporte completo
0 = sin evidencia
```

Sources posibles:

- `trip_signature_evidences`.
- `warehouse_incidents`.
- campos de POD si existen en `cargo_offers`.

### Paso 8: Recommendations

Crear alertas si:

- `overrun_pct > 10%` y `overrun_cop > 200000` acumulado.
- proveedor con `evidence_complete_rate < 85%`.
- proveedor con `incident_rate > 8%`.
- contrato vence en menos de 30 días.
- proveedor con volumen alto y costo estable: recomendar descuento por volumen.

## Service layer recomendado

Funciones:

```ts
resolveLastMileAccessContext()
listLastMileContracts()
createLastMileContract()
updateLastMileContract()
getLastMileSummary()
syncLastMileObservations()
generateProviderScorecards()
generateRenegotiationRecommendations()
updateRecommendationStatus()
```

## Manejo de errores

Códigos:

```text
LAST_MILE_FORBIDDEN
LAST_MILE_FEATURE_DISABLED
LAST_MILE_CONTRACT_VALIDATION_ERROR
LAST_MILE_CONTRACT_NOT_FOUND
LAST_MILE_SYNC_FAILED
LAST_MILE_RECOMMENDATION_NOT_FOUND
```

## Observabilidad

Cada sync debe crear row en `last_mile_analysis_runs`.

Cada cambio sensible debe crear row en `last_mile_contract_events`.

Opcional: `createAdminNotification` para incidentes severos:

```text
- Sync falló
- Recomendación crítica creada
- Contrato vencido con viajes activos
```
