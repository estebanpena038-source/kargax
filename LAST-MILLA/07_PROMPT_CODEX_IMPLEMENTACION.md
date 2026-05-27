# 07 — Prompt para Codex/IA implementadora

Copia este prompt completo en Codex o en tu agente de desarrollo.

```text
Actúa como founding engineer senior de KargaX. Implementa el módulo LAST-MILLA / Control de margen siguiendo estrictamente la documentación de la carpeta LAST-MILLA/.

Contexto repo:
- App principal: frontend/
- Migraciones: supabase/migrations/
- Rutas API Next: frontend/src/app/api/**/route.ts
- Service server: frontend/src/lib/server/**
- Clientes frontend: frontend/src/lib/**/client.ts
- Tipos: frontend/src/lib/**/types.ts
- Layout dashboard: frontend/src/components/layouts/DashboardLayout.tsx

Objetivo:
Crear un módulo enterprise llamado Control de margen que permita estandarizar contratos de última milla, calcular costo esperado vs costo real por viaje, generar scorecards de proveedores y alertas de renegociación.

Reglas críticas:
1. No tocar wallet para generar saldos.
2. No tocar Mercado Pago webhook.
3. No tocar freight-settlement.
4. No editar migraciones anteriores.
5. Crear nueva migración en supabase/migrations/20260527_last_mile_margin_control.sql a partir de LAST-MILLA/sql/20260527_last_mile_margin_control_DRAFT.sql.
6. Todas las tablas nuevas deben tener business_id y RLS.
7. Todas las rutas sensibles deben usar requireAal2Route.
8. Resolver business scope con resolveBusinessAccessContext + resolveScopedBusinessId.
9. Mantener copy en español operativo.
10. No inventar columnas existentes de cargo_offers si TypeScript/SQL no las confirma. Si falta una columna, manejar fallback o proponer migración.

Implementa en este orden:

Fase 1 — DB
- Copiar y ajustar migración SQL.
- Validar RLS.
- Actualizar billing_plans.feature_matrix para enterprise.

Fase 2 — Tipos
- Crear frontend/src/lib/last-mile/types.ts.

Fase 3 — Service
- Crear frontend/src/lib/server/last-mile.ts.
- Implementar access context, feature gate, contratos, summary, sync, scorecards, recommendations.

Fase 4 — API
- Crear rutas:
  - /api/last-mile/summary
  - /api/last-mile/contracts
  - /api/last-mile/contracts/[contractId]
  - /api/last-mile/carriers
  - /api/last-mile/lanes
  - /api/last-mile/observations/sync
  - /api/last-mile/scorecards
  - /api/last-mile/recommendations
  - /api/last-mile/recommendations/[recommendationId]

Fase 5 — Client
- Crear frontend/src/lib/last-mile/client.ts con requestEnvelope similar a warehouseClient.

Fase 6 — UI
- Crear frontend/src/app/dashboard/control-margen/page.tsx.
- Reusar DashboardLayout, EnterpriseHero, EnterpriseMetric, SectionHeader, StatusPill, Card, Button, toast.
- Agregar nav en DashboardLayout después de Inteligencia.

Fase 7 — Billing UI
- Agregar “Control de margen” a highlights de Enterprise en frontend/src/app/planes/page.tsx.
- Scale puede mostrar “preview read-only” si feature_matrix lo permite.

Fase 8 — QA
- Ejecutar:
  npm run repo:audit
  npm --prefix frontend run typecheck
  npm --prefix frontend run lint
  npm --prefix frontend run build
  npm run check:release

Criterios de aceptación:
- Enterprise owner ve dashboard y crea contratos.
- Growth/Free reciben paywall 402.
- Finance ve costos, ops gestiona recomendaciones, viewer/trucker bloqueados.
- Sync es idempotente.
- No cambia wallets/transactions/payout_attempts.
- No cambia payments webhook.
- Build/lint/typecheck pasan.
```
