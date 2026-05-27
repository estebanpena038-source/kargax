# 09 — Plan de implementación por sprints

## Sprint 0 — Blindaje y análisis

Duración: 1-2 días.

### Tareas

- Leer `/WALLET` completo.
- Hacer `rg` para encontrar el handler exacto de ruta completada.
- Confirmar tablas existentes:
  - `wallets`
  - `transactions`
  - `payout_attempts`
  - `payment_methods`
  - `private_fleet_payroll_runs`
  - `private_fleet_payroll_items`
  - `payments`
  - `cargo_offers`
- Confirmar RPCs existentes:
  - `process_successful_payment`
  - `create_withdrawal_request`
  - `process_withdrawal_request`

### Done

- Documento interno con paths reales del cierre de ruta.
- Confirmación de columnas actuales.

## Sprint 1 — Migraciones y rail financiero

Duración: 2-3 días.

### Tareas

- Crear migración nueva.
- Agregar `money_rail`, `payout_eligible`, `external_proof_only` a `transactions`.
- Extender `payout_attempts`.
- Extender payroll privado con `payment_mode` y campos de comprobante.
- Crear índices de idempotencia.
- Crear RPC `claim_payout_attempts`.
- Crear RPC `mark_payout_paid`.
- Crear RPC `mark_payout_failed`.

### Done

- Migración corre en staging.
- No rompe wallets existentes.
- Backfill no cambia dinero histórico sin auditoría.

## Sprint 2 — Payout provider abstraction

Duración: 2-4 días.

### Tareas

- Crear `frontend/src/lib/server/payouts/*`.
- Crear provider manual.
- Crear provider real como placeholder listo para API.
- Crear processor.
- Crear job interno.
- Crear webhook payout.
- Añadir env validations.

### Done

- Dry-run procesa payouts sin mover dinero.
- Provider real no se activa si faltan envs.
- Logs no exponen cuenta/documento completo.

## Sprint 3 — Marketplace release

Duración: 3-5 días.

### Tareas

- Crear `marketplace-release.ts`.
- Integrarlo al cierre real de ruta.
- Crear idempotency keys.
- Crear payout auto si método guardado.
- Si no hay método, saldo queda disponible.
- UI muestra estado.

### Done

- Ruta completada genera una sola liberación.
- Payout se crea una sola vez.
- Doble webhook/doble cierre no duplica pago.

## Sprint 4 — Flota privada external proof

Duración: 3-5 días.

### Tareas

- Agregar modo `external_proof`.
- Crear endpoint para subir comprobante.
- Ajustar `private-fleet-payroll.ts`.
- Ajustar `/api/wallet` para `privateFleetLedger`.
- Ajustar UI `/billetera`.

### Done

- Liquidación privada no suma a wallet retirable.
- Comprobante visible.
- Transportador entiende que empresa paga por fuera.

## Sprint 5 — Admin fallback y conciliación

Duración: 3-5 días.

### Tareas

- Mejorar `/api/admin/withdrawals` para payout attempts.
- Agregar retry/manual fallback.
- Agregar comprobante manual.
- Crear vista de payouts failed.
- Crear reporte conciliación.

### Done

- Admin puede resolver fallos.
- Ningún payout queda sin estado final o manual_review.

## Sprint 6 — Producción controlada

Duración: 1 semana.

### Tareas

- Activar para 1-2 clientes.
- Límites bajos.
- Monitoreo diario.
- Conciliación diaria manual.
- Subir límites gradualmente.

### Done

- 10+ payouts reales sin error.
- 0 doble pagos.
- 0 saldos negativos.
- 100% payouts conciliados.
