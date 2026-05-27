# 00 — Fuentes revisadas y mapa de arquitectura

## Fuentes internas revisadas

### ZIP `KARGAX_AI_OPERATING_SYSTEM`

Hallazgos:

- KargaX es un SaaS logístico B2B para empresas con bodegas, flota, despachos, transportadores, evidencia, marketplace, wallet/liquidaciones, planes y reportes.
- El producto no se debe vender como tracking. La tesis correcta es **cierre logístico verificable**.
- Cualquier cambio de schema debe ir en nueva migración.
- Cualquier cambio en billing, wallet, RLS o datos multiempresa es riesgo alto.
- Pricing y planes deben tocar UI + DB seed + comercial.

### ZIP `WALLET`

Hallazgos:

- Marketplace freelancer y flota privada no usan el mismo carril de dinero.
- Marketplace puede entrar a wallet/payout cuando hay pago real confirmado.
- Flota privada debe operar como liquidación/comprobante externo al inicio.
- La wallet no crea dinero; representa movimientos verificables.
- Control de margen no debe sumar saldos ni generar retiros.

### ZIP `CLIENTES4.0`

Hallazgos:

- Mensaje comercial ganador: cierre probado de entrega.
- ICP: empresas B2B con despachos recurrentes, varias referencias, flota propia/tercerizada, bodegas y reclamos por evidencia dispersa.
- No-go: operaciones sin despacho recurrente, tickets muy bajos o logística sin dolor propio.

## Repo KargaX revisado

### Raíz

```text
README.md
package.json
frontend/
supabase/migrations/
SPTRINTS/
COMMERCIAL/
legacy/
```

### Frontend

Stack observado:

```text
Next 16
React 19
Supabase SSR/JS
Mercado Pago SDK
TanStack Query/Table
Recharts
jsPDF
Zod
Zustand
Tailwind
```

### Patrón de API

Las rutas usan:

```ts
import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute, requireAal2Route } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
```

Regla:

- Rutas financieras/sensibles: `requireAal2Route`.
- Rutas operativas normales: `requireAuthenticatedRoute`.
- Siempre `requestId`.
- Siempre envelope `apiSuccess/apiError`.

### Patrón de cliente frontend

`frontend/src/lib/warehouses/client.ts` centraliza `getAuthHeaders`, `request`, `requestEnvelope` y métodos como:

```ts
getBillingSubscription()
getBillingUsage()
getWarehouseAccess()
getBusinessFleet()
getPrivateFleetPayroll()
```

La implementación de Last Mile debe copiar ese patrón en `frontend/src/lib/last-mile/client.ts`, no meter fetch suelto en cada componente.

## Módulos existentes que se conectan con Last Mile

### Billing

Archivos clave:

```text
frontend/src/app/planes/page.tsx
frontend/src/lib/billing/pricing.ts
frontend/src/lib/billing/plan-limits.ts
frontend/src/app/api/billing/subscription/route.ts
frontend/src/app/api/billing/subscription/usage/route.ts
```

Regla:

- No activar módulo a planes sin feature flag.
- Enterprise debe tener `last_mile_margin_control = true`.
- Scale puede tener `last_mile_margin_control_read_only = true`.

### Bodegas

Archivos clave:

```text
frontend/src/app/api/warehouses/route.ts
frontend/src/lib/server/warehouses.ts
frontend/src/lib/warehouses/types.ts
frontend/src/lib/warehouses/client.ts
supabase/migrations/023_warehouse_management_and_saas.sql
```

Last Mile debe usar bodegas para lanes, pero no debe depender de que cada ruta tenga warehouse.

### Flota privada

Archivos clave:

```text
frontend/src/app/api/business/fleet/route.ts
frontend/src/app/api/business/fleet/payroll/**
supabase/migrations/035_private_fleet_b2b.sql
```

Last Mile debe leer flota privada como proveedor/costo, pero no debe cambiar nómina ni liberar wallet.

### Marketplace/pagos

Archivos clave:

```text
frontend/src/app/api/payments/webhook/route.ts
frontend/src/lib/server/payments/freight-settlement.ts
frontend/src/lib/contracts/payments.ts
```

No tocar en V1.

### Wallet

Archivos clave:

```text
frontend/src/app/api/wallet/route.ts
```

No tocar en V1.

### Inteligencia/reportes

Archivos clave:

```text
frontend/src/app/dashboard/inteligencia/page.tsx
frontend/src/app/api/reports/business-monthly/route.ts
```

Last Mile puede reutilizar el estilo visual de inteligencia, pero debe tener dominio propio porque controla contratos/renegociaciones.

## Arquitectura objetivo

```text
UI /dashboard/control-margen
        ↓
frontend/src/lib/last-mile/client.ts
        ↓
/api/last-mile/*
        ↓
frontend/src/lib/server/last-mile.ts
        ↓
Supabase service-role + RLS-aware business scope
        ↓
last_mile_* tables + cargo_offers + business_fleet_members + trip_financial_allocations + warehouse_incidents/evidence
```

## Regla de no ruptura

No modificar estos archivos en MVP salvo que haya un issue explícito:

```text
frontend/src/app/api/payments/webhook/route.ts
frontend/src/lib/server/payments/freight-settlement.ts
frontend/src/app/api/wallet/route.ts
frontend/src/lib/contracts/payments.ts
```
