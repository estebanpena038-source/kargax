# 08 — Producción controlada y rollback

## Principio

Payout real se activa por fases. Primero código, después dry-run, después manual provider, después proveedor real con límites bajos.

## Variables recomendadas

```text
PAYOUTS_ENABLED=false
PAYOUT_DRY_RUN=true
PAYOUT_PROVIDER=manual
PAYOUT_BATCH_SIZE=5
PAYOUT_MAX_SINGLE_COP=300000
PAYOUT_DAILY_LIMIT_COP=1500000
INTERNAL_API_KEY=<solo env, nunca markdown>
```

## Fase 0 — Código instalado, payouts apagados

```text
PAYOUTS_ENABLED=false
PAYOUT_DRY_RUN=true
```

Validar:

- `/api/wallet` responde rails separados.
- flota privada external no toca wallet.
- no se crean payouts reales.

## Fase 1 — Dry-run

```text
PAYOUTS_ENABLED=true
PAYOUT_DRY_RUN=true
PAYOUT_PROVIDER=manual
```

Validar:

- `payout_attempts` se crean.
- job procesa sin llamar proveedor real.
- estados pasan a `manual_review` o `paid` fake según config.
- admin puede conciliar.

## Fase 2 — Producción controlada

```text
PAYOUTS_ENABLED=true
PAYOUT_DRY_RUN=false
PAYOUT_PROVIDER=<provider_real>
PAYOUT_MAX_SINGLE_COP=300000
PAYOUT_DAILY_LIMIT_COP=1500000
```

Condiciones:

- Solo 1 cliente.
- Solo 1-3 transportadores.
- Conciliación manual después de cada payout.
- Alertas activas.
- Webhook provider validado.

## Alertas

Crear alerta si:

- `payout_attempt.status='processing'` por más de 30 min.
- `failed` > 3 intentos.
- `paid_at` no tiene `provider_transfer_id`.
- existe doble release por `offer_id`.
- existe private external con `payout_eligible=true`.
- wallet negativa.

## Rollback rápido

1. Cambiar:

```text
PAYOUTS_ENABLED=false
PAYOUT_DRY_RUN=true
PAYOUT_PROVIDER=manual
```

2. Mantener Mercado Pago activo para pagos de rutas y billing.
3. Pasar `queued/processing` a `manual_review`.
4. Conciliar provider real antes de reintentar.
5. No editar balances manualmente.
6. Si hubo pago duplicado real, registrar incidente y usar transacción compensatoria.

## Runbook payout stuck

1. Buscar `payout_attempt_id`.
2. Revisar `provider_transfer_id`.
3. Consultar provider.
4. Si provider pagó: ejecutar `mark_payout_paid`.
5. Si provider no pagó: `mark_payout_failed` o `manual_review`.
6. Si destino inválido: pedir corrección de método.
7. Registrar operación crítica.

## Runbook posible doble pago

1. Desactivar payouts.
2. Congelar wallet/usuario afectado temporalmente desde admin si existe control.
3. Revisar `idempotency_key`.
4. Revisar provider transfer ids.
5. Confirmar si hubo una o dos transferencias reales.
6. No modificar balance directo.
7. Crear transacción compensatoria auditada si finanzas lo aprueba.

## Métricas

```text
marketplace_released_amount_cop
payouts_queued_count
payouts_processing_count
payouts_paid_count
payouts_failed_count
payouts_manual_review_count
average_time_to_paid
double_payout_prevented_count
private_external_paid_count
private_external_wallet_blocked_count
```
