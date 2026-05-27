# 03 — Marketplace: retiro automático para camionero freelancer

## Objetivo

Implementar Opción B:

```text
KargaX confirma que la ruta terminó.
KargaX envía pago automático al transportador usando proveedor de dispersión/payout.
KargaX guarda comprobante.
```

## Flujo target completo

```text
1. Empresa publica ruta/carga.
2. Camionero freelancer acepta o queda asignado.
3. Empresa paga ruta con Mercado Pago.
4. Mercado Pago envía webhook.
5. KargaX valida firma y consulta pago real.
6. KargaX marca ruta como asegurada.
7. Camionero ejecuta ruta.
8. Entrega se completa con PIN/foto/firma/novedad.
9. KargaX valida que no haya disputa activa.
10. KargaX calcula neto del camionero.
11. KargaX crea crédito marketplace disponible.
12. KargaX crea payout_attempt automático.
13. Worker de payouts llama proveedor.
14. Proveedor responde processing/paid/failed.
15. KargaX actualiza transacción, wallet y comprobante.
```

## Principio importante

El webhook de Mercado Pago NO debe pagar al camionero todavía.

Razón: el pago aprobado asegura la ruta, pero el servicio aún no terminó.

La liberación al camionero debe ocurrir cuando se cumplan todas estas condiciones:

```text
payment.status = completed
cargo_offer.status in ('delivered', 'completed', 'closed')
delivery_pod_validated = true
no active dispute
not already released
```

## Dos modelos posibles

### Modelo A — KargaX cobra y luego dispersa

La empresa paga a la cuenta de KargaX/Mercado Pago.
KargaX retiene comisión y paga al camionero al finalizar.

Ventaja:

- Controlas entrega antes de pagar.
- Puedes manejar disputas.
- Puedes pagar a Nequi/banco con proveedor.

Desventaja:

- Más responsabilidad financiera y legal.
- Necesitas conciliación y proveedor de payout.

### Modelo B — Mercado Pago marketplace split OAuth

Cada camionero conecta su cuenta Mercado Pago. El checkout se crea con el access token del vendedor y `marketplace_fee` para KargaX.

Ventaja:

- Mercado Pago hace split automático.
- Menos custodia por parte de KargaX.

Desventaja:

- El split ocurre dentro del flujo Mercado Pago y no necesariamente queda retenido hasta que la ruta termine.
- Requiere OAuth por cada camionero/vendedor.
- No resuelve por sí solo “pagar después de entrega” si necesitas escrow operativo.

## Decisión recomendada para KargaX ahora

Implementar primero Modelo A con límites bajos y proveedor de payout.

Mantener Modelo B como estrategia futura si quieres bajar custodia y conectar cuentas de camioneros.

## Archivos a crear

```text
frontend/src/lib/server/payouts/types.ts
frontend/src/lib/server/payouts/provider.ts
frontend/src/lib/server/payouts/providers/manual.ts
frontend/src/lib/server/payouts/providers/cobre.ts
frontend/src/lib/server/payouts/providers/wompi.ts
frontend/src/lib/server/payouts/processor.ts
frontend/src/lib/server/payouts/reconcile.ts
frontend/src/lib/server/wallet/marketplace-release.ts
frontend/src/app/api/jobs/payouts/process/route.ts
frontend/src/app/api/payouts/webhook/route.ts
```

## Archivos a editar

```text
frontend/src/app/api/wallet/withdraw/route.ts
frontend/src/app/api/wallet/route.ts
frontend/src/app/billetera/page.tsx
frontend/src/app/api/admin/withdrawals/route.ts
frontend/src/app/api/admin/withdrawals/[id]/route.ts
frontend/src/lib/server/payments/freight-settlement.ts
frontend/src/lib/contracts/payments.ts
frontend/src/lib/server/runtime-env.ts
frontend/src/lib/mercadopago/config.ts
supabase/migrations/<new_migration>.sql
```

## Servicio principal: `marketplace-release.ts`

Crear:

```ts
// frontend/src/lib/server/wallet/marketplace-release.ts

export async function releaseMarketplaceFreightForCompletedOffer(input: {
  supabaseAdmin: SupabaseAdminClient;
  offerId: string;
  actor: 'system' | 'admin' | 'route_completion';
  requestId?: string;
}) {
  // 1. Cargar offer, payment, trucker wallet.
  // 2. Validar que payment.status === 'completed'.
  // 3. Validar que offer está finalizada.
  // 4. Validar que no existe release anterior para offer_id.
  // 5. Calcular bruto, comisión KargaX y neto camionero.
  // 6. Crear transaction type='trip_deposit', source_kind='marketplace_freight_release'.
  // 7. Sumar wallet.available_balance.
  // 8. Crear payout_attempt si automatic_payouts_enabled está activo y camionero tiene método guardado.
  // 9. Registrar operación crítica.
  // 10. Devolver resultado idempotente.
}
```

## Idempotencia obligatoria

