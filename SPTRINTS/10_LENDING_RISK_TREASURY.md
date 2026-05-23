# 10 - Lending Risk Treasury

## Objetivo

Volver `fuel advances` el nucleo del moat financiero de KargaX, con underwriting, treasury control y cobranza disciplinada.

## Estado actual

- existen `fuel_advances`, `fuel_advance_repayments`, `lending_settings`, `lending_treasury`
- existen RPCs para eligibility, request, approve, reject, restructure, write-off y overdue marking
- la vista corporativa ya muestra riesgo, readiness y cartera

## Tesis del sprint

La empresa puede ser muy grande si presta mejor porque ve mejor la operacion. Este sprint convierte esa idea en sistema operable.

## Alcance

- elegibilidad
- politicas de riesgo
- treasury caps
- aprobacion y desembolso
- repago
- mora
- reestructuracion
- castigo de cartera
- metricas del libro

## Backlog de ejecucion

1. Formalizar motor de elegibilidad y score operativo.
2. Definir score inputs:
   - viajes completados
   - tiempos de entrega
   - incidencias
   - behavior de wallet
   - history de repayment
3. Definir caps:
   - por adelanto
   - por trucker
   - por business
   - por holding
   - por portafolio
4. Hacer visible treasury real:
   - available
   - reserved
   - deployed
   - repaid principal
   - repaid interest
5. Endurecer workflow admin y holding sobre decisiones.
6. Definir collections policy y write-off criteria.
7. Instrumentar cohortes y NPL.

## Entregables

- motor de elegibilidad claro
- libro de lending visible
- workflow de decision y seguimiento
- politicas por holding
- tablero de riesgo y cartera

## Definition of Done

- un adelanto no se aprueba sin politica y evidencia
- treasury no puede sobre-desplegarse
- repayment impacta ledger y risk state
- overdue y write-off quedan auditados

## QA

- eligibility positiva y negativa
- solicitud
- aprobacion
- rechazo
- desembolso
- repago parcial
- repago total
- mora
- reestructuracion
- write-off

## Riesgos

- prestar sin cap table de treasury
- score sin datos suficientes o sin explicabilidad
- esconder mora en balances maquillados

