# CERRADO - SPRINT 20

# 20 - Wallet Settlements And Automatic Payouts

## Estado

- artifact status: `completed`
- cerrado el: `2026-05-19`
- prioridad: maxima para confianza financiera
- owner: Finance Lead + CTO

## Implementacion cerrada 2026-05-19

- Se agrego `supabase/migrations/042_payout_methods_and_attempts.sql` con `payout_methods` y `payout_attempts`.
- Interfaces canonicas implementadas en DB:
  - `payout_method`: `nequi`, `bancolombia_savings`, `bancolombia_checking`, `other_bank`.
  - `payout_status`: `requested`, `queued`, `processing`, `paid`, `failed`, `reversed`, `manual_review`.
  - `payout_provider`: `nequi`, `wompi`, `manual`.
- `/api/wallet/withdraw` crea retiro, reserva saldo con el RPC existente y crea `payout_attempts` con idempotency key.
- Si `automatic_payouts_enabled=false`, el payout queda en `manual_review` con provider `manual`.
- Si el flag se habilita en futuro, el provider se decide por metodo: `nequi` para Nequi y `wompi` para Bancolombia/otros bancos.
- Metadata de transaccion conserva trazabilidad y agrega `payout_attempt_id`, `payout_status`, `payout_provider`, `payout_method`.
- Typecheck frontend ejecutado y limpio.

## Proposito

Convertir wallet y retiros en una experiencia fintech seria para el piloto. El camionero independiente debe poder cobrar, ver saldo, registrar destino y recibir dinero en Nequi/Bancolombia sin intervencion manual cuando el riel este certificado.

## Fuentes oficiales

- Wompi Pagos a Terceros: `https://docs.wompi.co/en/docs/colombia/introduccion-pagos-a-terceros/`
- Wompi referencia API: `https://docs.wompi.co/docs/colombia/referencia-pagos-a-terceros/`
- Nequi APIs negocios: `https://www.nequi.com.co/negocios/apis`
- Nequi dispersiones: `https://www.nequi.com.co/negocios/dispersiones-de-plata`

## Reglas financieras

### Marketplace

- Empresa paga el valor bruto del viaje.
- KargaX calcula comision con snapshot.
- Camionero recibe neto.
- El ledger registra bruto, comision y neto.
- El camionero ve el neto antes de retirar.

### Flota privada

- Si `compensation_mode = salary_no_trip_pay`, no se crea pago por viaje al conductor.
- Si `compensation_mode = trip_pay`, se crea pago por viaje sin viaticos.
- Si `compensation_mode = expenses_only`, se liberan solo gastos del viaje.
- Si `compensation_mode = trip_pay_plus_expenses`, se manejan ambos.
- Los gastos/viaticos son fondos de la empresa, no lending.

### Retiros

- El retiro solo puede salir desde saldo disponible.
- Todo retiro tiene idempotency key.
- Todo retiro tiene estado y proveedor.
- Si falla proveedor, no se pierde saldo: pasa a `failed` o `manual_review`.
- Debe existir kill switch `automatic_payouts_enabled=false`.

## Interfaces canonicas

### `payout_method`

- `nequi`
- `bancolombia_savings`
- `bancolombia_checking`
- `other_bank`

### `payout_status`

- `requested`
- `queued`
- `processing`
- `paid`
- `failed`
- `reversed`
- `manual_review`

### `payout_provider`

- `nequi`
- `wompi`
- `manual`

## Modelo de datos objetivo

Crear o extender tablas:

- `payout_methods`
  - `id`
  - `user_id`
  - `method`
  - `provider_preference`
  - `account_holder_name`
  - `document_type`
  - `document_number`
  - `phone_number`
  - `bank_code`
  - `account_number_encrypted`
  - `account_type`
  - `status`
  - `created_at`
  - `updated_at`

- `payout_attempts`
  - `id`
  - `wallet_transaction_id`
  - `user_id`
  - `provider`
  - `method`
  - `amount_cop`
  - `status`
  - `idempotency_key`
  - `provider_reference`
  - `provider_payload`
  - `provider_response`
  - `failure_code`
  - `failure_message`
  - `created_at`
  - `updated_at`

## Adaptador Wompi

Uso:

- Bancolombia ahorro/corriente.
- Otros bancos soportados.
- Pagos 1 a 1 o lotes cuando convenga.

Requisitos:

- Sandbox antes de produccion.
- Webhook de estado.
- Idempotencia.
- Consulta de estado.
- Monto en centavos si el provider lo exige.
- Validacion de banco, cuenta, documento y titular.

## Adaptador Nequi

Uso:

- Pagos en tiempo real a cuentas Nequi.

Restricciones:

- Solo cuentas Nequi activas.
- Requiere contrato, certificacion y pruebas.
- Pago 1 a 1, no masivo.
- Reintentos tecnicos manuales si Nequi lo exige.
- Reversos solo bajo condiciones del proveedor.

## UI/UX wallet camionero

- Mostrar saldo disponible.
- Mostrar saldo pendiente.
- Mostrar historial de liquidaciones.
- Mostrar metodo de retiro principal.
- Permitir agregar Nequi o cuenta bancaria.
- Boton retirar con monto, fee si aplica, ETA y estado.
- Timeline: solicitado, en proceso, pagado, fallido, revision manual.

## Admin payouts

- Cola de `manual_review`.
- Reintentar intento fallido con nueva idempotency key controlada.
- Marcar como pagado manual solo con evidencia.
- Exportar CSV.
- Ver proveedor, requestId, payload seguro y respuesta.

## QA

- Retiro Nequi sandbox exitoso.
- Retiro Bancolombia con provider `cobre` en dry-run/staging o fallback `manual` exitoso.
- Proveedor caido pasa a `manual_review`.
- Intento duplicado no paga dos veces.
- Saldo no queda negativo.
- Webhook actualiza estado.
- Admin puede resolver fallo manual.

## Definition of Done

- El camionero puede registrar destino y solicitar retiro.
- El sistema decide provider segun metodo.
- Hay kill switch por ambiente.
- Payouts automaticos no se habilitan en produccion sin certificacion.
- El ledger queda conciliable antes/despues.
- El contador puede entender que salio, a quien, por que viaje y por que provider.
