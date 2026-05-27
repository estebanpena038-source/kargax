# 05 — Archivos exactos a editar y qué cambiar

Este documento es la guía operativa para el dev. No borrar lógica existente sin reemplazo seguro.

## 1. `frontend/src/app/api/payments/webhook/route.ts`

### Qué hace hoy

Procesa webhooks de Mercado Pago y separa `billing_plan`, `private_fleet_payroll` y `freight`.

### Qué cambiar

No pagar al camionero desde aquí.

Agregar solo metadata/estado si el pago de flete quedó aprobado:

```ts
// Después de reconcileFreightPaymentFromMercadoPagoPayment
// NO crear payout aquí.
// Solo asegurar que la ruta queda payment_secured/paid.
```

### No eliminar

- Validación de firma.
- `paymentApi.get`.
- Manejo de duplicados.
- `handleBillingPlanPayment`.
- `releasePrivateFleetPayrollRun`.
- `reconcileFreightPaymentFromMercadoPagoPayment`.

## 2. `frontend/src/lib/server/payments/freight-settlement.ts`

### Qué hace hoy

Cuando Mercado Pago aprueba un pago de flete, ejecuta la reconciliación, llama RPC `process_successful_payment`, sincroniza bodega y envía PINs.

### Qué cambiar

Agregar un resultado explícito que marque si la ruta quedó lista para ser ejecutada, pero no liberada a wallet:

```ts
return {
  ...,
  settlementApplied: true,
  payoutReleaseEligible: false,
  releaseReason: 'route_not_completed_yet'
}
```

No mezclar este archivo con payout automático. Este archivo es de pago aprobado, no de ruta finalizada.

## 3. Archivo donde se completa la ruta

No pude listar todo el árbol del repo desde el conector, así que el dev debe localizar el punto exacto con:

```bash
rg "delivery_pin|pickup_pin|completed|delivered|complete.*offer|mark.*delivered|process.*delivery" frontend/src supabase/migrations
```

Cuando encuentre el handler/RPC que marca ruta como completada, agregar:

```ts
await releaseMarketplaceFreightForCompletedOffer({
  supabaseAdmin,
  offerId,
  actor: 'route_completion',
  requestId,
});
```

Si el cierre se hace por SQL/RPC, crear trigger o llamar desde la API server que confirma entrega.

## 4. Crear `frontend/src/lib/server/wallet/marketplace-release.ts`

### Responsabilidad

Liberar al camionero freelancer después de completar ruta.

### Debe hacer

- Validar pago real.
- Validar ruta finalizada.
- Validar no duplicado.
- Calcular comisión y neto.
- Crear crédito wallet.
- Crear withdrawal/payout automático si hay método default.
- Registrar operación crítica.

## 5. `frontend/src/app/api/wallet/withdraw/route.ts`

### Qué hace hoy

Crea solicitud de retiro, reserva saldo, crea `payout_attempts` y notifica admin.

### Qué cambiar

Modificar el comportamiento cuando `automatic_payouts_enabled` sea true:

```ts
if (automaticPayoutsEnabled) {
  // Crear payout_attempt queued.
  // No decir "pendiente de aprobación administrativa".
  // Responder "pago automático en proceso".
}
```

Mantener manual si flag off.

### Agregar validación de rail

Solo permitir retiro automático para saldo marketplace/freelancer.

Antes de llamar RPC, validar que el saldo a retirar viene de transacciones elegibles:

```text
source_kind in ('marketplace_freight_release', 'trip_settlement', 'trip_deposit')
NO incluir private_fleet_salary si payment_mode='external_proof'
```

## 6. Crear `frontend/src/lib/server/payouts/types.ts`

Definir tipos canónicos:

```ts
export type PayoutProviderCode = 'manual' | 'cobre' | 'wompi' | 'bank_partner';

export type PayoutAttemptStatus =
  | 'queued'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'manual_review'
  | 'cancelled'
  | 'reversed';

export interface PayoutDestination {
  method: 'nequi' | 'savings' | 'checking';
  bankName?: string;
  accountNumber: string;
  accountHolderName: string;
  documentType: string;
  documentNumber: string;
}

export interface CreatePayoutInput {
  idempotencyKey: string;
  amountCop: number;
  destination: PayoutDestination;
  metadata: Record<string, string | number | boolean | null>;
}

export interface CreatePayoutResult {
  status: 'processing' | 'paid' | 'failed';
  providerTransferId?: string | null;
  receiptUrl?: string | null;
  rawResponse?: unknown;
  errorMessage?: string | null;
}
```