La liberación debe tener una llave única:

```text
marketplace_release:<offer_id>:<payment_id>:<trucker_id>
```

La payout attempt debe tener:

```text
marketplace_payout:<offer_id>:<payment_id>:<trucker_id>:<amount_cop>
```

## Estados de payout

Usar estos estados en `payout_attempts`:

```text
queued
processing
paid
failed
manual_review
cancelled
reversed
```

## Worker de payouts

Crear endpoint interno:

```text
POST /api/jobs/payouts/process
```

Reglas:

- Requiere `x-internal-api-key`.
- Solo procesa en producción si `PAYOUTS_ENABLED=true`.
- Si `PAYOUT_DRY_RUN=true`, no llama proveedor real.
- Toma máximo `PAYOUT_BATCH_SIZE` attempts por ejecución.
- Solo toma `queued` y `failed` con retry disponible.
- Usa `SELECT ... FOR UPDATE SKIP LOCKED` vía RPC o función SQL.
- Llama proveedor.
- Guarda provider response.
- Marca `processing`, `paid` o `failed`.

## Pseudocódigo worker

```ts
export async function POST(request: NextRequest) {
  assertInternalApiKey(request);
  assertPayoutsEnabled();

  const attempts = await claimQueuedPayoutAttempts({ limit: 10 });

  for (const attempt of attempts) {
    await processPayoutAttempt({ attemptId: attempt.id });
  }

  return apiSuccess({ processed: attempts.length });
}
```

## Processor

```ts
export async function processPayoutAttempt(input: { attemptId: string }) {
  const attempt = await loadAttemptForUpdate(input.attemptId);

  if (!attempt || !['queued', 'failed'].includes(attempt.status)) return;

  await markAttemptProcessing(attempt.id);

  const provider = resolvePayoutProvider(attempt.provider);
  const response = await provider.createPayout({
    idempotencyKey: attempt.idempotency_key,
    amountCop: attempt.amount_cop,
    destination: attempt.destination_snapshot,
    metadata: {
      payoutAttemptId: attempt.id,
      walletTransactionId: attempt.wallet_transaction_id,
      source: attempt.source_kind,
    },
  });

  if (response.status === 'paid') {
    await markPayoutPaidAndFinalizeWallet({ attempt, response });
  } else if (response.status === 'processing') {
    await markPayoutProcessing({ attempt, response });
  } else {
    await markPayoutFailed({ attempt, response });
  }
}
```

## Qué pasa si falla el payout

No se pierde dinero.

Si proveedor falla antes de pagar:

```text
payout_attempt.status = failed
wallet.available_balance = 0 si el retiro ya está reservado
transaction.status = pending o failed según modelo actual
admin puede reintentar o devolver saldo
```

Si proveedor confirma que no pagó:

- Revertir reserva.
- Crear `withdrawal_reversal` si aplica.
- Volver saldo a disponible.

Si proveedor pagó pero webhook no llegó:

- Job de conciliación consulta provider.
- Marca `paid` si provider confirma.

## Integración con `/api/wallet/withdraw`

Actualmente este endpoint ya crea `payout_attempts`.

Cambiar respuesta:

### Si manual

```json
{
  "success": true,
  "message": "Solicitud de retiro creada. Queda pendiente de aprobación administrativa.",
  "payoutMode": "manual"
}
```

### Si automático

```json
{
  "success": true,
  "message": "Retiro recibido. KargaX procesará el pago automáticamente.",
  "payoutMode": "automatic",
  "payoutAttemptId": "..."
}
```

No llamar proveedor directo desde este endpoint salvo que sea MVP controlado. Lo recomendado es job/worker.

## Auto-payout sin solicitud del camionero

Para que sea totalmente automático al terminar ruta, no esperes que el camionero entre a retirar.

Al completar ruta:

1. Liberar saldo.
2. Si camionero tiene método default válido, crear withdrawal + payout_attempt automático.
3. Procesar por worker.

Si no tiene método default:

1. Saldo queda disponible.
2. UI pide registrar Nequi/banco.
3. Cuando lo registre, se crea payout.

## Señal UI para freelancer

```text
Ruta ABC completada
Pago neto: $920.000
Estado: Pago automático en proceso
Destino: Nequi ****1234
Comprobante: disponible cuando proveedor confirme
```

## Fallback manual

Aunque el objetivo sea automático, mantener admin manual.

Razones:

- Payout fallido.
- Cuenta inválida.
- Proveedor caído.
- Monto alto.
- Disputa.
- Revisión antifraude.

## Límites iniciales recomendados

```text
PAYOUTS_ENABLED=false al inicio
PAYOUT_DRY_RUN=true en staging
PAYOUT_MAX_SINGLE_COP=500000
PAYOUT_DAILY_LIMIT_COP=2000000
PAYOUT_BATCH_SIZE=10
PAYOUT_MIN_AMOUNT_COP=50000
```

Subir límites solo cuando existan pagos reales conciliados.
