# 11 — Archivos y diffs iniciales propuestos

## Objetivo

Este documento le dice al dev/IA exactamente qué tocar, qué crear y qué NO tocar.

## Crear carpeta de dominio

```text
frontend/src/lib/last-mile/
frontend/src/lib/server/last-mile/
frontend/src/components/last-mile/
frontend/src/app/api/last-mile/
frontend/src/app/dashboard/last-mile/
```

## Crear migración

```text
supabase/migrations/0XX_last_mile_margin_control.sql
```

Usar como base `02_MODELO_DATOS_MIGRACION.md`.

## Editar navegación

Archivo:

```text
frontend/src/components/layouts/DashboardLayout.tsx
```

Cambios:

1. Importar icono:

```ts
TrendingUp,
```

2. Insertar nav item después de `business-intelligence`:

```ts
{
  id: 'last-mile-margin',
  labelKey: 'nav.lastMileMargin',
  fallbackLabel: 'Control de margen',
  icon: TrendingUp,
  href: '/dashboard/last-mile',
  allowedUserTypes: ['business', 'admin'],
},
```

No poner en navegación de truckers.

## Extender tipos de billing opcional

Archivo:

```text
frontend/src/lib/billing/plan-limits.ts
```

Solo si se necesita límite explícito de contratos. En V1 se recomienda feature gate sin límite.

Si se agrega:

```ts
export type PlanLimitFeatureKey =
  | 'warehouse_limit'
  | 'team_limit'
  | 'monthly_trip_limit'
  | 'private_fleet_limit'
  | 'last_mile_contract_limit';
```

Y label:

```ts
last_mile_contract_limit: 'contratos de última milla',
```

Recomendación CTO:

- No agregar límite en el primer PR.
- Usar `feature_matrix` para reducir superficie de riesgo.

## Crear tipos last-mile

Archivo:

```text
frontend/src/lib/last-mile/types.ts
```

Debe incluir:

```text
LastMileContract
LastMileRouteCostSnapshot
LastMileProviderScorecard
LastMileMarginAlert
LastMileRenegotiationCycle
LastMileDashboardResponse
```

## Crear client

Archivo:

```text
frontend/src/lib/last-mile/client.ts
```

Debe copiar el patrón de `warehouseClient`, no usar Supabase directo en componentes.

Funciones:

```ts
getDashboard()
listContracts()
createContract(payload)
updateContract(id, payload)
archiveContract(id)
recomputeOffer(offerId)
acknowledgeAlert(id)
resolveAlert(id)
createRenegotiation(payload)
updateRenegotiation(id, payload)
```

## Crear server access

Archivo:

```text
frontend/src/lib/server/last-mile/access.ts
```

Funciones:

```ts
resolveLastMileAccess(...)
assertLastMileView(...)
assertLastMileManageContracts(...)
assertLastMileManageRenegotiations(...)
```

## Crear contracts service

Archivo:

```text
frontend/src/lib/server/last-mile/contracts.ts
```

Funciones:

```ts
listLastMileContracts(supabaseAdmin, access, filters)
createLastMileContract(supabaseAdmin, access, payload)
updateLastMileContract(supabaseAdmin, access, contractId, payload)
archiveLastMileContract(supabaseAdmin, access, contractId)
selectBestContractForOffer(supabaseAdmin, businessId, offer)
```

## Crear cost engine

Archivo:

```text
frontend/src/lib/server/last-mile/cost-engine.ts
```

Funciones puras:

```ts
calculateContractedCost(input)
calculateActualCost(input)
calculateMargin(input)
calculateCostVariance(input)
computeEvidenceScore(input)
scoreContractMatch(contract, offer)
```

Estas funciones deben tener unit tests si el repo tiene framework de test. Si no, crear pruebas manuales documentadas.

## Crear snapshots service

Archivo:

```text
frontend/src/lib/server/last-mile/snapshots.ts
```

Funciones:

```ts
loadOfferForLastMile(...)
loadLatestPayment(...)
loadEvidenceSignals(...)
loadIncidentSignals(...)
recomputeLastMileOfferSnapshot(...)
recomputeLastMileBatch(...)
```

Regla:

- Upsert por `offer_id`.
- No throw fatal para alert generation; snapshot debe persistir aunque alert falle.

## Crear dashboard service

Archivo sugerido:

```text
frontend/src/lib/server/last-mile/dashboard.ts
```

Funciones:

```ts
loadLastMileDashboard(supabaseAdmin, access, filters)
buildLastMileSummary(rows, alerts, renegotiations)
```

## Crear APIs

```text
frontend/src/app/api/last-mile/contracts/route.ts
frontend/src/app/api/last-mile/contracts/[id]/route.ts
frontend/src/app/api/last-mile/dashboard/route.ts
frontend/src/app/api/last-mile/snapshots/recompute/route.ts
frontend/src/app/api/last-mile/scorecards/route.ts
frontend/src/app/api/last-mile/alerts/route.ts
frontend/src/app/api/last-mile/alerts/[id]/route.ts
frontend/src/app/api/last-mile/renegotiations/route.ts
frontend/src/app/api/last-mile/renegotiations/[id]/route.ts
frontend/src/app/api/jobs/last-mile/recompute/route.ts
```

## Crear UI

```text
frontend/src/app/dashboard/last-mile/page.tsx
frontend/src/components/last-mile/LastMileDashboard.tsx
frontend/src/components/last-mile/LastMileKpiCards.tsx
frontend/src/components/last-mile/ContractsTable.tsx
frontend/src/components/last-mile/ProviderScorecardTable.tsx
frontend/src/components/last-mile/MarginAlertsPanel.tsx
frontend/src/components/last-mile/RenegotiationPipeline.tsx
frontend/src/components/last-mile/RouteCostSnapshotsTable.tsx
frontend/src/components/last-mile/LastMilePaywall.tsx
frontend/src/components/last-mile/LastMileEmptyState.tsx
```

## No tocar en V1

```text
frontend/src/app/api/payments/webhook/route.ts
frontend/src/lib/server/payments/freight-settlement.ts
frontend/src/lib/server/private-fleet-payroll.ts
frontend/src/app/api/wallet/withdraw/route.ts
frontend/src/app/api/wallet/route.ts
supabase/migrations/023_warehouse_management_and_saas.sql
supabase/migrations/035_private_fleet_b2b.sql
```

Solo leerlos.

## Si se decide hook no bloqueante al cierre de entrega

Hacerlo en PR separado.

Patrón:

```ts
void fetch(`${baseUrl}/api/jobs/last-mile/recompute`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-api-key': process.env.INTERNAL_API_KEY,
  },
  body: JSON.stringify({ offerId, reason: 'delivery_completed' }),
}).catch((error) => console.error('[LastMile][NonBlockingRecompute]', error));
```

Pero recomendación V1:

- no tocar `verify_delivery_pin`;
- usar job programado + recompute manual.

## Checklist de archivos a revisar en PR

```text
[ ] No hay cambios en webhook Mercado Pago.
[ ] No hay cambios en wallet/payout.
[ ] No hay cambios en migraciones antiguas.
[ ] Todas las APIs last-mile usan auth.
[ ] Todos los selects/mutations tienen businessId.
[ ] Se añadió nav item solo business/admin.
[ ] Hay paywall.
[ ] Hay empty state.
[ ] Build pasa.
```
