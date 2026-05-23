# 09 - Wallet Settlements

## Objetivo

Transformar la wallet en un ledger confiable de settlement, no en una pantalla de saldos aproximados.

## Estado actual

- wallet ya soporta disponible, pendiente, retiros e historial
- existen sweeps para repayment de advances
- existen rutas admin para withdrawals
- hace falta disciplina de ledger y consistencia transversal

## Alcance

- ledger entries oficiales
- settlement por viaje
- retiros
- sweeps
- metodos de pago/retiro
- visibilidad por actor

## Backlog de ejecucion

1. Definir tipos oficiales de transaccion.
2. Asegurar referencia cruzada entre wallet, payment, trip y advance.
3. Hacer visible balance before/after en todo movimiento.
4. Unificar manejo de pending y available.
5. Endurecer flujo de retiro con aprobacion y evidencia.
6. Definir settlement timing rules.
7. Agregar panel admin y corporate de ledger.

## Entregables

- ledger consistente
- retiro operable
- settlement entendible
- visibilidad para trucker, business, admin y holding

## Definition of Done

- ninguna mutacion de saldo ocurre sin ledger entry
- cualquier saldo se puede explicar desde eventos fuente
- un retiro no rompe ni oculta obligaciones pendientes

## QA

- wallet vacia
- wallet creada automaticamente
- settlement de viaje
- sweep por advance
- retiro solicitado
- retiro aprobado o rechazado
- ledger before/after correcto

## Riesgos

- reconciliar balances por calculo derivado y no por ledger
- permitir retiro de fondos comprometidos
- perder referencias de negocio por transaccion

