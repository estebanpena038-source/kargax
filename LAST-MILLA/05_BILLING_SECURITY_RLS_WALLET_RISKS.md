# 05 — Billing, seguridad, RLS, wallet y riesgos

## Riesgo alto

Este módulo toca datos sensibles:

- contratos;
- costos;
- proveedores;
- margen;
- rutas;
- evidencias;
- renegociación.

Además se conecta con dominios de alto riesgo:

- billing;
- wallet/liquidaciones;
- Mercado Pago;
- RLS;
- datos multiempresa.

## Decisión de seguridad

Todas las rutas de Last Mile usan `requireAal2Route`.

Motivo: aunque no mueva dinero, revela margen y costos. Eso es información comercial sensible.

## Roles

### Full access

- `admin`
- `owner`
- `manager`

### Finance access

- `finance_accountant`
- `auditor`

Puede ver costos y exportar, pero no necesariamente editar contratos.

### Ops access

- `ops_manager`
- `dispatcher`

Puede ver recomendaciones operativas y cambiar estados de seguimiento, pero no editar tarifas si no tiene permiso financiero.

### No access V1

- `warehouse_operator`
- `viewer`
- `trucker`

## Feature gate

El plan debe tener en `billing_plans.feature_matrix`:

```json
{
  "last_mile_margin_control": true
}
```

Scale preview opcional:

```json
{
  "last_mile_margin_control_read_only": true
}
```

## Paywall recomendado

Si no tiene feature:

```ts
return apiError('Control de margen está disponible en Enterprise.', {
  status: 402,
  code: 'LAST_MILE_FEATURE_DISABLED',
  details: {
    featureKey: 'last_mile_margin_control',
    recommendedPlan: 'enterprise',
    checkoutPath: '/planes'
  }
});
```

## Plan limits

No bloquear la creación de viajes por este módulo. El control de margen no debe impedir operación logística.

Sí puede limitar:

- contratos activos;
- recomendaciones activas;
- exportes avanzados;
- automatizaciones scheduled.

## Wallet: no tocar

No escribir en:

```text
wallets
transactions
payout_attempts
private_fleet_payroll_items
trip_financial_allocations
```

El sync puede leer `trip_financial_allocations`, pero no actualizarlas.

## Mercado Pago: no tocar

No editar:

```text
frontend/src/app/api/payments/webhook/route.ts
frontend/src/lib/server/payments/freight-settlement.ts
frontend/src/lib/contracts/payments.ts
```

El módulo no debe convertirse en reconciliador financiero.

## RLS

Todas las tablas deben tener RLS activado.

Helper recomendado:

```sql
public.user_has_business_access(p_business_id uuid)
```

Debe permitir:

- admin;
- owner business;
- business_team_members activo.

## Service role vs RLS

Las API routes usan service-role después de validar token. Eso no reemplaza la validación de business scope.

Regla obligatoria:

```text
Nunca usar businessId del body sin validar con resolveScopedBusinessId.
```

## Auditoría

Eventos obligatorios:

- contrato creado;
- contrato activado;
- contrato pausado;
- tarifa cambiada;
- recomendación creada;
- recomendación aceptada/rechazada/cerrada;
- sync manual ejecutado.

## Privacidad

No exponer:

- datos fiscales de proveedor a roles operativos;
- teléfono/correo si no es necesario;
- snapshots internos de pagos;
- gateway_response de Mercado Pago;
- wallet transactions.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Mezclar costo observado con saldo real | No escribir wallet/transactions |
| Fuga de margen entre empresas | Toda tabla con business_id + RLS + scopedBusiness |
| Reporte de ahorro falso | Usar “fuga estimada” y “oportunidad” no “ahorro garantizado” |
| Duplicar alertas | dedupe_key + status open/in_negotiation |
| Contratos solapados | validar fechas por carrier/lane |
| Romper build por tipos | módulo aislado `lib/last-mile` |
| Romper pagos | no tocar webhook/freight-settlement |
| Baja confianza cliente | cada alerta debe mostrar evidencia/snapshot |

## Copy legal/producto seguro

Evitar:

```text
Garantizamos recuperar 50% del margen perdido.
```

Usar:

```text
Detecta fugas de margen y prioriza renegociaciones con datos de rutas, costos y evidencia.
```

## Release gate

No liberar si falla cualquiera:

- usuario sin acceso ve contratos;
- viewer ve costos;
- trucker accede al módulo;
- una alerta se duplica en sync repetido;
- sync escribe en wallet;
- build falla;
- checkout Mercado Pago deja de responder.
