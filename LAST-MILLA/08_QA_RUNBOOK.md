# 08 — QA, seguridad y runbook de pruebas

## Objetivo

Evitar bugs en un módulo sensible: costos, contratos, multiempresa, billing y datos operativos.

## Comandos base

Desde raíz:

```bash
npm install
npm run repo:audit
npm run supabase:inspect
npm run lint
npm run typecheck
npm run build
npm run check
npm run check:release
npm run security:audit
```

Desde `frontend/`:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run check
```

## Matriz de usuarios

Crear o usar cuentas staging:

```text
admin_kargax
business_owner_enterprise
business_ops_enterprise
business_owner_free
business_owner_scale_readonly
trucker_marketplace
trucker_private_fleet
```

## Setup mínimo de datos

### Empresa Enterprise

1. Activar `feature_matrix.last_mile_margin_control = true`.
2. Crear bodega origen/destino.
3. Crear conductor flota privada.
4. Crear contrato activo por ruta.
5. Crear oferta privada o marketplace completada.
6. Agregar evidencia.
7. Agregar incidente opcional.
8. Recalcular snapshot.

### Empresa Free

1. No activar feature.
2. Crear ruta si ya existe.
3. Intentar abrir dashboard.
4. Debe ver paywall sin datos.

## Pruebas API

### Dashboard Enterprise

```bash
curl -H "Authorization: Bearer $TOKEN_ENTERPRISE" \
  http://localhost:3000/api/last-mile/dashboard
```

Esperado:

```json
{
  "success": true,
  "code": "LAST_MILE_DASHBOARD_LOADED"
}
```

### Dashboard Free

```bash
curl -H "Authorization: Bearer $TOKEN_FREE" \
  http://localhost:3000/api/last-mile/dashboard
```

Esperado:

```text
402 LAST_MILE_PAYWALL
```

O payload paywalled sin datos, según decisión final.

### Trucker bloqueado

```bash
curl -H "Authorization: Bearer $TOKEN_TRUCKER" \
  http://localhost:3000/api/last-mile/dashboard
```

Esperado:

```text
403 LAST_MILE_ROLE_REQUIRED
```

### Crear contrato

```bash
curl -X POST http://localhost:3000/api/last-mile/contracts \
  -H "Authorization: Bearer $TOKEN_OWNER" \
  -H "Content-Type: application/json" \
  -d '{
    "carrierType":"private_fleet",
    "providerName":"Flota Cali Sur",
    "status":"active",
    "scopeLevel":"route",
    "originCity":"Cali",
    "destinationCity":"Jamundí",
    "baseFeeCop":85000,
    "minimumFeeCop":85000,
    "targetMarginPercent":18,
    "effectiveFrom":"2026-05-01"
  }'
```

Esperado:

```text
201 o 200 LAST_MILE_CONTRACT_CREATED
```

### Recompute manual

```bash
curl -X POST http://localhost:3000/api/last-mile/snapshots/recompute \
  -H "Authorization: Bearer $TOKEN_OWNER" \
  -H "Content-Type: application/json" \
  -d '{"offerId":"<uuid>"}'
```

Esperado:

```text
LAST_MILE_SNAPSHOT_RECOMPUTED
```

Correr dos veces. Debe seguir existiendo un solo snapshot por offer.

### Job interno

Sin key:

```bash
curl -X POST http://localhost:3000/api/jobs/last-mile/recompute
```

Esperado:

```text
401 INTERNAL_JOB_UNAUTHORIZED
```

Con key:

```bash
curl -X POST http://localhost:3000/api/jobs/last-mile/recompute \
  -H "x-internal-api-key: $INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"windowDays":30,"limit":50}'
