# 11 - Holding Enterprise

## Objetivo

Convertir KargaX en una consola enterprise real para holdings, operadores multibodega y redes 3PL.

## Estado actual

- ya existe `/corporativo`
- ya existen empresas, miembros, aprobaciones y politicas financieras
- ya existen request types como `wallet_release`, `credit_policy`, `plan_upgrade` y `ops_exception`

## Alcance

- multiempresa
- miembros corporativos
- approvals
- finance policy
- torre de control consolidada
- seats y gobierno

## Backlog de ejecucion

1. Normalizar modelo de holding account.
2. Endurecer membresias y roles:
   - holding_owner
   - finance_admin
   - ops_admin
   - analyst
3. Hacer consistente el linking/unlinking de negocios.
4. Completar cola de aprobaciones con SLA y prioridad.
5. Unificar finance policy por holding.
6. Consolidar dashboards de riesgo, operacion y cartera.
7. Ajustar experiencia enterprise y pricing narrative.

## Entregables

- consola corporativa consistente
- aprobaciones operables
- gobierno de multiempresa
- metricas consolidadas

## Definition of Done

- un holding puede gobernar varias empresas sin salir de KargaX
- decisiones financieras y operativas quedan auditadas
- el producto enterprise tiene propuesta de valor clara

## QA

- invitar miembro corporativo
- cambiar rol
- ligar negocio al holding
- crear aprobacion
- aprobar y rechazar
- cambiar finance policy
- ver resumen consolidado

## Riesgos

- permisos cruzados entre empresas
- politicas aplicadas a negocio equivocado
- enterprise UI bonita pero sin controles reales

