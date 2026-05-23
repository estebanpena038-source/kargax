# CERRADO - SPRINT 24

# 24 - CEO KargaX Control Tower

## Estado

- artifact status: `completed`
- cerrado el: `2026-05-19`
- prioridad: alta para pilotos
- owner: CEO / Founder + CTO

## Implementacion cerrada 2026-05-19

- `/api/admin/overview` extiende el payload con `ceo_control_tower`.
- La vista CEO queda protegida por `requireAdminRoute`, igual que el admin global existente.
- `ceo_control_tower` expone:
  - usuarios totales, negocios, camioneros, admins y nuevos 7/30 dias.
  - ofertas publicadas, asignadas, en progreso, completadas y canceladas.
  - despachos WMS creados y despachos conectados a viajes.
  - GMV, platform fee, neto a camioneros, retiros pendientes y payouts en manual review.
  - flota privada: conductores activos y ofertas privadas.
- Dominio operativo visible usa `payouts` para la cola financiera de retiros.
- Las metricas vienen de tablas reales: `user_profiles`, `cargo_offers`, `warehouse_dispatch_orders`, `business_fleet_members`, `payout_attempts`.
- Typecheck frontend ejecutado y limpio.

## Proposito

Crear la vista CEO KargaX/founder/admin global. Esta vista no es marketing; es una cabina de operacion para saber si la plataforma esta viva, donde se mueve dinero, que se rompe y que piloto merece atencion.

## Audiencia

- CEO / Founder.
- Platform admin.
- Finance lead.
- Support lead.

No es la vista de empresa cliente. Esa vendra como dashboard empresarial separado.

## Ruta objetivo

- Reusar `/admin` si conviene.
- O crear `/admin/ceo` si se quiere separar del admin operativo.

## KPIs principales

### Plataforma

- Usuarios totales.
- Usuarios por rol.
- Empresas activas.
- Camioneros activos.
- Conductores flota privada.
- Usuarios nuevos ultimos 7/30 dias.

### Operacion

- Viajes publicados.
- Viajes asignados.
- Viajes en progreso.
- Viajes completados.
- Viajes cancelados.
- Despachos WMS creados.
- Despachos conectados a viaje.
- POD completados.

### Dinero

- GMV bruto de viajes.
- Comision KargaX.
- Monto neto pagado a camioneros.
- Saldo pendiente de liquidacion.
- Retiros solicitados.
- Retiros pagados.
- Retiros fallidos/manual review.
- Ingresos por planes.

### Planes

- Empresas Free.
- Empresas piloto.
- Empresas Growth/Scale/Enterprise.
- Trial expirando en 7 dias.
- Cuentas arriba de limite.
- Paywalls disparados.

### Salud

- Incidentes abiertos.
- Incidentes criticos.
- Healthcheck.
- Sentry activo.
- Upstash activo.
- Webhook Mercado Pago listo.
- Payout provider listo.
- Ultimo deploy.

## Componentes UI

- Header compacto con fecha, ambiente y health.
- Grid de metricas de alto nivel.
- Grafico de viajes por dia.
- Grafico de GMV/comision por semana.
- Tabla de pilotos activos.
- Cola de incidentes y soporte.
- Cola de payouts.
- Panel de launch readiness.
- Panel de top riesgos.

## Data sources

- `user_profiles`
- `business_profiles`
- `trucker_profiles`
- `cargo_offers`
- `payments`
- `transactions`
- `business_plan_subscriptions`
- `billing_plan_payment_attempts`
- `business_fleet_members`
- `warehouse_dispatch_orders`
- `platform_incidents`
- `support_requests`
- `feature_flags`
- `operation_events`

## API objetivo

Extender o crear:

- `GET /api/admin/overview`
- `GET /api/admin/ceo-overview`

Shape:

- `generated_at`
- `environment`
- `users`
- `operations`
- `money`
- `plans`
- `payouts`
- `warehouse`
- `private_fleet`
- `health`
- `risks`
- `pilots`

## Seguridad

- Solo `platform_admin`.
- MFA requerido si esta disponible.
- No exponer datos sensibles completos.
- Cuentas bancarias y documentos deben ir enmascarados.
- Todo click de accion sensible genera `operation_event`.

## QA

- Admin ve tablero.
- Business normal no accede.
- Trucker no accede.
- Metricas cuadran con queries manuales.
- Si una tabla falla, el panel muestra degradado y no crashea.
- Vista responsive en laptop y movil.

## Definition of Done

- CEO puede responder en 60 segundos: usuarios, viajes, dinero movido, dinero ganado, planes, retiros, bugs y pilotos en riesgo.
- No hay metricas inventadas sin fuente.
- Cada metrica muestra periodo o definicion.
- Control tower no depende de hojas externas.
