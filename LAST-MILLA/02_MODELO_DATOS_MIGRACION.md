# 02 — Modelo de datos y migración LAST-MILLA

## Objetivo del modelo

Crear un dominio nuevo, separado de wallet/pagos, que permita:

- registrar proveedores de última milla;
- estandarizar rutas/lane;
- registrar contratos/tarifas;
- guardar snapshots de costo por viaje;
- generar scorecards por proveedor;
- crear recomendaciones de renegociación;
- auditar cambios de contrato y decisiones.

## Principios

1. Toda tabla tiene `business_id`.
2. RLS se basa en acceso empresarial.
3. Los snapshots son idempotentes.
4. Los contratos guardan snapshots para explicar cálculos históricos.
5. Ninguna tabla toca saldos reales.
6. No se editan migraciones anteriores.
7. Se usa migración nueva.

```text
supabase/migrations/20260527_last_mile_margin_control.sql
```

## Tablas nuevas

### 1. `last_mile_carriers`

Representa proveedor/transportador/conductor agrupable.

```text
id
business_id
carrier_type                  private_fleet | marketplace | external_provider
profile_user_id               nullable, para trucker existente en KargaX
fleet_member_id               nullable, para business_fleet_members
legal_name
display_name
tax_id
contact_name
contact_phone
contact_email
status                        active | suspended | archived | prospect
metadata
created_by
created_at
updated_at
```

Uso:

- Para flota privada: vincular `profile_user_id` a `business_fleet_members.trucker_id`.
- Para marketplace: vincular `assigned_trucker_id` si existe.
- Para proveedor externo: crear manualmente.

### 2. `last_mile_route_lanes`

Normaliza rutas repetidas.

```text
id
business_id
lane_key
origin_department
origin_city
origin_zone
origin_warehouse_id
destination_department
destination_city
destination_zone
destination_warehouse_id
vehicle_type
cargo_type
service_level                 standard | express | refrigerated | fragile | custom
status                        active | archived
metadata
created_by
created_at
updated_at
```

`lane_key` recomendado:

```ts
`${originDepartment}:${originCity}:${originZone || '*'}->${destinationDepartment}:${destinationCity}:${destinationZone || '*'}:${vehicleType || '*'}:${cargoType || '*'}:${serviceLevel}`
```

No usar direcciones completas como llave exacta en MVP porque genera demasiada cardinalidad.

### 3. `last_mile_contracts`

Contrato/tarifa activa por proveedor y opcionalmente por lane.

```text
id
business_id
carrier_id
lane_id
source_kind                   manual | marketplace_observed | private_fleet_policy | renegotiated
status                        draft | active | paused | expired | superseded
pricing_model                 per_trip | per_km | per_kg | hybrid | monthly_retainer
currency_code                 COP | USD | PEN | BRL
base_rate_cop
per_km_rate_cop
per_kg_rate_cop
minimum_rate_cop
maximum_rate_cop
fuel_surcharge_cop
other_surcharge_cop
payment_terms_days
evidence_required
sla_rules
penalty_rules
starts_at
ends_at
created_by
created_at
updated_at
```

`evidence_required` recomendado:

```json
{
  "pickup_pin": true,
  "delivery_pin": true,
  "delivery_photo": true,
  "delivery_signature": true,
  "receiver_name": true,
  "incident_required_when_exception": true
}
```

`sla_rules` recomendado:

```json
{
  "max_delay_minutes": 60,
  "on_time_weight": 0.25,
  "evidence_weight": 0.35,
  "incident_weight": 0.25,
  "cost_weight": 0.15
}
```

`penalty_rules` recomendado:

```json
{
  "missing_signature_cop": 10000,
  "missing_photo_cop": 5000,
  "late_delivery_cop": 15000,
  "critical_incident_cop": 50000
}
```

### 4. `last_mile_contract_events`

Auditoría de cambios.

```text
id
business_id
contract_id
event_type                    created | activated | rate_changed | renegotiation_requested | renegotiated | paused | expired | manual_note
actor_id
reason
old_snapshot
new_snapshot
created_at
```

Cada cambio sensible debe dejar snapshot.

### 5. `last_mile_trip_cost_observations`

Snapshot agregado de un viaje/oferta.

```text
id
business_id
offer_id
carrier_id
lane_id
contract_id
source_kind                   cargo_offer | payment | private_fleet_allocation | manual_adjustment | sync
execution_status              planned | assigned | in_progress | completed | cancelled | disputed
currency_code
agreed_cost_cop
expected_cost_cop
final_cost_cop
platform_fee_cop
payout_cost_cop
private_expense_cost_cop
incident_cost_cop
overrun_cop
overrun_pct
evidence_score
on_time_score
completion_score
provider_score
contract_snapshot
pricing_snapshot
evidence_snapshot
incident_snapshot
observed_at
created_at
updated_at
```

Regla:

```text
UNIQUE (business_id, offer_id)
```

Esto permite recomputar sin duplicar.

### 6. `last_mile_provider_score_snapshots`

Score por proveedor/periodo.

```text
id
business_id
carrier_id
period_start
period_end
completed_trips
cancelled_trips
disputed_trips
incident_count
evidence_complete_rate
on_time_rate
avg_agreed_cost_cop
avg_final_cost_cop
avg_overrun_cop
avg_overrun_pct
p95_final_cost_cop
estimated_leakage_cop
score
generated_at
created_at
```

Regla:

```text
UNIQUE (business_id, carrier_id, period_start, period_end)
```

### 7. `last_mile_renegotiation_recommendations`

Inbox de alertas accionables.

```text
id
business_id
carrier_id
lane_id
contract_id
period_start
period_end
trigger_type                  cost_overrun | incident_rate | evidence_missing | volume_discount | supplier_underperformance | contract_expiring | benchmark_gap
severity                      low | medium | high | critical
status                        open | acknowledged | in_negotiation | accepted | rejected | closed
title
description
detected_metric
expected_saving_cop
confidence_score
recommended_action
opened_by_system
assigned_to
due_at
resolved_at
resolution_note
created_at
updated_at
```

Regla anti-duplicados:

```text
No crear otra recomendación open/in_negotiation con mismo business + carrier + lane + trigger_type + periodo.
```

### 8. `last_mile_analysis_runs`

Control de jobs/recomputaciones.

```text
id
business_id
run_type                      manual | scheduled | offer_completed | backfill
status                        queued | running | succeeded | failed
period_start
period_end
offer_id
started_by
started_at
finished_at
processed_offers
created_observations
updated_observations
created_recommendations
error_message
metadata
created_at
```

## RLS

Crear helper:

```sql
public.user_has_business_access(p_business_id uuid)
```

Debe permitir:

- admin;
- business owner donde `auth.uid() = business_id`;
- miembro activo de `business_team_members`.

Políticas base:

```sql
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id))
```

Para `DELETE`, no exponer desde API en MVP. Usar `status='archived'`.

## Billing feature flag

Actualizar `billing_plans.feature_matrix`:

```sql
UPDATE public.billing_plans
SET feature_matrix = jsonb_strip_nulls(
  COALESCE(feature_matrix, '{}'::jsonb) ||
  jsonb_build_object(
    'last_mile_margin_control', CASE WHEN code = 'enterprise' THEN true ELSE false END,
    'last_mile_margin_control_read_only', CASE WHEN code = 'scale' THEN true ELSE false END,
    'last_mile_contract_limit', CASE
      WHEN code = 'free' THEN 0
      WHEN code = 'growth' THEN 0
      WHEN code = 'scale' THEN 10
      WHEN code = 'enterprise' THEN NULL
      ELSE 0
    END
  )
)
WHERE code IN ('free', 'growth', 'scale', 'enterprise');
```

## Reglas de idempotencia

### Observación por oferta

```text
ON CONFLICT (business_id, offer_id) DO UPDATE
```

Actualizar:

- costos;
- scores;
- snapshots;
- `observed_at`;
- `updated_at`.

No cambiar:

- `created_at`;
- eventos históricos.

### Recomendaciones

Antes de insertar:

```text
Buscar recomendación con status IN ('open', 'acknowledged', 'in_negotiation')
para business/carrier/lane/trigger/periodo.
```

Si existe, actualizar `detected_metric`, `expected_saving_cop`, `confidence_score` y `updated_at`.

## Relaciones con tablas existentes

```text
last_mile_trip_cost_observations.offer_id -> cargo_offers.id
last_mile_trip_cost_observations.contract_id -> last_mile_contracts.id
last_mile_trip_cost_observations.carrier_id -> last_mile_carriers.id
last_mile_trip_cost_observations.lane_id -> last_mile_route_lanes.id
last_mile_carriers.profile_user_id -> user_profiles.id
last_mile_carriers.fleet_member_id -> business_fleet_members.id
last_mile_contracts.carrier_id -> last_mile_carriers.id
last_mile_contracts.lane_id -> last_mile_route_lanes.id
last_mile_recommendations.carrier_id -> last_mile_carriers.id
last_mile_recommendations.lane_id -> last_mile_route_lanes.id
```

## Migración SQL draft

Archivo:

```text
LAST-MILLA/sql/20260527_last_mile_margin_control_DRAFT.sql
```

Copiar al repo como:

```text
supabase/migrations/20260527_last_mile_margin_control.sql
```

## Rollback lógico

No borrar datos. Para desactivar el módulo:

```sql
UPDATE public.billing_plans
SET feature_matrix = feature_matrix || jsonb_build_object('last_mile_margin_control', false)
WHERE code = 'enterprise';
```

Y ocultar navegación por feature flag. Las tablas pueden quedar intactas.
