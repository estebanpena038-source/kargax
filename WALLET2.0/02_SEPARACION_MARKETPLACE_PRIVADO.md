# 02 — Separación exacta: marketplace vs flota privada

## Marketplace freelancer

### Objetivo

Pagar al transportador freelance cuando se cumple todo:

1. Mercado Pago confirmó pago real de la ruta.
2. La ruta está asignada al camionero correcto.
3. La entrega se completó con evidencia válida.
4. No hay disputa, novedad bloqueante o chargeback activo.
5. No existe liberación previa para esa ruta.
6. El método de payout existe y pasa validación.

### Estados target

```text
payment_pending
payment_approved
route_secured
in_transit
route_completed
release_pending
wallet_credited
payout_queued
payout_processing
payout_paid
payout_failed
manual_review
```

### Flujo correcto

```text
Empresa publica ruta
Camionero acepta
Empresa paga con Mercado Pago
Webhook valida firma y pago real
KargaX ejecuta process_successful_payment
Ruta queda asegurada y se generan PINs
Camionero completa entrega con evidencia
Servicio releaseMarketplaceFreightForCompletedOffer valida todo
Se crea crédito marketplace elegible
Se crea payout_attempt si existe método default
Worker processQueuedPayouts llama provider o dry-run
Webhook/processor marca paid/failed
Admin concilia fallos
```

### Qué toca wallet

Solo después de completar ruta:

- `transactions.type = 'marketplace_freight_release'` o legacy `trip_deposit`
- `money_rail = 'marketplace_freelancer'`
- `payout_eligible = true`
- `external_proof_only = false`
- `wallet.available_balance += netAmount`

### Qué no debe pasar

No pagar en webhook de Mercado Pago. Pago aprobado no significa servicio logístico completado.

No pagar si no hay evidencia.

No pagar si `offer.assigned_trucker_id` no coincide.

No pagar si ya existe una transaction elegible para el mismo `offer_id`.

No pagar con provider real si `PAYOUT_DRY_RUN=true` o si no es producción.

## Flota privada / liquidaciones externas

### Objetivo

Permitir que empresas controlen liquidaciones privadas sin que KargaX custodie o simule fondos.

### Estados target

```text
draft
pending_external_pay
proof_uploaded
paid_external
rejected
cancelled
```

### Flujo correcto

```text
Empresa crea liquidación
Conductor ve monto pendiente externo
Empresa paga por su canal normal
Empresa sube comprobante
KargaX marca proof_uploaded
Admin/finance marca paid_external
Conductor ve comprobante e historial
wallet.available_balance NO cambia
```

### Qué toca wallet

Nada en modo default `external_proof`.

Puede crear registro documental en `private_fleet_payment_proofs`, pero no transaction retirable.

### Qué no debe pasar

No crear `private_fleet_salary` como saldo retirable.

No permitir retiro sobre esos montos.

No sumar `salaryReleasedCop` al saldo operativo.

No decir “liberado a billetera” para pagos externos.

## Modo futuro: `mercadopago_funded`

Se puede conservar como opción futura si una empresa privada decide fondear nómina por Mercado Pago y KargaX dispersa. Pero debe estar detrás de:

- `payment_mode = 'mercadopago_funded'`
- feature flag explícito,
- contrato/operación financiera,
- límites,
- conciliación,
- RLS y auditoría,
- copy diferente.

Nunca debe ser default.

## Tabla de decisiones

| Caso | Acción correcta |
|---|---|
| Freight Mercado Pago approved | Asegurar ruta, no payout. |
| Freight route completed + evidencia | Crear release marketplace. |
| Marketplace release + método default | Crear payout_attempt. |
| Marketplace release sin método | Dejar saldo disponible y pedir método. |
| Payout failed | Retry controlado o manual_review. |
| Private payroll external | Crear/actualizar liquidación y comprobante, no wallet. |
| Private payroll webhook con `external_proof` | Bloquear wallet release y notificar incidente. |
| Private payroll `mercadopago_funded` | Permitido solo detrás de flag y controles. |
