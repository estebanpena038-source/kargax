# 04 — Implementación para dev

Este documento aterriza qué debe editarse para convertir KargaX en una máquina comercial con pricing serio, Acceso Operativo gratis con límites altos temporales, paywall y retención.

## Regla principal

No eliminar funcionalidades existentes. No romper flujos de bodega, flota, billing, Mercado Pago, holding ni marketplace.

Cambiar copy, precios, límites y experiencia comercial sin destruir la arquitectura actual.

## Fuente de verdad técnica observada

- App principal: `frontend/`.
- Base de datos: `supabase/migrations/`.
- Planes visibles: `frontend/src/app/planes/page.tsx`.
- Constantes comerciales: `frontend/src/lib/billing/pricing.ts`.
- Tipos de planes y límites: `frontend/src/lib/warehouses/types.ts`.
- Cliente API de warehouses/billing/fleet/holding: `frontend/src/lib/warehouses/client.ts`.
- Lógica server de planes, límites, uso, pilot flags y recomendaciones: `frontend/src/lib/server/warehouses.ts`.
- API billing subscription: `frontend/src/app/api/billing/subscription/route.ts`.
- API checkout planes: `frontend/src/app/api/billing/subscription/checkout/route.ts`.
- Paywall client: `frontend/src/lib/billing/plan-limits.ts`.

## 1. Cambiar naming: de “piloto” a “Acceso Operativo”

### Editar

- `frontend/src/app/page.tsx`
- `frontend/src/app/planes/page.tsx`
- Cualquier copy visible que diga “piloto” cuando se refiera a uso comercial gratis.

### No eliminar

- No eliminar `business_pilot_flags`.
- No eliminar lógica de `pilotActive`, `pilotExpired`, `pilotDaysRemaining`.
- No eliminar límites temporales de pilot flags.

### Nuevo copy

Reemplazar:

- “Iniciar piloto” → “Activar Acceso Operativo gratis”
- “Agendar piloto” → “Ver flujo operativo”
- “Launch Pilot activo” → “Acceso Operativo activo”
- “Piloto finalizado” → “Acceso Operativo finalizado”

### Motivo

“Piloto” puede sonar experimental y lento. “Acceso Operativo” suena listo para usar con entregas reales.

## 2. Actualizar planes públicos

### Editar

`frontend/src/app/planes/page.tsx`

En `PublicPricingPage`, actualizar tarjetas a:

```ts
const publicPlans = [
  {
    code: 'free',
    name: 'Free',
    price: '$0 COP',
    tagline: 'Para probar el cierre operativo',
    highlights: [
      '1 bodega, 2 usuarios, 3 conductores',
      '50 viajes/mes',
      'PIN/POD, receptor, hora, foto/firma y novedad',
    ],
  },
  {
    code: 'growth',
    name: 'Growth',
    price: '$299.000 COP',
    tagline: 'Para despachos diarios',
    highlights: [
      '3 bodegas, 10 usuarios, 15 conductores',
      '500 viajes/mes',
      'Inventario visual, recibos, despachos y analítica base',
    ],
  },
  {
    code: 'scale',
    name: 'Scale',
    price: '$799.000 COP',
    tagline: 'Para flota, bodega y alto volumen',
    highlights: [
      '10 bodegas, 30 usuarios, 50 conductores',
      '2.000 viajes/mes',
      'Reportes, exportaciones, novedades y soporte premium',
    ],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price: 'Desde $2.500.000 COP',
    tagline: 'Para 3PL, multiempresa y operación corporativa',
    highlights: [
      'Volumen personalizado según operación',
      'API/webhooks, control tower y 3PL multi-cliente',
      'Aprobaciones, auditoría, treasury y soporte premium',
    ],
  },
];
```

## 3. Actualizar planes en base de datos

Crear una nueva migración. No editar migraciones antiguas.

Archivo sugerido:

`supabase/migrations/20260524_commercial_pricing_and_retention_os.sql`

SQL sugerido:

```sql
-- KargaX commercial pricing update
-- No borra datos. Actualiza/crea planes públicos.

insert into public.billing_plans (
  code,
  name,
  tagline,
  price_monthly_usd,
  price_monthly_cop,
  billing_currency_code,
  max_warehouses,
  max_internal_users,
  max_monthly_trips,
  max_private_fleet_drivers,
  includes_inventory,
  includes_locations,
  includes_receipts,
  includes_dispatches,
  includes_analytics,
  includes_api_webhooks,
  includes_multi_client_3pl,
  is_public,
  support_tier,
  feature_matrix,
  updated_at
)
values
(
  'free',
  'Free',
  'Para probar el cierre operativo base',
  0,
  0,
  'COP',
  1,
  2,
  50,
  3,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  true,
  'email',
  jsonb_build_object(
    'evidence', true,
    'pod', true,
    'history_days', 30,
    'exports', false,
    'commercial_position', 'trial_base'
  ),
  now()
),
(
  'growth',
  'Growth',
  'Para operaciones con despachos diarios',
  0,
  299000,
  'COP',
  3,
  10,
  500,
  15,
  true,
  true,
  true,
  true,
  true,
  false,
  false,
  true,
  'priority',
  jsonb_build_object(
    'evidence', true,
    'pod', true,
    'inventory_visual', true,
    'receipts', true,
    'dispatches', true,
    'analytics_base', true,
    'exports', 'basic',
    'commercial_position', 'best_seller'
  ),
  now()
),
(
  'scale',
  'Scale',
  'Para empresas con bodega, flota y alto volumen',
  0,
  799000,
  'COP',
  10,
  30,
  2000,
  50,
  true,
  true,
  true,
  true,
  true,
  false,
  false,
  true,
  'premium',
  jsonb_build_object(
    'evidence', true,
    'pod', true,
    'reports', true,
    'exports', true,
    'incidents', true,
    'client_reports', true,
    'commercial_position', 'scale_operations'
  ),
  now()
),
(
  'enterprise',
  'Enterprise',
  'Para 3PL, holding, multiempresa y operación corporativa',
  0,
  2500000,
  'COP',
  null,
  null,
  null,
  null,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  'premium',
  jsonb_build_object(
    'starts_at', true,
    'custom_volume', true,
    'api_webhooks', true,
    'multi_client_3pl', true,
    'holding', true,
    'control_tower', true,
    'treasury', true,
    'audit', true,
    'commercial_position', 'enterprise_custom'
  ),
  now()
)
on conflict (code) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  price_monthly_usd = excluded.price_monthly_usd,
  price_monthly_cop = excluded.price_monthly_cop,
  billing_currency_code = excluded.billing_currency_code,
  max_warehouses = excluded.max_warehouses,
  max_internal_users = excluded.max_internal_users,
  max_monthly_trips = excluded.max_monthly_trips,
  max_private_fleet_drivers = excluded.max_private_fleet_drivers,
  includes_inventory = excluded.includes_inventory,
  includes_locations = excluded.includes_locations,
  includes_receipts = excluded.includes_receipts,
  includes_dispatches = excluded.includes_dispatches,
  includes_analytics = excluded.includes_analytics,
  includes_api_webhooks = excluded.includes_api_webhooks,
  includes_multi_client_3pl = excluded.includes_multi_client_3pl,
  is_public = excluded.is_public,
  support_tier = excluded.support_tier,
  feature_matrix = excluded.feature_matrix,
  updated_at = now();
```

