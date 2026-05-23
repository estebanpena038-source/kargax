# 15 - Scale Reliability

## Objetivo

Dar la base tecnica y operativa para crecer sin incendios permanentes.

## Alcance

- colas y retries
- rate limits
- SLOs
- backups
- disaster recovery
- feature flags
- load testing
- operational runbooks

## Backlog de ejecucion

1. Clasificar procesos sincronos vs asincronos.
2. Mover eventos sensibles a colas/retries donde aplique.
3. Definir timeouts y circuit breakers.
4. Definir SLOs por dominio:
   - auth
   - payments
   - wallet
   - warehouse
   - admin
5. Preparar backup and restore.
6. Definir plan de incidentes y recovery drills.
7. Agregar feature flags para cambios riesgosos.
8. Ejecutar pruebas de carga en journeys criticos.

## Entregables

- arquitectura de confiabilidad
- runbooks de incidente
- backups validados
- limites y alertas

## Definition of Done

- la plataforma soporta picos y fallas previsibles
- existe forma clara de degradar sin perder verdad de negocio
- recovery deja de ser improvisado

## QA

- retry de webhook/provider
- outage parcial de notificaciones
- carga concurrente en pagos
- recuperacion desde backup
- degradacion con feature flags

## Riesgos

- escalar producto financiero sobre procesos no idempotentes
- perder data por ausencia de recovery probado
- responder al crecimiento solo con mas trabajo manual

