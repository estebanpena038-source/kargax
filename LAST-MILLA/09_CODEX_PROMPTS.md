# 09 — Prompts para Codex / agente IA

## Prompt maestro

```text
Actúa como senior founding engineer de KargaX. Implementa el módulo LAST-MILLA siguiendo la carpeta LAST-MILLA/ completa.

Reglas obligatorias:
- No edites migraciones antiguas.
- No toques wallet/pagos para escribir desde last-mile.
- No cambies Mercado Pago webhook.
- No cambies process_successful_payment.
- Todas las tablas nuevas llevan business_id y RLS.
- Todas las APIs filtran business_id server-side.
- UI en español operativo.
- Feature gate por billing_plans.feature_matrix.
- Mantener patrón de apiSuccess/apiError.
- Antes de modificar, lee los archivos indicados en LAST-MILLA/00_AUDITORIA_ARQUITECTURA_KARGAX.md.

Objetivo:
Crear /dashboard/control-margen con contratos, snapshots, scorecards, alertas y renegociaciones, como feature Enterprise.

Entrega:
- Diff completo.
- Migración nueva.
- Pruebas ejecutadas.
- Riesgos.
- Siguiente paso.
```

## Prompt 1 — Auditoría previa

```text
Lee estos archivos antes de implementar:
- README.md
- package.json
- frontend/package.json
- frontend/src/lib/server/route-auth.ts
- frontend/src/lib/server/api-response.ts
- frontend/src/lib/server/warehouses.ts
- frontend/src/lib/warehouses/client.ts
- frontend/src/lib/warehouses/types.ts
- frontend/src/components/layouts/DashboardLayout.tsx
- frontend/src/app/api/payments/webhook/route.ts
- frontend/src/lib/server/payments/freight-settlement.ts
- supabase/migrations/023_warehouse_management_and_saas.sql
- supabase/migrations/035_private_fleet_b2b.sql
- LAST-MILLA/*.md

Devuelve:
1. columnas exactas disponibles en cargo_offers/payments/picking_events/trip_signature_evidences;
2. rutas/API existentes que se pueden reutilizar;
3. riesgos antes de escribir código;
4. plan de commits.
```

## Prompt 2 — Migración DB

```text
Implementa una migración nueva para LAST-MILLA usando LAST-MILLA/02_MODELO_DATOS_MIGRACION.md.

Requisitos:
- Crear tablas last_mile_*.
- RLS en todas las tablas.
- Índices por business_id, provider_key, offer_id, status.
- Feature flags en billing_plans.feature_matrix.
- No editar migraciones antiguas.
- Usar nombres consistentes con el repo.
- Validar que funciones helper existentes como user_manages_business existan; si no, crear alternativa compatible.

Luego ejecuta o indica:
- npm run supabase:inspect
- consultas SQL de validación.
```

## Prompt 3 — Backend services

```text
Crea servicios server-only para last-mile:
- access.ts
- contracts.ts
- cost-engine.ts
- snapshots.ts
- alerts.ts
- scorecards.ts
- renegotiations.ts

Usa:
- requireAal2Route
- resolveBusinessAccessContext
- resolveScopedBusinessId
- apiSuccess/apiError

Prohibido:
- escribir a wallets
- escribir a payments.status
- llamar process_successful_payment
- modificar webhook Mercado Pago

Incluye Zod validation y errores con códigos LAST_MILE_*.
```

## Prompt 4 — APIs

```text
Crea rutas API:
- GET/POST /api/last-mile/contracts
- PATCH/DELETE /api/last-mile/contracts/[id]
- GET /api/last-mile/dashboard
- POST /api/last-mile/snapshots/recompute
- GET/PATCH /api/last-mile/alerts/[id]
- GET/POST /api/last-mile/renegotiations
- PATCH /api/last-mile/renegotiations/[id]
- POST /api/jobs/last-mile/recompute

Cada API debe:
- usar requestId;
- devolver apiSuccess/apiError;
- filtrar por businessId;
- validar permisos;
- no exponer datos cross-tenant;
- mapear errores con status correcto.
```

## Prompt 5 — Frontend

```text
Crea UI para /dashboard/control-margen siguiendo LAST-MILLA/04_FRONTEND_UX_DASHBOARD.md.

Componentes:
- LastMileDashboard
- LastMileKpiCards
- MarginAlertsPanel
- ProviderScorecardTable
- ContractsTable
- RenegotiationPipeline
- RouteCostSnapshotsTable
- LastMilePaywall
- LastMileEmptyState

Reglas:
- Copy en español.
- Loading/error/empty/paywall states.
- Responsive.
- No mostrar para truckers.
- No prometer ahorro garantizado.
```

## Prompt 6 — Navegación

```text
Edita DashboardLayout para agregar “Control de margen” como nav item business/admin.

Ubicación recomendada: después de Inteligencia y antes de Planes.

No debe aparecer para trucker.
```

## Prompt 7 — QA seguridad

```text
Ejecuta QA del módulo LAST-MILLA siguiendo LAST-MILLA/08_QA_RUNBOOK.md.

Valida especialmente:
- Business A no ve Business B.
- Free/Growth no ven datos reales.
- Trucker no ve el módulo.
- Recompute no cambia wallets/payments/transactions.
- Recompute es idempotente.
- Alertas no duplican dedupe_key.
- Build/typecheck/lint pasan.

Entrega tabla con resultados.
```

## Prompt 8 — Code review final

```text
Haz code review como CTO de KargaX del PR de LAST-MILLA.

Busca:
- escrituras accidentales a wallet/pagos;
- falta de business_id;
- APIs sin requireAal2Route;
- feature gate solo client-side;
- logs con secretos;
- migraciones antiguas editadas;
- consultas sin índices;
- UI con copy de ahorro garantizado;
- errores sin requestId.

Devuelve blockers, warnings y fixes.
```

## Prompt 9 — Comercial

```text
Usando LAST-MILLA/10_COMMERCIAL_DEMO_PLAYBOOK.md, crea una página COMMERCIAL/last-mile-margin-control.md con:
- pitch de 30 segundos;
- demo script;
- objeciones;
- pricing recomendado;
- KPIs;
- checklist de discovery para cliente enterprise.
```
