# 08 - QA Last-Mile Control de Margen

## Objetivo

Validar que `/dashboard/control-margen` funciona en staging para empresas/admin con plan Enterprise, que el sidebar lo muestra, que los endpoints no cruzan `business_id`, y que el recompute no escribe wallets, pagos ni transacciones.

URL objetivo:

```text
https://kargax-staging.vercel.app/dashboard/control-margen
```

## 0. Reparar schema parcial si aparece `schema cache`

Sintoma:

```text
Could not find the 'created_by' column of 'last_mile_renegotiation_recommendations' in the schema cache
```

Causa:

La tabla `last_mile_renegotiation_recommendations` fue creada por una corrida parcial antes de tener `created_by` y `updated_by`. PostgREST mantiene cache del schema hasta que se recarga.

SQL seguro para staging:

```sql
BEGIN;

ALTER TABLE public.last_mile_carriers
    ADD COLUMN IF NOT EXISTS provider_key TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

UPDATE public.last_mile_carriers
SET provider_key = 'carrier-' || id::text
WHERE provider_key IS NULL;

ALTER TABLE public.last_mile_carriers
    ALTER COLUMN provider_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_last_mile_carriers_business_provider_key
    ON public.last_mile_carriers(business_id, provider_key);

CREATE INDEX IF NOT EXISTS idx_last_mile_carriers_provider_key
    ON public.last_mile_carriers(business_id, provider_key);

ALTER TABLE public.last_mile_route_lanes
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.last_mile_contracts
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.last_mile_renegotiation_recommendations
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_last_mile_recommendations_created_by
    ON public.last_mile_renegotiation_recommendations(business_id, created_by, created_at DESC)
    WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_last_mile_recommendations_updated_by
    ON public.last_mile_renegotiation_recommendations(business_id, updated_by, updated_at DESC)
    WHERE updated_by IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
```

Validacion:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'last_mile_renegotiation_recommendations'
  and column_name in ('created_by', 'updated_by')
order by column_name;
```

Esperado:

```text
created_by
updated_by
```

Si el error persiste, esperar 30-60 segundos y volver a abrir la pagina. Si sigue, ejecutar de nuevo:

```sql
NOTIFY pgrst, 'reload schema';
```

## 1. Preflight local

Comandos:

```bash
npm run supabase:inspect -- --table last_mile_renegotiation_recommendations --json
npm run typecheck
npm run lint
npm run build
npm run check
npm run security:audit
git diff --check
```

Esperado:

- La tabla lista `created_by` y `updated_by`.
- `typecheck`, `build`, `check` y `security:audit` pasan.
- `lint` puede tener warnings legacy, pero 0 errores.
- `git diff --check` sin errores.

## 2. Feature gate Enterprise

Verificar plan:

```sql
select code, feature_matrix
from public.billing_plans
where code in ('free', 'growth', 'scale', 'enterprise')
order by code;
```

Esperado:

- `enterprise.feature_matrix.last_mile_margin_control = true`
- `enterprise.feature_matrix.last_mile_contracts = true`
- `enterprise.feature_matrix.last_mile_scorecards = true`
- `enterprise.feature_matrix.last_mile_alerts = true`
- `enterprise.feature_matrix.last_mile_renegotiations = true`
- `free` y `growth` no tienen acceso real.
- `scale` puede tener vista limitada/read-only si esta configurado asi.

## 3. Sidebar

Caso business/admin:

1. Entrar a `https://kargax-staging.vercel.app/dashboard`.
2. Iniciar sesion con usuario business owner/admin.
3. Confirmar item `Control de margen` en el sidebar despues de `Inteligencia`.
4. Si el usuario esta en contexto de bodega activa, confirmar que tambien aparece en el sidebar de bodega.
5. Clic en `Control de margen`.

Esperado:

- Navega a `/dashboard/control-margen`.
- No aparece para usuario `trucker`.

## 4. Cargar dashboard

En `/dashboard/control-margen`:

