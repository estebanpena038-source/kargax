# LAST-MILLA — Control de margen logístico para KargaX

## Decisión CTO/CEO

Sí se implementa, pero como **módulo Enterprise analítico-operativo**, no como sistema que mueve dinero.

Nombre comercial recomendado: **Control de margen**.

Tesis vendible:

> KargaX centraliza contratos, costos reales, evidencia de entrega, score de proveedor y alertas de renegociación para detectar fuga de margen en última milla y convertirla en acciones operativas.

## Qué resuelve

Empresas medianas/grandes con flota privada, marketplace y proveedores externos pierden margen porque:

- contratan transportadores por WhatsApp, Excel o acuerdos sueltos;
- no congelan tarifa pactada por ruta/proveedor;
- no comparan costo esperado vs costo final;
- no conectan evidencia/POD/novedades con liquidación y reclamos;
- renegocian tarde y con datos incompletos.

LAST-MILLA convierte esa operación en:

1. **Proveedores normalizados**.
2. **Rutas/lane estandarizadas**.
3. **Contratos y tarifas versionadas**.
4. **Snapshots de costo por viaje**.
5. **Scorecards por proveedor**.
6. **Inbox de renegociación**.
7. **Auditoría multiempresa**.

## Regla cero

Este módulo **no mueve dinero**.

No debe tocar:

- `wallets.available_balance`;
- `wallets.pending_balance`;
- `transactions`;
- `payout_attempts`;
- estado de Mercado Pago;
- webhook `/api/payments/webhook`;
- release de nómina/flota privada.

Lee operación y escribe únicamente tablas `last_mile_*`.

## Ruta y APIs recomendadas

```text
UI:  /dashboard/control-margen
API: /api/last-mile/*
DB:  public.last_mile_*
```

## Estructura de esta carpeta

```text
LAST-MILLA/
├── README.md
├── 00_SOURCE_MAP.md
├── 01_DECISION_PRODUCTO_NEGOCIO.md
├── 02_MODELO_DATOS_MIGRACION.md
├── 03_BACKEND_APIS_SERVICIOS.md
├── 04_FRONTEND_UX_DASHBOARD.md
├── 05_ALGORITMOS_SCORE_ALERTAS.md
├── 06_SECURITY_RLS_BILLING_WALLET_RISKS.md
├── 07_TESTING_QA_RELEASE_RUNBOOK.md
├── 08_CODEX_IMPLEMENTATION_PROMPT.md
├── 09_EXECUTION_BACKLOG.md
├── 10_IMPLEMENTATION_DIFF_PLAN.md
├── GIT_COMMIT_INSTRUCTIONS.md
├── sql/
│   └── 20260527_last_mile_margin_control_DRAFT.sql
└── code-skeletons/
    ├── last-mile-types.md
    ├── last-mile-client.md
    ├── last-mile-server-service.md
    ├── last-mile-api-routes.md
    └── control-margen-page.md
```

## MVP incluido

- Alta de proveedores/carriers.
- Alta de rutas/lane.
- Contratos por proveedor/ruta.
- Versionado/auditoría de contratos.
- Sync manual de costos por periodo/oferta.
- Cálculo de costo pactado, costo final y sobrecosto.
- Evidencia score usando POD/firma/foto/novedades cuando existan.
- Score mensual por proveedor.
- Recomendaciones de renegociación.
- Paywall Enterprise server-side.
- UI ejecutiva `/dashboard/control-margen`.

## No incluido en MVP

- Renegociación automática enviada al proveedor.
- Pagos automáticos.
- Marketplace split.
- Wallet release.
- Modelo IA autónomo cambiando tarifas.
- Importación masiva de facturas externas.

## Definition of done

1. Migración nueva idempotente en `supabase/migrations/20260527_last_mile_margin_control.sql`.
2. Server domain en `frontend/src/lib/server/last-mile/`.
3. Tipos/cliente en `frontend/src/lib/last-mile/`.
4. API routes en `frontend/src/app/api/last-mile/`.
5. UI en `frontend/src/app/dashboard/control-margen/page.tsx`.
6. Nav en `DashboardLayout.tsx`.
7. Plan Enterprise habilita `feature_matrix.last_mile_margin_control`.
8. Ningún test modifica wallet/pagos/webhook.
9. `npm run check:release` pasa.


## Actualización de planes y límites — 2026-05-27

La función Last-Mile queda alineada con los planes comerciales actuales de KargaX:

```text
Free: $0 COP, 50 viajes/mes, sin Control de Margen.
Growth: $299.000 COP/mes, 500 viajes/mes, teaser/paywall.
Scale: $799.000 COP/mes, 2.000 viajes/mes, scorecards básicos read-only.
Enterprise: desde $2.500.000 COP/mes, Control de Margen base.
Enterprise Margin OS: desde $4.500.000 COP/mes, módulo avanzado con alertas, renegociación y exportes.
Enterprise Corporate: $8M–$15M COP/mes, multiempresa/SLA/auditoría.
```

Archivos nuevos de pricing:

```text
13_PLANES_LIMITES_PRICING_LAST_MILE.md
14_FRONTEND_DIFF_PLANES_LIMITES.md
15_COMMERCIAL_PRICING_LAST_MILE.md
sql/20260527_last_mile_pricing_and_limits_DRAFT.sql
```

Regla: no editar migraciones antiguas. El dev debe crear una migración nueva en `supabase/migrations/` usando el draft SQL incluido.
