# 07 — QA y regresión WALLET2.0

## Objetivo

Evitar tres fallos catastróficos:

1. doble pago,
2. retiro de dinero no recibido,
3. mezcla visual/operativa entre marketplace y flota privada.

## Unit tests obligatorios

### Private fleet external proof

```text
run.payment_mode='external_proof' + mpPayment.approved
=> releasePrivateFleetPayrollRun retorna walletTouched=false
=> no llama getOrCreateWallet
=> no actualiza wallets.available_balance
=> no inserta transaction private_fleet_salary retirable
=> crea admin notification de bloqueo
```

### Private fleet mercadopago funded

```text
run.payment_mode='mercadopago_funded' + mpPayment.approved
=> mantiene comportamiento legacy/futuro
=> transaction money_rail='private_fleet_mercadopago_funded'
=> payout_eligible=false
```

### Wallet route rails

```text
transactions marketplace + private external
=> marketplaceWallet solo suma marketplace
=> privateFleetLedger solo suma privados
=> wallet legacy sigue existiendo temporalmente
```

### Withdrawal rail validation

```text
available_balance=4.000.000 por private_fleet_salary legacy
marketplaceEligibleCop=0
POST /api/wallet/withdraw amount=50000
=> 400
=> mensaje: solo saldo marketplace confirmado
```

### Payout processor

```text
queued -> processing -> paid
queued -> processing -> failed
failed attempts_count<5 -> failed + next_retry_at
failed attempts_count>=5 -> manual_review
paid duplicate -> no-op
```

### Marketplace release

```text
payment not completed -> no release
route not completed -> no release
dispute active -> no release
already released -> no-op idempotente
valid route -> creates marketplace release transaction
valid route + default method -> creates payout_attempt queued
no default method -> saldo queda disponible
```

## E2E staging

### Escenario A — marketplace dry-run

1. Crear empresa staging.
2. Crear camionero freelancer.
3. Crear ruta marketplace.
4. Pagar por Mercado Pago sandbox.
5. Confirmar webhook.
6. Ver payment completed y ruta secured.
7. Completar ruta con evidencia.
8. Ejecutar job de payouts con `PAYOUT_DRY_RUN=true`.
9. Ver payout_attempt manual/dry-run, sin llamada real.
10. Ver saldo y timeline correctos.

### Escenario B — private external proof

1. Crear liquidación privada por $4.000.000.
2. Conductor ve “pendiente externo”.
3. Admin sube comprobante.
4. Estado `proof_uploaded`.
5. Admin marca `paid_external`.
6. `wallet.available_balance` queda igual.
7. Botón de retiro no usa ese valor.

### Escenario C — anti doble pago

1. Ejecutar cierre de ruta dos veces.
2. Ejecutar job de payouts dos veces.
3. Debe existir una sola transaction marketplace release.
4. Debe existir un solo payout_attempt por idempotency_key.
5. Provider no recibe doble transferencia.

### Escenario D — payout failed

1. Provider mock falla.
2. Payout pasa a failed.
3. Tiene next_retry_at.
4. Después de 5 intentos pasa a manual_review.
5. Admin puede marcar pago manual con comprobante.

## SQL checks después de staging

```sql
-- No debe haber privados externos como payout eligible
select id, type, money_rail, payout_eligible, external_proof_only
from public.transactions
where type = 'private_fleet_salary'
  and payout_eligible = true;

-- No debe haber doble release marketplace
select offer_id, count(*)
from public.transactions
where money_rail='marketplace_freelancer'
  and type in ('marketplace_freight_release', 'trip_deposit', 'trip_settlement')
group by offer_id
having count(*) > 1;

-- Payouts trabados
select id, status, attempts_count, processing_started_at, next_retry_at
from public.payout_attempts
where status='processing'
  and processing_started_at < now() - interval '30 minutes';
```

## Comandos

Desde raíz:

```bash
npm install
npm run repo:audit
npm run lint
npm run typecheck
npm run build
npm run check
npm run check:release
```

Desde frontend:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run check
npm run check:release
```

## Gate de producción

No activar payout real si cualquiera falla:

- doble release posible,
- rail validation no existe,
- payroll external toca wallet,
- provider real no valida firma/webhook,
- no hay manual fallback,
- no hay límites diarios,
- `PAYOUT_DRY_RUN=false` en staging,
- logs exponen cuenta/documento completo.
