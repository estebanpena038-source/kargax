# CERRADO - SPRINT 27

# 27 - Pricing Limits Paywalls

## Estado

- artifact status: `completed`
- cerrado el: `2026-05-19`
- owner: CEO / Founder + Growth Lead + CTO

## Implementacion cerrada 2026-05-19

- Se agrego `business_pilot_flags` para pilotos generosos con expiracion.
- Se agrego `paywall_events` para medir bloqueos y conversion.
- `getBusinessPlanSnapshot` aplica limites piloto si `business_pilot_flags.enabled=true` y `pilot_expires_at` no vencio.
- Limites piloto default aplicados: 5 bodegas, 20 usuarios, 50 conductores privados, 500 viajes/mes.
- `POST /api/billing/paywall-events` registra feature bloqueada, uso, limite, plan recomendado y mensaje especifico.
- Flags relacionados activos: `pilot_generous_limits`, `wms_dispatch_trip_enabled`, `ceo_control_tower_enabled`.
- La respuesta de uso mantiene `pilotActive` y `pilotExpiresAt` para UI/paywalls.
- Typecheck frontend ejecutado y limpio.

## Proposito

Definir limites que permitan probar y crear dependencia sin regalar la empresa. La estrategia final es Free controlado + Piloto generoso temporal + planes pagos claros.

## Principio comercial

El limite gratis debe permitir sentir el valor. El limite piloto debe permitir operar de verdad. El paywall debe aparecer cuando la empresa ya entiende que KargaX le esta resolviendo operacion diaria.

## Planes base

### Free publico

Objetivo:

- Validar una operacion pequena.
- No sostener una empresa completa gratis.

Limites sugeridos:

- 1 bodega.
- 2 usuarios internos.
- 3 conductores privados.
- 25-50 viajes/mes.
- Despachos basicos.
- Sin API.
- Sin control tower avanzado.
- Sin reportes PDF avanzados.

### Pilot

Objetivo:

- Activar empresas reales durante 60-90 dias.
- Medir uso antes de cobrar.

Limites sugeridos:

- 3-5 bodegas.
- 10-20 usuarios internos.
- 20-50 conductores privados.
- 300-500 viajes/mes.
- WMS completo.
- Reportes PDF.
- Soporte founder-led.
- Fecha de expiracion obligatoria.

### Growth

Objetivo:

- Empresa con operacion recurrente.

Limites sugeridos:

- 5 bodegas.
- 20 usuarios internos.
- 25 conductores privados.
- 500 viajes/mes.
- Reportes.
- Analitica base.

### Scale

Objetivo:

- 3PL, multi-bodega, operacion seria.

Limites sugeridos:

- 25 bodegas.
- 100 usuarios internos.
- conductores privados altos o ilimitados.
- 5,000 viajes/mes.
- API/webhooks.
- Control tower.

### Enterprise

Objetivo:

- Holding, red grande, contrato.

Limites:

- negociados.
- SLA.
- soporte premium.
- seguridad y auditoria avanzada.

## Feature flags

- `pilot_generous_limits=true`
- `pilot_expires_at`
- `lending_enabled=false`
- `automatic_payouts_enabled`
- `wms_dispatch_trip_enabled`
- `ceo_control_tower_enabled`

## Paywalls

Paywalls deben aparecer en:

- Crear bodega por encima del limite.
- Invitar usuario interno por encima del limite.
- Invitar conductor privado por encima del limite.
- Crear viajes por encima del limite mensual.
- Exportar reportes avanzados fuera de plan.
- API/webhooks fuera de plan.

## Copy de paywall

Debe ser especifico:

- "Tu plan permite 3 conductores privados. Ya tienes 3 activos."
- "Tu piloto vence el 2026-08-19. Agenda conversion para mantener limites altos."
- "Growth activa hasta 25 conductores y reportes contables."

No usar copy generico como "actualiza para mas funciones".

## Metricas de conversion

- Empresas piloto activas.
- Dias hasta primer despacho.
- Dias hasta primer viaje pagado.
- Numero de usuarios invitados.
- Numero de despachos/mes.
- Numero de viajes/mes.
- Paywalls disparados.
- Upgrades iniciados.
- Upgrades pagados.
- Churn o inactividad.

## QA

- Free bloquea correctamente.
- Pilot permite limites altos.
- Pilot expira.
- Downgrade bloquea si uso excede plan destino.
- Paywall explica limite y plan recomendado.
- Admin puede activar piloto con fecha.

## Definition of Done

- Limites existen en DB o config controlada.
- UI muestra uso actual vs limite.
- Paywall no rompe flujos ya en progreso.
- Piloto generoso no se vuelve gratis permanente.
