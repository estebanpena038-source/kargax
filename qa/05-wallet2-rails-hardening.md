# WALLET2.0 Rails Hardening QA

## Objetivo

Validar que KargaX separa saldo marketplace retirable de liquidaciones privadas externas sin activar payouts reales.

## Registro rapido de pruebas ejecutadas

Fecha: 2026-05-26.

| # | Prueba | Encaja con | Resultado |
|---|---|---|---|
| 1 | SQL `20260526_wallet2_rails_hardening.sql` aplicado en Supabase | Base WALLET2.0 / migracion de rails | PASS |
| 2 | `npm run check:release` | Gate DB, RLS/buckets, columnas WALLET2.0, feature flags | PASS |
| 3 | `npm --prefix frontend run typecheck` | Contratos TS de wallet, payout, delivery y UI | PASS |
| 4 | `npm --prefix frontend run build` | Build completo Next.js con rutas nuevas | PASS |
| 5 | `npm --prefix frontend run lint` | Calidad estatica; 0 errores, warnings existentes | PASS |
| 6 | Checks remotos agrupados: privados no retirables, payouts trabados, doble release, idempotencia payout | Escenarios C, D, E y F | PASS |
| 7 | `vercel --prod --yes` | Deploy controlado con payouts reales apagados por defecto | PASS |
| 8 | Smoke `GET /api/health` en `https://kargax-staging.vercel.app` | Salud post-deploy y env runtime | PASS |

Checks remotos agrupados ejecutados:

```text
private_withdrawable_leaks=0
stuck_processing_payouts_30m=0
double_marketplace_release_sample_1000=0
duplicate_payout_idempotency_sample_1000=0
```

Pendiente manual corto: ejecutar un flujo real sandbox con ruta marketplace completa y un flujo privado con comprobante. Eso cubre Escenario A y B end-to-end.

## Escenario A: Marketplace dry-run

1. Crear ruta marketplace en staging.
2. Pagar con Mercado Pago sandbox.
3. Confirmar que el webhook deja `payments.status='completed'` y no crea payout.
4. Completar pickup, evidencia de entrega y PIN/POD desde `/viaje/[offerId]/entrega`.
5. Verificar que se crea una sola transaccion `trip_deposit` con:
   - `money_rail='marketplace_freelancer'`
   - `metadata->>'source_kind'='marketplace_freight_release'`
   - `payout_eligible=true`
   - `external_proof_only=false`
6. Ejecutar job con dry-run/manual y confirmar que no llama proveedor real.

## Escenario B: Flota privada external proof

1. Crear liquidacion privada por nomina, flete o viatico.
2. Confirmar que `payment_mode='external_proof'`.
3. Registrar o simular comprobante externo.
4. Verificar que `wallet.available_balance` no aumenta.
5. Verificar que no hay transaction privada con `payout_eligible=true`.
6. Confirmar que `/billetera` muestra la liquidacion en "Liquidaciones privadas", no en saldo retirable.

## Escenario C: Anti doble pago

1. Completar la misma entrega marketplace dos veces o reintentar el endpoint server.
2. Confirmar una sola liberacion por oferta:

```sql
select offer_id, count(*)
from public.transactions
where type='trip_deposit'
  and money_rail='marketplace_freelancer'
  and metadata->>'source_kind' in ('marketplace_freight_release', 'trip_settlement')
group by offer_id
having count(*) > 1;
```

El resultado esperado es cero filas.

## Escenario D: Retiro bloquea saldo privado/legacy

1. Preparar una wallet con `available_balance` inflado por `private_fleet_salary` legacy.
2. Intentar retirar un monto mayor al saldo marketplace elegible.
3. Debe responder 400 con mensaje de saldo marketplace confirmado.

## Escenario E: Payout failed y fallback manual

1. Dejar `PAYOUTS_ENABLED=true`, `PAYOUT_DRY_RUN=true` y `PAYOUT_PROVIDER=manual`.
2. Crear un retiro marketplace que genere `payout_attempt.status='queued'`.
3. Ejecutar `POST /api/jobs/payouts/process` con `x-internal-api-key`.
4. Confirmar que el intento queda en `manual_review` sin llamada a proveedor real.
5. Desde admin ejecutar `force_manual_review`, `retry_payout` y `mark_paid_manual` sobre el retiro.
6. Confirmar que `mark_paid_manual` marca la transaccion como `completed`, guarda `provider_transfer_id` manual y desbloquea `locked_for_payout`.

## Escenario F: Payout processor sin doble ejecucion

1. Crear un payout `queued` con `idempotency_key`.
2. Ejecutar el job dos veces seguidas.
3. Confirmar que `claim_payout_attempts` no procesa dos veces el mismo registro en paralelo.
4. Confirmar que no existe mas de un `payout_attempt` por `idempotency_key`.

## SQL checks obligatorios

```sql
select id, type, money_rail, payout_eligible, external_proof_only
from public.transactions
where (
    type='private_fleet_salary'
    or money_rail like 'private_fleet%'
    or metadata->>'source_kind' like 'private_fleet%'
)
and payout_eligible = true;
```

```sql
select id, status, attempts_count, processing_started_at, next_retry_at
from public.payout_attempts
where status='processing'
  and processing_started_at < now() - interval '30 minutes';
```

```sql
select idempotency_key, count(*)
from public.payout_attempts
where idempotency_key is not null
group by idempotency_key
having count(*) > 1;
```

## Comandos

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm run repo:audit
npm run check:release
```
