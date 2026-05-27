# 08 - Testing, QA y runbook de produccion

## Meta

Evitar que KargaX pague dos veces, pague dinero que no existe, o mezcle saldos privados con marketplace.

## Tests unitarios obligatorios

### Payout provider

- `manualProvider` nunca llama API externa.
- `cobreProvider` usa idempotencyKey.
- `provider.createPayout` mapea estados a `processing|paid|failed|manual_review`.
- Errores HTTP no marcan paid.
- No se loggea cuenta ni documento completo.

### Payout processor

Casos:

```text
queued -> processing -> paid
queued -> processing -> failed
failed con attempts_count < 5 -> retry
failed con attempts_count >= 5 -> manual_review
paid duplicate -> no-op
daily limit exceeded -> manual_review
single payout limit exceeded -> manual_review
```

### Marketplace release

Casos:

```text
payment not completed -> no release
route not completed -> no release
already released -> idempotent success
valid route -> creates trip_deposit
valid route + default method + automatic flag -> creates payout_attempt
no default method -> saldo marketplace disponible, no payout
private fleet route -> no trip_deposit, no payout_attempt
private fleet expenses -> no wallet.available_balance, proof only
```

### Private fleet external

Casos:

```text
crear liquidacion -> pending_external_pay
subir comprobante -> proof_uploaded
marcar pagado -> paid_external
no suma wallet.available_balance
no suma marketplaceWallet.availableCop
transportador ve comprobante
transportador no puede retirar esa liquidacion
```

## Tests E2E staging

### Escenario 1 - marketplace con payout manual/dry-run

1. Crear empresa staging.
2. Crear camionero freelancer.
3. Guardar metodo Nequi fake valido: `3000000000`.
4. Publicar ruta marketplace.
5. Pagar con Mercado Pago sandbox.
6. Confirmar webhook.
7. Completar ruta con evidencia/PIN.
8. Ver `transactions.type = trip_deposit`, `money_rail = marketplace_freelancer`, `payout_eligible = true`.
9. Si `automatic_payouts_enabled=false`, confirmar saldo en `marketplaceWallet.availableCop` y sin proveedor real.
10. Si `automatic_payouts_enabled=true`, confirmar `payout_attempt.provider = cobre` y `status = queued`.
11. Ejecutar `/api/jobs/payouts/process` solo con `x-internal-api-key`.
12. Si `PAYOUTS_ENABLED=false` o `PAYOUT_DRY_RUN=true`, confirmar que no se llamo proveedor real.
13. Si provider real esta habilitado, confirmar `processing|paid|failed|manual_review`.

### Escenario 2 - marketplace payout fallido

1. Configurar provider real/dry-run para fallo controlado o forzar destino invalido.
2. Completar ruta marketplace.
3. Ver `payout_attempt.status = failed` o `manual_review`.
4. Ver retry programado si aun tiene intentos.
5. Admin pasa a fallback manual sin desbloquear doble retiro.
6. Confirmar que `locked_for_payout = true` hasta resolver.

### Escenario 3 - private fleet comprobante externo

1. Crear liquidacion privada por $4.000.000.
2. Camionero ve `pendiente externo`.
3. Admin/finance sube comprobante.
4. Estado cambia a `proof_uploaded`.
5. Admin/finance marca `paid_external`.
6. `wallet.available_balance` no cambia por flete, nomina ni viaticos privados.
7. `marketplaceWallet.availableCop` no cambia.
8. Historial privado muestra comprobante.
9. No existe `payout_attempt` para esa liquidacion.
10. Si la ruta privada tiene `Solo viaticos` o `Ruta + viaticos`, `expense_advance` queda documental y se paga con comprobante externo.

### Escenario 4 - anti doble pago

1. Ejecutar dos veces completion hook de la misma ruta marketplace.
2. Debe existir una sola `trip_deposit`.
3. Debe existir un solo `payout_attempt`.
4. Segunda ejecucion devuelve idempotent/no-op.
5. Repetir con flota privada: no debe crear `trip_deposit` ni `payout_attempt`.

## Checks antes de produccion

```bash
npm run lint
npm run typecheck
npm run build
npm run check
npm run check:release
```

Ademas:

```bash
rg "account_number.*console|document_number.*console|COBRE_API_KEY=|MERCADOPAGO_ACCESS_TOKEN=" frontend supabase .env.example
rg "password|contrasena|otp|clave dinamica" frontend/src supabase/migrations
```

No debe aparecer ningun secreto real.

## Checklist produccion inicial

- `PAYOUTS_ENABLED=false` para staging general o `true` solo en prueba controlada.
- `PAYOUT_DRY_RUN=true` para staging general.
- `PAYOUT_PROVIDER=manual|cobre`.
- `PAYOUT_MAX_SINGLE_COP` bajo.
- `PAYOUT_DAILY_LIMIT_COP` bajo.
- Webhook del proveedor configurado antes de payout real.
- Mercado Pago webhook configurado.
- Admin fallback funcional.
- Alertas de payout failed/manual_review.
- Runbook de reversion listo.

## Limites iniciales sugeridos

```text
Maximo payout individual: $500.000 COP
Maximo diario total: $2.000.000 COP
Batch size: 10
Retry: 5 intentos
Delay retry: 15 min / 1h / 3h / 12h / manual
```

## Metricas a monitorear

```text
payouts_queued_count
payouts_processing_count
payouts_paid_count
payouts_failed_count
payouts_manual_review_count
average_time_to_paid
double_payout_prevented_count
private_external_paid_count
marketplace_released_amount_cop
private_fleet_external_proof_count
private_fleet_wallet_leak_count
```

## Alertas

Crear alerta si:

- payout processing > 30 min.
- payout failed > 3 veces.
- payout paid pero transaction no actualizada.
- wallet negative.
- payout_attempt duplicado por misma idempotency_key.
- private external proof intenta modificar wallet.
- viaje privado crea `trip_deposit`.
- viaje privado crea `payout_attempt`.

## Runbook payout stuck

1. Buscar `payout_attempt_id`.
2. Consultar proveedor con `provider_transfer_id`.
3. Si proveedor pago: ejecutar `mark_payout_paid` con comprobante.
4. Si proveedor no pago: marcar failed y reintentar.
5. Si destino invalido: `manual_review` y pedir cuenta corregida.
6. Registrar operacion critica.

## Runbook posible doble pago

1. Congelar usuario/wallet temporalmente.
2. Buscar idempotency_key.
3. Ver provider_transfer_id.
4. Revisar logs de webhook.
5. Confirmar si proveedor hizo una o dos transferencias.
6. Si hubo doble pago real, escalar legal/finanzas y registrar incidente.
7. No editar balances manualmente sin transaccion compensatoria.