## 7. Crear `frontend/src/lib/server/payouts/provider.ts`

Resolver proveedor:

```ts
export function getPayoutProvider(): PayoutProvider {
  const provider = process.env.PAYOUT_PROVIDER || 'manual';

  if (provider === 'cobre') return cobrePayoutProvider;
  if (provider === 'wompi') return wompiPayoutProvider;
  return manualPayoutProvider;
}
```

## 8. Crear providers

### `providers/manual.ts`

No llama API externa. Marca `manual_review`.

### `providers/cobre.ts`

Adapter con placeholders de API. No poner credenciales.

### `providers/wompi.ts`

Adapter con placeholders. Confirmar con proveedor si soporta dispersión/payout antes de activar.

## 9. Crear `frontend/src/lib/server/payouts/processor.ts`

Procesa un payout attempt.

Responsabilidades:

- Leer attempt.
- Bloquear attempt.
- Validar estado.
- Llamar provider.
- Guardar response.
- Actualizar transaction.
- Crear comprobante.
- Notificar.

## 10. Crear `frontend/src/app/api/jobs/payouts/process/route.ts`

Endpoint interno para worker/cron.

Validación:

```ts
const internalKey = request.headers.get('x-internal-api-key');
if (internalKey !== process.env.INTERNAL_API_KEY) return 401;
```

No procesar en staging real:

```ts
if (process.env.PAYOUT_DRY_RUN === 'true') {
  // No llamar proveedor real.
}
```

## 11. Crear `frontend/src/app/api/payouts/webhook/route.ts`

Recibe confirmaciones del proveedor de payout.

Debe:

- Validar firma del proveedor.
- Resolver `payout_attempt_id`.
- Idempotencia.
- Marcar paid/failed.
- Adjuntar comprobante.
- Crear notificación.

## 12. `frontend/src/app/api/wallet/route.ts`

### Qué cambiar

Separar respuesta:

```ts
return NextResponse.json({
  marketplaceWallet,
  privateFleetLedger,
  payoutAttempts,
  transactions,
  defaultPaymentMethod,
});
```

### No romper

Mantener campos actuales mientras migras UI:

```ts
wallet,
transactions,
pendingWithdrawals,
privateFleetSummary
```

Así no rompes frontend existente.

## 13. `frontend/src/app/billetera/page.tsx`

### Cambiar textos

- “Retiros pendientes” → “Payouts en proceso”.
- “Salario mensual” → “Liquidaciones privadas”.
- “Disponible después de validaciones internas” → separar marketplace vs privado.

### Agregar dos secciones

```text
Marketplace freelancer
- Disponible para payout
- En proceso
- Pagado este mes

Flota privada
- Pendiente externo
- Comprobante cargado
- Pagado externo
```

### Botón de retiro

- Para saldo marketplace: permitir registrar método y retirar.
- Para private_fleet external: no mostrar botón “retirar”. Mostrar “ver comprobante”.

## 14. `frontend/src/lib/server/private-fleet-payroll.ts`

### Qué cambiar

Agregar soporte `payment_mode`.

Si `external_proof`:

- No llamar `getOrCreateWallet`.
- No sumar `available_balance`.
- No crear transacción retirable.
- Marcar item/run como documental.

Si `mercadopago_funded`:

- Mantener lógica actual, pero detrás de feature flag.

## 15. `frontend/src/lib/server/runtime-env.ts`

Agregar validación de envs de payout solo si `PAYOUTS_ENABLED=true`.

```ts
if (process.env.PAYOUTS_ENABLED === 'true') {
  if (!process.env.PAYOUT_PROVIDER) missingVariables.push('PAYOUT_PROVIDER');
  if (!process.env.PAYOUT_WEBHOOK_SECRET) missingVariables.push('PAYOUT_WEBHOOK_SECRET');
}
```

No obligar credenciales si `PAYOUT_PROVIDER=manual`.

## 16. `frontend/src/lib/mercadopago/config.ts`

No tocar tokens. Solo documentar que Mercado Pago cobra marketplace/flete y no hace payout post-entrega en este modelo.

## 17. `supabase/migrations/<timestamp>_wallet_marketplace_payouts_private_proofs.sql`

Crear migración nueva. No editar migraciones viejas.

Debe incluir:

- Extensiones a `payout_attempts`.
- Campos rail en `transactions`.
- Campos external proof en payroll.
- RPCs para claim/process payout.
- Políticas RLS.
- Índices únicos de idempotencia.

## 18. `.env.example`

Agregar nombres de variables sin valores reales.

Nunca poner tokens reales.
