# 06 — Testing, QA y release runbook

## Objetivo

Probar que Control de Margen funciona sin romper:

- pagos;
- wallet;
- flota privada;
- billing;
- reportes;
- permisos multiempresa.

## Comandos automáticos

Desde raíz:

```bash
npm install
npm run repo:audit
npm run typecheck
npm run lint
npm run build
npm run check:release
```

Desde frontend:

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
npm run check
```

## SQL QA

Aplicar migración en entorno local/staging:

```bash
supabase db push
```

Verificar tablas:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'last_mile_%'
order by table_name;
```

Verificar RLS:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'last_mile_%';
```

Verificar feature flags:

```sql
select code, feature_matrix->'last_mile_margin_control' as margin_control
from public.billing_plans
where code in ('free', 'growth', 'scale', 'enterprise');
```

## Test manual 1 — Enterprise owner

1. Login business owner con plan enterprise.
2. Ir a `/dashboard/control-margen`.
3. Debe ver dashboard.
4. Crear carrier externo.
5. Crear lane.
6. Crear contrato activo.
7. Ejecutar sync del mes.
8. Ver observaciones creadas.
9. Ver scorecards.
10. Ver recomendaciones si hay variaciones.

Resultado esperado:

```text
Dashboard carga, sync no duplica, contrato queda auditado.
```

## Test manual 2 — Growth sin feature

1. Login business owner con plan growth.
2. Ir a `/dashboard/control-margen`.
3. Debe aparecer paywall.
4. CTA a `/planes`.
5. API `/api/last-mile/summary` debe retornar 402.

Resultado esperado:

```text
No hay fuga de datos de costos ni contratos.
```

## Test manual 3 — Finance accountant

1. Login miembro `finance_accountant`.
2. Entrar a control de margen.
3. Debe ver costos.
4. Debe poder exportar si se habilita.
5. No debe poder activar/editar contrato si no se le otorga permiso explícito.

Resultado esperado:

```text
Finanzas ve datos, no cambia tarifas sin permiso.
```

## Test manual 4 — Ops manager

1. Login `ops_manager`.
2. Ver recomendaciones.
3. Cambiar recomendación de `open` a `acknowledged` o `in_negotiation`.
4. No poder editar tarifa base.

Resultado esperado:

```text
Operaciones gestiona seguimiento, no pricing.
```

## Test manual 5 — Viewer/trucker bloqueados

1. Login `viewer`.
2. Intentar `/dashboard/control-margen`.
3. Debe bloquear o mostrar sin montos si se habilita preview.
4. Login trucker.
5. Intentar ruta.
6. Debe 403.

Resultado esperado:

```text
Sin fuga de margen a roles no autorizados.
```

## Test manual 6 — Multiempresa

1. Crear Empresa A y Empresa B.
2. Crear contrato en A.
3. Login usuario de B.
4. Intentar leer contrato de A con `businessId=A`.
5. Debe 403.
6. Intentar por API directa con token de B.
7. Debe 403.

Resultado esperado:

```text
RLS + scopedBusiness protegen datos.
```

## Test manual 7 — Idempotencia sync

1. Ejecutar sync del mes.
2. Guardar conteos:

```sql
select count(*) from last_mile_trip_cost_observations;
select count(*) from last_mile_renegotiation_recommendations;
```

3. Ejecutar sync de nuevo.
4. Verificar que observaciones se actualizan, no se duplican.
5. Verificar que recomendaciones abiertas no se duplican.

Resultado esperado:

```text
Mismo offer_id no duplica observation.
Mismo dedupe_key no duplica recommendation.
```

## Test manual 8 — Wallet intacta

Antes y después del sync:

```sql
select count(*) from wallets;
select count(*) from transactions;
select count(*) from payout_attempts;
```

Resultado esperado:

```text
Los conteos no cambian por sync Last Mile.
```

## Test manual 9 — Webhook intacto

En staging:

1. Ejecutar flujo de pago de plan.
2. Ejecutar flujo freight si existe sandbox.
3. Verificar webhook.
4. Verificar que Last Mile no intercepta external_reference.

Resultado esperado:

```text
Billing y freight settlement siguen funcionando.
```

## Test manual 10 — Performance

Con 1.000 viajes del mes:

- summary < 1.5s ideal;
- sync manual puede tardar más, pero debe crear `analysis_run`;
- UI debe mostrar loading y no bloquear navegación.

## Checklist release

```text
[ ] Migración aplicada en staging
[ ] RLS validado
[ ] Feature flag enterprise validado
[ ] Growth/Free bloqueados
[ ] Roles validados
[ ] Sync idempotente
[ ] Wallet sin writes
[ ] Webhook sin cambios
[ ] Build OK
[ ] Lint OK
[ ] Typecheck OK
[ ] Copy en español operativo
[ ] Planes actualizados con feature enterprise
[ ] Documentación COMMERCIAL actualizada
```

## Métricas post-release

- `last_mile_contracts_created`
- `last_mile_sync_runs`
- `last_mile_observed_trips`
- `last_mile_recommendations_opened`
- `last_mile_recommendations_accepted`
- `estimated_leakage_cop`
- `contracts_expiring_30d`
- `evidence_complete_rate`
- `provider_score_avg`

## Criterio de rollback

Rollback lógico:

```sql
UPDATE public.billing_plans
SET feature_matrix = feature_matrix || jsonb_build_object('last_mile_margin_control', false)
WHERE code = 'enterprise';
```

No borrar tablas. Ocultar nav y bloquear API por feature gate.
