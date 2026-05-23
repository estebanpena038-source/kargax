# 12 - Admin Support Observability

## Objetivo

Hacer que la plataforma pueda ser operada por un equipo y no solo por el fundador.

## Estado actual

- ya hay rutas admin para advances, withdrawals, treasury, pins y notifications
- faltan trazabilidad uniforme, dashboards operativos y runbooks de soporte

## Alcance

- backoffice
- notificaciones
- soporte
- observabilidad
- runbooks
- alertas

## Backlog de ejecucion

1. Definir panel admin unico por dominios:
   - payments
   - wallet
   - lending
   - warehouse
   - support
2. Agregar requestId y actor a eventos criticos.
3. Estandarizar logs estructurados.
4. Construir vista de incidentes y replay actions.
5. Agregar notificaciones admin accionables.
6. Documentar runbooks para fallas comunes.
7. Definir alertas por:
   - webhook failures
   - payout stuck
   - advance overdue spike
   - queue backlogs

## Entregables

- panel admin operable
- alertas minimas
- logs estructurados
- runbooks de soporte

## Definition of Done

- soporte puede diagnosticar un problema con evidencia
- operaciones criticas tienen visibilidad antes de explotar
- admin ya no corrige todo tocando datos manualmente

## QA

- resend PIN
- reconcile pago
- approve/reject withdrawal
- approve/reject advance
- treasury adjust con auditoria
- seguir incidente por requestId

## Riesgos

- tener herramientas admin sin auditoria
- depender de logs manuales y screenshots
- operar dinero sin alertas tempranas

