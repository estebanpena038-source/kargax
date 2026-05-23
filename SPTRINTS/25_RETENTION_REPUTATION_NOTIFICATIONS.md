# CERRADO - SPRINT 25

# 25 - Retention Reputation Notifications

## Estado

- artifact status: `completed`
- cerrado el: `2026-05-19`
- depende de: bugs cerrados, wallet estable, lending pausado
- owner: Product Lead + Growth Lead

## Implementacion cerrada 2026-05-19

- Se agrego `supabase/migrations/044_retention_infra_pricing.sql`.
- DB nueva: `trucker_scores`, `trucker_score_events`, `notification_sequences`, `notification_deliveries`, `report_exports`.
- `GET /api/trucker/score` calcula score con viajes reales y no usa lending.
- Tiers implementados: `bronze`, `silver`, `gold`, `diamond`.
- `POST /api/notifications/trigger-sequences` encola notificaciones accionables con dedupe.
- `GET /api/reports/business-monthly` genera reporte contable JSON por periodo con viajes, fees, pagos privados, gastos empresa y payouts.
- Secuencias iniciales cargadas: primera carga, despacho listo, pago liquidado, nuevo nivel y piloto por vencer.
- Typecheck frontend ejecutado y limpio.

## Proposito

Agregar retencion real sin prometer credito. La retencion debe venir de trabajo diario, reputacion, reportes y comunicaciones utiles.

## Principios

- No construir features cosmeticas antes de cerrar bugs.
- No enviar notificaciones falsas.
- No prometer adelantos.
- Cada mensaje debe llevar al usuario a una accion concreta.

## Score camionero

### Metricas aceptadas

- Viajes completados.
- Entregas a tiempo.
- Entregas sin novedad.
- Cancelaciones.
- Rechazos atribuibles al conductor.
- Calidad de evidencia/POD.
- Rating empresa si existe.

### Metricas pausadas

- Adelantos pagados.
- Limite de credito.
- Pago expres por nivel.

### Tiers

- `bronze`: 0-10 viajes completados.
- `silver`: 11-50.
- `gold`: 51-200.
- `diamond`: 200+.

### Beneficios permitidos

- Mejor posicion en postulaciones.
- Badge visible.
- Menor comision si finance lo aprueba.
- Prioridad para rutas de empresas.
- Acceso anticipado a pilotos.

No incluir adelantos.

## Comision dinamica

Solo implementar si Sprint 18 settlement esta cerrado.

Regla posible:

- Bronze: 8%.
- Silver: 7%.
- Gold: 6%.
- Diamond: 5%.

Cada settlement debe guardar snapshot de tier y tasa aplicada.

## Notificaciones inteligentes

### Empresa

- Dia 1: ayuda para publicar primera carga.
- Dia 3 sin actividad: sugerir publicar ruta.
- Primer viaje completado: resumen de ahorro operativo.
- Nuevo postulante: nombre, score y viajes.
- Despacho WMS listo: crear viaje desde despacho.
- Trial piloto cerca de expirar: resumen de uso y upgrade.

### Camionero

- Dia 1: cargas disponibles cerca.
- Nueva carga compatible.
- Postulacion aceptada.
- Ruta privada asignada.
- Pago liquidado.
- Retiro pagado o en revision.
- Nuevo nivel de reputacion.

## PDF contable

Reportes para empresa:

- Periodo.
- Viajes.
- Conductores.
- Montos brutos.
- Comision KargaX.
- Pagos privados.
- Gastos del viaje.
- Retiros si aplican.
- POD/evidencia referenciada.

El objetivo es que el contador adopte KargaX como fuente de verdad.

## Referidos

Los referidos no entran antes de cerrar pagos y retiros. Cuando entren:

- Conductor puede compartir link por WhatsApp.
- Empresa puede invitar otra empresa solo si el piloto ya demuestra valor.
- No pagar bonos en efectivo automaticos al inicio.
- Recompensa inicial recomendada: prioridad, badge, soporte o meses de plan, no dinero sin control.
- Todo referido debe tener source, referrer, referred_user, estado y antifraude basico.

## Landing camioneros

Solo despues de bugs criticos:

- Promesa principal: mas cargas, trazabilidad y cobro claro.
- No decir "adelantos".
- Si retiros automaticos estan certificados, mencionar Nequi/Bancolombia.
- Mobile-first.

## Data y APIs

- `trucker_scores`
- `trucker_score_events`
- `notification_sequences`
- `notification_deliveries`
- `report_exports`

APIs:

- `GET /api/trucker/score`
- `POST /api/notifications/trigger-sequences`
- `POST /api/reports/business-monthly`

## QA

- Score se calcula con viajes reales.
- Badge aparece en postulaciones.
- Notificaciones no se duplican.
- Usuario puede marcar leidas.
- PDF exporta datos correctos.
- No aparece copy de adelantos.

## Definition of Done

- Retencion esta basada en uso real.
- Score no depende de lending.
- Notificaciones llevan a acciones utiles.
- PDF contable ayuda a vender a finanzas.