```

Esperado:

```json
{
  "processed": 50,
  "recomputed": ">=0",
  "failed": ">=0"
}
```

## Pruebas DB/RLS

### Business A no lee Business B

```sql
set role authenticated;
-- simular auth.uid() según entorno Supabase local
select * from last_mile_carrier_contracts where business_id = '<business_b>';
```

Esperado:

```text
0 rows
```

### Un snapshot por offer

```sql
select offer_id, count(*)
from last_mile_route_cost_snapshots
group by offer_id
having count(*) > 1;
```

Esperado:

```text
0 rows
```

### Alertas sin duplicados

```sql
select business_id, dedupe_key, count(*)
from last_mile_margin_alerts
group by business_id, dedupe_key
having count(*) > 1;
```

Esperado:

```text
0 rows
```

## Pruebas de wallet/pagos

Antes y después de recompute:

```sql
select id, user_id, available_balance, pending_balance
from wallets
where user_id in ('<trucker_id>');

select id, status, external_id
from payments
where offer_id = '<offer_id>';
```

Esperado:

- `available_balance` sin cambios.
- `pending_balance` sin cambios.
- `payments.status` sin cambios.
- no hay nuevas `transactions` creadas por last-mile.

## Pruebas de cálculo

### Caso 1 — Sin contrato

Input:

```text
Ruta completada sin contrato activo.
```

Esperado:

- snapshot creado;
- `contract_id = null`;
- `metadata.warning = no_contract_applied` o equivalente;
- no alerta `cost_overrun`.

### Caso 2 — Costo real igual a pactado

Contrato: $100.000.  
Costo real: $100.000.

Esperado:

```text
cost_variance_cop = 0
cost_variance_percent = 0
```

### Caso 3 — Sobrecosto

Contrato: $100.000.  
Costo real: $120.000.  
Umbral: 8%.

Esperado:

```text
cost_variance_cop = 20000
cost_variance_percent = 20
alerta cost_overrun critical o warning según regla
```

### Caso 4 — Evidencia incompleta

Falta foto y firma requerida.

Esperado:

```text
evidence_score < 80
alerta evidence_gap
```

### Caso 5 — Proveedor bajo rendimiento

10 rutas, score < 65.

Esperado:

```text
scorecard.status = renegotiate
alerta provider_underperforming
```

## QA frontend

### Desktop

- Hero carga meta.
- KPI cards con formato COP.
- Tabla no corta texto crítico.
- Acciones tienen loading.
- Toast de error claro.

### Mobile

- KPI cards una columna.
- Tablas scroll horizontal.
- No se superponen botones.
- Paywall legible.

### Empty states

- Sin contratos.
- Sin snapshots.
- Sin alertas.
- Paywall.
- Error 500.

## Pruebas de permisos UI

| Usuario | Nav | Dashboard | Contratos | Renegociar |
|---|---:|---:|---:|---:|
| Admin | yes | yes | yes | yes |
| Owner Enterprise | yes | yes | yes | yes |
| Ops Enterprise | yes | yes | no o limitado | limitado |
| Owner Free | yes opcional | paywall | no | no |
| Trucker | no | 403 | no | no |

## Release checklist

Antes de merge:

```text
[ ] No se editaron migraciones antiguas.
[ ] RLS activo en todas las tablas nuevas.
[ ] APIs filtran business_id.
[ ] Paywall no devuelve datos reales.
[ ] No se escribe a wallet/pagos.
[ ] No se loggean secretos.
[ ] Build pasa.
[ ] Typecheck pasa.
[ ] Lint pasa.
[ ] QA manual documentado.
[ ] Rollback listo.
```

## Rollback operativo

1. Desactivar nav item.
2. Desactivar feature flags en billing.
3. Desactivar job interno.
4. Mantener tablas para no perder datos.
5. Si hay incidente RLS, revocar grants temporalmente.
6. Corregir y reactivar.

SQL de apagado rápido:

```sql
UPDATE billing_plans
SET feature_matrix = feature_matrix || jsonb_build_object(
  'last_mile_margin_control', false,
  'last_mile_margin_dashboard', false,
  'last_mile_contracts', false,
  'last_mile_scorecards', false,
  'last_mile_renegotiation_cycles', false
)
WHERE code IN ('free','growth','pro','scale','enterprise');
```
