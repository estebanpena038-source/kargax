# 09 — Diff plan y archivos exactos

## Crear archivos

```text
supabase/migrations/20260527_last_mile_margin_control.sql
frontend/src/lib/last-mile/types.ts
frontend/src/lib/last-mile/client.ts
frontend/src/lib/server/last-mile.ts
frontend/src/app/api/last-mile/summary/route.ts
frontend/src/app/api/last-mile/contracts/route.ts
frontend/src/app/api/last-mile/contracts/[contractId]/route.ts
frontend/src/app/api/last-mile/carriers/route.ts
frontend/src/app/api/last-mile/lanes/route.ts
frontend/src/app/api/last-mile/observations/sync/route.ts
frontend/src/app/api/last-mile/scorecards/route.ts
frontend/src/app/api/last-mile/recommendations/route.ts
frontend/src/app/api/last-mile/recommendations/[recommendationId]/route.ts
frontend/src/app/dashboard/control-margen/page.tsx
```

## Editar archivos

### `frontend/src/components/layouts/DashboardLayout.tsx`

Agregar item después de Inteligencia:

```ts
{
  id: 'margin-control',
  labelKey: 'nav.marginControl',
  fallbackLabel: 'Control de margen',
  icon: TrendingDown,
  href: '/dashboard/control-margen',
  allowedUserTypes: ['business', 'admin'],
}
```

Agregar import:

```ts
import { TrendingDown } from 'lucide-react';
```

Si ya existe icono financiero mejor, usar `BadgeDollarSign` o `LineChart`.

### `frontend/src/app/planes/page.tsx`

En `getPlanHighlights(plan)` agregar:

```ts
enterprise: [
  'Holding multiempresa con vista corporativa',
  'Aprobaciones, auditoria, treasury y soporte premium',
  'Control de margen: contratos, costos reales y alertas de renegociacion',
  getSupportLabel(plan),
]
```

Para Scale opcional:

```ts
'Scorecards y preview read-only de control de margen'
```

### `frontend/src/lib/billing/plan-limits.ts`

Opcional si se quiere paywall unificado:

```ts
| 'last_mile_margin_control'
```

Y label:

```ts
last_mile_margin_control: 'control de margen logístico'
```

### `frontend/src/lib/business-roles.ts`

Opción simple: no agregar capabilities nuevas y usar `canViewFinance`, `canViewOperations`, `canViewIntelligence`.

Opción avanzada recomendada:

Agregar:

```ts
canViewMarginControl: boolean;
canManageMarginContracts: boolean;
canResolveMarginRecommendations: boolean;
```

Permisos:

```text
admin/owner: true/true/true
manager: true/true/true
finance_accountant: true/false/true
ops_manager: true/false/true
dispatcher: true/false/true
auditor: true/false/false
viewer: false/false/false
```

Si se hace esto, actualizar todas las entradas del matrix para no romper TypeScript.

## No editar

```text
frontend/src/app/api/payments/webhook/route.ts
frontend/src/lib/server/payments/freight-settlement.ts
frontend/src/lib/contracts/payments.ts
frontend/src/app/api/wallet/route.ts
```

## Orden seguro de PR

### PR 1 — DB + docs

- migration;
- docs;
- feature flags.

### PR 2 — service + API

- types;
- server service;
- routes;
- tests manuales API.

### PR 3 — UI

- dashboard;
- client;
- nav;
- planes copy.

### PR 4 — QA + Comercial

- COMMERCIAL;
- scripts demo;
- runbook.

## Criterios de merge

```text
[ ] No hay writes a wallet
[ ] No hay cambios en webhook Mercado Pago
[ ] No hay migraciones antiguas editadas
[ ] RLS activo
[ ] Build OK
[ ] Enterprise ve módulo
[ ] Free/Growth bloqueados
[ ] Sync idempotente
```
