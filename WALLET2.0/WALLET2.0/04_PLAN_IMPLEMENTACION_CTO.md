# 04 — Plan de implementación CTO

## Commit 1 — Migración de rails financieros

Crear nueva migración en `supabase/migrations/<timestamp>_wallet2_rails_hardening.sql`.

Incluye:

- columnas en `transactions`,
- columnas en `payout_attempts`,
- columnas en `private_fleet_payroll_runs`,
- tabla `private_fleet_payment_proofs`,
- índices de idempotencia,
- RPC `claim_payout_attempts`,
- RPC `mark_payout_paid`,
- RPC `mark_payout_failed`,
- RPC `mark_payout_manual_review`,
- backfill conservador.

**Done:** migración corre sin editar migraciones viejas y no cambia balances.

## Commit 2 — Bloqueo flota privada externa

Editar `frontend/src/lib/server/private-fleet-payroll.ts`.

Reglas:

- Si `payment_mode !== 'mercadopago_funded'`, no tocar wallet.
- En `external_proof`, registrar incidente/admin notification si llega webhook Mercado Pago inesperado.
- Mantener comportamiento legacy solo para `mercadopago_funded`.
- Retornar `walletTouched:false` en external.

**Done:** payroll externo no crea wallet, no crea transaction retirable y no marca item `released_to_wallet`.

## Commit 3 — Payload wallet separado

Editar `frontend/src/app/api/wallet/route.ts`.

Agregar:

```ts
marketplaceWallet
privateFleetLedger
payoutAttempts
```

Mantener campos legacy durante migración:

```ts
wallet
transactions
pendingWithdrawals
privateFleetSummary
```

**Done:** `/api/wallet` permite UI nueva sin romper UI vieja.

## Commit 4 — Retiro solo desde marketplace eligible

Editar `frontend/src/app/api/wallet/withdraw/route.ts`.

Agregar antes de RPC:

- cálculo de saldo marketplace elegible,
- bloqueo si `amount > marketplaceAvailableCop`,
- metadata `money_rail='wallet_withdrawal'`,
- mensaje diferente si payout automático vs manual.

**Done:** `private_fleet_salary` y legacy no se retiran.

## Commit 5 — Payout providers + processor dry-run

Crear:

- `frontend/src/lib/server/payouts/types.ts`
- `frontend/src/lib/server/payouts/provider.ts`
- `frontend/src/lib/server/payouts/providers/manual.ts`
- `frontend/src/lib/server/payouts/processor.ts`
- `frontend/src/app/api/jobs/payouts/process/route.ts`

**Done:** worker puede procesar `queued` en dry-run/manual sin pagar dinero real.

## Commit 6 — Marketplace release al cierre de ruta

Crear:

- `frontend/src/lib/server/wallet/marketplace-release.ts`

Luego localizar punto exacto donde la ruta queda completada:

```bash
rg "delivery_pin|pickup_pin|completed|delivered|complete.*offer|mark.*delivered|process.*delivery" frontend/src supabase/migrations
```

Integrar:

```ts
await releaseMarketplaceFreightForCompletedOffer({
  supabaseAdmin,
  offerId,
  actor: 'route_completion',
  requestId,
});
```

**Done:** doble completion no duplica release ni payout.

## Commit 7 — UI `/billetera` rails separados

Editar `frontend/src/app/billetera/page.tsx`.

Nuevo layout:

1. Marketplace — saldo retirable.
2. Payouts automáticos/manuales.
3. Flota privada — liquidaciones externas.
4. Historial.

**Done:** copy deja claro qué se puede retirar y qué es comprobante externo.

## Commit 8 — Admin payout operations

Crear o extender admin:

- `GET /api/admin/payout-attempts`
- `PATCH /api/admin/payout-attempts/[id]`

Acciones:

- retry,
- force_manual_review,
- mark_paid_manual_with_proof,
- cancel.

**Done:** soporte puede resolver fallos sin editar DB manualmente.

## Commit 9 — Webhook provider payout

Crear:

- `frontend/src/app/api/payouts/webhook/route.ts`

Reglas:

- validar firma,
- resolver payout attempt por idempotency/provider transfer id,
- idempotencia,
- marcar paid/failed,
- guardar comprobante.

**Done:** provider puede confirmar estado real.

## Commit 10 — QA, producción controlada y rollback

Correr:

```bash
npm run lint
npm run typecheck
npm run build
npm run check
npm run check:release
```

Activar primero:

```text
PAYOUTS_ENABLED=false
PAYOUT_DRY_RUN=true
```

Después dry-run real con 1 cliente y límites bajos.