### Nota para dev

Antes de aplicar, validar que `billing_plans.code` tenga constraint único. Si no existe, crear constraint único con migración segura. No borrar tabla.

## 4. Mantener Acceso Operativo temporal con límites altos

La lógica ya existe como `business_pilot_flags` en server. Mantener y usar comercialmente.

Valores recomendados:

- `enabled = true`
- `pilot_expires_at = now() + interval '14 days'`
- `max_warehouses = 5`
- `max_internal_users = 20`
- `max_private_fleet_drivers = 50`
- `max_monthly_trips = 500`

Comercialmente se muestra como “Acceso Operativo”, aunque la tabla siga llamándose pilot flags.

## 5. Paywall y eventos

### Archivos relacionados

- `frontend/src/lib/billing/plan-limits.ts`
- `frontend/src/lib/server/warehouses.ts`

### Mantener

- `PLAN_LIMIT_REACHED`
- `recordPlanLimitEvent`
- `recommendedPlan`
- `checkoutPath = '/planes'`

### Mejorar copy

Cambiar mensaje genérico a:

> Tu operación ya superó el límite del plan actual. Tus datos siguen seguros. Para crear más viajes, usuarios, bodegas o conductores, activa el plan recomendado.

## 6. Activación obligatoria dentro del producto

Agregar checklist de onboarding, si no existe o está débil.

Ruta sugerida:

- `frontend/src/app/onboarding/page.tsx` o componente dentro del dashboard.

Checklist:

1. Crear bodega.
2. Crear conductor.
3. Crear primer viaje.
4. Cerrar viaje con evidencia.
5. Descargar soporte.
6. Invitar usuario interno.
7. Ver reporte.

No permitir que una cuenta “activada” sea solo registro. Activación real = al menos 3 entregas cerradas con evidencia.

## 7. Mensajes dentro del producto

### Después de crear cuenta

> Te dejamos Acceso Operativo gratis para usar KargaX con entregas reales. Crea tu primera bodega, invita un conductor y cierra una entrega con evidencia.

### Después de 3 entregas cerradas

> Ya tienes evidencia real en KargaX. El siguiente paso es usarlo en una ruta completa y revisar el reporte de novedades.

### Al 70% del límite

> Tu operación ya está usando KargaX de forma recurrente. Recomendamos activar Growth para mantener el flujo sin frenar despachos.

### Al finalizar Acceso Operativo

> Tu Acceso Operativo terminó. Tus datos y soportes siguen seguros. Para seguir creando viajes y operando sin interrupciones, activa Growth o Scale.

## 8. QA obligatorio

Antes de release:

```bash
npm install
npm run repo:audit
npm run build
npm run lint
npm run check
npm run check:release
```

Validar manualmente:

- `/planes` sin sesión muestra precios nuevos.
- `/planes` con sesión muestra plan actual y límites correctos.
- Free tiene 50 viajes.
- Growth tiene 500 viajes y $299.000.
- Scale tiene 2.000 viajes y $799.000.
- Enterprise muestra “Desde $2.500.000”.
- Checkout Mercado Pago crea preferencia para planes pagos.
- Downgrade bloquea si uso actual supera límites.
- Acceso Operativo muestra días restantes.
- Paywall graba evento.

## 9. Qué NO tocar

No eliminar:

- Mercado Pago checkout.
- Webhook de pagos.
- `business_plan_subscriptions`.
- `billing_plans`.
- `billing_plan_payment_attempts`.
- `business_pilot_flags`.
- Lógica de `resolveRecommendedPlan`.
- Lógica de `getBusinessPlanSnapshot`.
- Flota privada.
- Wallet/ledger operativo.
- Holding.
- 3PL.
- Marketplace.
- RLS/migraciones previas.

## 10. Resultado esperado

Después de implementar:

- KargaX se ve más serio.
- Free ya no canibaliza pago.
- Acceso Operativo permite probar con volumen real sin regalar el producto para siempre.
- Growth se vuelve el plan de conversión natural.
- Scale captura operaciones más grandes.
- Enterprise queda abierto para ventas consultivas.
