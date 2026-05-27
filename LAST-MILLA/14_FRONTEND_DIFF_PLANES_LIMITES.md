# 14 — Diff de planes y límites para frontend

## Objetivo

Actualizar el copy público e interno de planes para que coincida con el pricing comercial actual de KargaX y con el módulo Last-Mile.

## Archivo: `frontend/src/app/planes/page.tsx`

### 1. Cambiar highlights dinámicos en `getPlanHighlights`

Reemplazar el bloque `byCode` por una versión alineada con Control de Margen:

```tsx
const byCode: Record<string, string[]> = {
    free: [
        '50 viajes/mes para validar operación real',
        'PIN/POD, evidencia esencial y wallet base',
        `Marketplace con ${MARKETPLACE_COMMISSION_PERCENT}% solo en viajes externos`,
        getSupportLabel(plan),
    ],
    growth: [
        '500 viajes/mes para operación B2B inicial',
        'Equipo interno, bodegas base y flota privada inicial',
        'Paywall comercial hacia Control de Margen Enterprise',
        getSupportLabel(plan),
    ],
    scale: [
        '2.000 viajes/mes para 3PL y equipos en crecimiento',
        'API/webhooks, control tower y flota privada avanzada',
        'Scorecards básicos de rutas y proveedores',
        getSupportLabel(plan),
    ],
    enterprise: [
        'Volumen personalizado bajo contrato',
        'Control de margen logístico por ruta, proveedor y zona',
        'Contratos, scorecards y alertas de sobrecosto',
        'Enterprise Margin OS desde $4.500.000 COP/mes',
        'Aprobaciones, auditoría, treasury y soporte premium',
        getSupportLabel(plan),
    ],
};
```

### 2. Cambiar pricing público en `PublicPricingPage`

Reemplazar `publicPlans` por:

```tsx
const publicPlans = [
    {
        code: 'free',
        name: 'Free',
        price: '$0 COP',
        tagline: 'Acceso operativo gratis',
        highlights: ['50 viajes/mes', '1 bodega, 3 usuarios, 3 conductores', 'PIN/POD, wallet y evidencia esencial'],
    },
    {
        code: 'growth',
        name: 'Growth',
        price: '$299.000 COP',
        tagline: 'Operación B2B inicial',
        highlights: ['500 viajes/mes', '5 bodegas, 20 usuarios, 15 conductores', 'Evidencia, bodegas base y flota privada inicial'],
    },
    {
        code: 'scale',
        name: 'Scale',
        price: '$799.000 COP',
        tagline: '3PL y automatización',
        highlights: ['2.000 viajes/mes', '25 bodegas y 100 usuarios', 'API/webhooks, control tower y scorecards básicos'],
    },
    {
        code: 'enterprise',
        name: 'Enterprise',
        price: 'Desde $2.500.000 COP',
        tagline: 'Volumen personalizado',
        highlights: [
            'Control de margen logístico',
            'Contratos por proveedor/ruta/zona',
            'Alertas de sobrecosto y auditoría',
            'Margin OS avanzado desde $4.500.000 COP',
        ],
    },
];
```

### 3. Cambiar descripción del hero público

Usar:

```tsx
description={`Free, Growth y Scale entran por capacidad operativa. Enterprise agrega volumen personalizado, control de margen, contratos, scorecards y auditoría. Marketplace mantiene ${MARKETPLACE_COMMISSION_PERCENT}% solo en viajes externos.`}
```

## Archivo: `frontend/src/lib/billing/plan-limits.ts`

Agregar labels si se decide crear límites específicos:

```ts
const FEATURE_LABELS: Record<string, string> = {
    warehouse_limit: 'bodegas activas',
    team_limit: 'usuarios internos',
    monthly_trip_limit: 'viajes del mes',
    private_fleet_limit: 'conductores privados',
    last_mile_contract_limit: 'contratos de margen activos',
    last_mile_alert_limit: 'alertas de margen activas',
};
```

Y extender el union type:

```ts
export type PlanLimitFeatureKey =
    | 'warehouse_limit'
    | 'team_limit'
    | 'monthly_trip_limit'
    | 'private_fleet_limit'
    | 'last_mile_contract_limit'
    | 'last_mile_alert_limit';
```

## Archivo: `frontend/src/lib/server/last-mile/access.ts`

El gate recomendado:

```ts
export function getLastMileEntitlements(featureMatrix: Record<string, unknown> | null | undefined) {
    const matrix = featureMatrix || {};
    return {
        canViewDashboard: Boolean(matrix.last_mile_margin_dashboard || matrix.last_mile_margin_control),
        readOnly: Boolean(matrix.last_mile_margin_read_only) && !matrix.last_mile_margin_control,
        canManageContracts: Boolean(matrix.last_mile_contracts),
        canViewScorecards: Boolean(matrix.last_mile_scorecards || matrix.last_mile_margin_dashboard),
        canGenerateAlerts: Boolean(matrix.last_mile_alerts),
        canManageRenegotiations: Boolean(matrix.last_mile_renegotiations),
        canExport: Boolean(matrix.last_mile_exports),
        monthlyAlertLimit: matrix.last_mile_monthly_alert_limit === null ? null : Number(matrix.last_mile_monthly_alert_limit || 0),
        activeContractLimit: matrix.last_mile_active_contract_limit === null ? null : Number(matrix.last_mile_active_contract_limit || 0),
    };
}
```

## Paywall esperado

- Free/Growth: mostrar teaser y CTA a Enterprise.
- Scale: mostrar scorecards básicos read-only.
- Enterprise: permitir tablero + contratos + 10 alertas + 25 contratos.
- Enterprise Margin OS: activar renegociación/exportes/alertas completas por contrato comercial.

## QA manual

1. Usuario sin login ve precios públicos actualizados.
2. Free ve 50 viajes/mes.
3. Growth ve $299.000 y 500 viajes/mes.
4. Scale ve $799.000 y 2.000 viajes/mes.
5. Enterprise ve “Desde $2.500.000 COP”.
6. Copy de Enterprise menciona Control de Margen.
7. Scale no puede crear contratos Last-Mile.
8. Enterprise Base no puede usar renegociación avanzada si flag está false.
9. Backend bloquea aunque el usuario fuerce URL/API.