1. Confirmar que carga titulo `Control de margen`.
2. Confirmar estados de loading/error/paywall/empty segun datos.
3. Confirmar copy operativo en espanol:
   - `fuga estimada`
   - `oportunidad`
   - `sobrecosto observado`
   - `renegociacion sugerida`
4. Confirmar que no aparece copy de `ahorro garantizado`.

Esperado:

- Enterprise ve datos reales o empty state.
- Free/Growth ven paywall sin datos reales.
- Trucker recibe bloqueo o redireccion, sin datos.

## 5. Recompute

Tomar baseline antes:

```sql
select count(*) as payments_count from public.payments;
select count(*) as transactions_count from public.transactions;
select count(*) as allocations_count from public.trip_financial_allocations;
select count(*) as observations_count from public.last_mile_trip_cost_observations;
select count(*) as recommendations_count from public.last_mile_renegotiation_recommendations;
```

Desde UI:

1. En `/dashboard/control-margen`, presionar `Recalcular`.
2. Esperar toast de exito o error controlado.
3. Recargar dashboard.

Validar despues:

```sql
select count(*) as payments_count from public.payments;
select count(*) as transactions_count from public.transactions;
select count(*) as allocations_count from public.trip_financial_allocations;
select count(*) as observations_count from public.last_mile_trip_cost_observations;
select count(*) as recommendations_count from public.last_mile_renegotiation_recommendations;
```

Esperado:

- `payments_count`, `transactions_count` y `allocations_count` no cambian por Last-Mile.
- Observaciones/recomendaciones pueden aumentar o actualizarse.
- No cambia `payments.status`.
- No se escribe wallet desde Last-Mile.

## 6. Idempotencia y dedupe

Ejecutar recompute dos veces para el mismo rango.

Validar:

```sql
select offer_id, count(*)
from public.last_mile_trip_cost_observations
group by offer_id
having count(*) > 1;

select dedupe_key, count(*)
from public.last_mile_renegotiation_recommendations
group by dedupe_key
having count(*) > 1;
```

Esperado:

- No hay duplicados por `offer_id` en observaciones.
- No hay duplicados por `dedupe_key` en recomendaciones.

## 7. Multiempresa

Con Business A y Business B:

1. Entrar como Business A.
2. Abrir dashboard Last-Mile.
3. Intentar consultar API con `businessId` de Business B desde query/body.

Esperado:

- API responde `403` o error de scope.
- Business A no ve carriers, contratos, scorecards ni recomendaciones de Business B.

SQL de apoyo:

```sql
select business_id, count(*)
from public.last_mile_trip_cost_observations
group by business_id;

select business_id, count(*)
from public.last_mile_renegotiation_recommendations
group by business_id;
```

## 8. APIs principales

Probar desde navegador autenticado o cliente API con token del usuario:

```text
GET    /api/last-mile/dashboard
GET    /api/last-mile/contracts
POST   /api/last-mile/contracts
POST   /api/last-mile/snapshots/recompute
GET    /api/last-mile/renegotiations
POST   /api/last-mile/renegotiations
PATCH  /api/last-mile/renegotiations/[id]
GET    /api/last-mile/alerts/[id]
PATCH  /api/last-mile/alerts/[id]
```

Esperado:

- Todas devuelven `apiSuccess` o `apiError`.
- Todas incluyen `requestId`.
- Todas filtran por `businessId` server-side.
- Sin datos cross-tenant.

## 9. Resultado QA

| Caso | Esperado | Resultado |
| --- | --- | --- |
| Schema cache reparado | `created_by`, `updated_by` existen | Pendiente |
| Sidebar business/admin | `Control de margen` visible | Pendiente |
| Sidebar trucker | No visible | Pendiente |
| Enterprise | Dashboard real o empty state | Pendiente |
| Free/Growth | Paywall sin datos reales | Pendiente |
| Recompute | No toca payments/wallet/transactions | Pendiente |
| Idempotencia | Sin duplicados `offer_id`/`dedupe_key` | Pendiente |
| Multiempresa | Sin fuga cross-tenant | Pendiente |
| Build/checks | Pasa | Pendiente |
