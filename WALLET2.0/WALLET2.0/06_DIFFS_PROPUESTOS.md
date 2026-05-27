# 06 — Diffs propuestos por archivo

> Estos cambios están escritos como guía de implementación. Aplicar después de correr la migración y revisar nombres exactos de columnas en Supabase.

## 1) `frontend/src/lib/server/private-fleet-payroll.ts`

### Objetivo

Bloquear que `external_proof` toque wallet. Mantener `mercadopago_funded` como modo explícito futuro.

### Cambio clave

Después de cargar `run`, antes de marcar `funded` y antes de cargar items:

```ts
const paymentMode = String(run.payment_mode || 'external_proof');
const providerPaymentId = mpPayment.id ? String(mpPayment.id) : null;

if (paymentMode !== 'mercadopago_funded') {
  await supabaseAdmin
    .from('private_fleet_payroll_runs')
    .update({
      funded_payment_id: providerPaymentId,
      gateway_response: mpPayment,
      external_payment_status: run.external_payment_status || 'pending_external_pay',
      external_payment_note: [
        run.external_payment_note,
        `Wallet release blocked: payment_mode=${paymentMode}`,
      ].filter(Boolean).join(' | '),
    })
    .eq('id', run.id);

  await createAdminNotification(supabaseAdmin, {
    type: 'private_fleet_wallet_release_blocked',
    title: 'Liberación privada bloqueada',
    message: `La liquidación privada ${run.id} no se liberó a wallet porque usa ${paymentMode}.`,
    data: {
      business_id: refData.business_id,
      payroll_run_id: run.id,
      payment_mode: paymentMode,
      mp_payment_id: providerPaymentId,
      reason: 'external_proof_does_not_touch_wallet',
    },
  });

  return {
    released: false,
    duplicate: false,
    status: 'wallet_release_blocked_external_proof',
    runId: run.id,
    releasedItems: 0,
    walletTouched: false,
  };
}
```

Y dentro del flujo legacy/futuro que sí libera:

```ts
metadata: {
  source_kind: 'private_fleet_salary',
  source_reference: run.id,
  money_rail: 'private_fleet_mercadopago_funded',
  payout_eligible: false,
  external_proof_only: false,
  // resto igual...
}
```

Además al insertar transaction:

```ts
money_rail: 'private_fleet_mercadopago_funded',
payout_eligible: false,
external_proof_only: false,
```

## 2) `frontend/src/app/api/wallet/route.ts`

### Objetivo

Separar payload sin romper UI actual.

### Agregar helpers

```ts
function isMarketplaceIncome(tx: Record<string, any>) {
  const moneyRail = tx.money_rail || tx.metadata?.money_rail;
  return (
    moneyRail === 'marketplace_freelancer' ||
    ['marketplace_freight_release', 'trip_deposit', 'trip_settlement'].includes(tx.type)
  ) && tx.status === 'completed' && tx.external_proof_only !== true;
}

function isPayoutWithdrawal(tx: Record<string, any>) {
  return tx.type === 'withdrawal' || tx.money_rail === 'wallet_withdrawal';
}
```

### Cambiar select de transactions

Agregar columnas nuevas si existen:

```ts
.select('id, wallet_id, offer_id, type, status, amount, description, reference_id, metadata, money_rail, payout_eligible, payout_attempt_id, locked_for_payout, external_proof_only, balance_before, balance_after, pending_balance_before, pending_balance_after, created_at')
```

### Nuevo payload

```ts
const marketplaceTransactions = normalizedTransactions.filter(isMarketplaceIncome);
const withdrawalTransactions = normalizedTransactions.filter(isPayoutWithdrawal);

const marketplaceWallet = {
  availableBalanceCop: Number(wallet.available_balance || 0),
  eligibleBalanceCop: marketplaceTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
  pendingReleaseCop: normalizedTransactions
    .filter((tx) => tx.money_rail === 'marketplace_freelancer' && tx.status === 'pending')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
  payoutProcessingCop: withdrawalTransactions
    .filter((tx) => ['pending', 'processing'].includes(String(tx.status)))
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0),
  totalPaidCop: withdrawalTransactions
    .filter((tx) => ['approved', 'paid', 'completed'].includes(String(tx.status)))
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0),
};

const privateFleetLedger = {
  pendingExternalPayCop: 0,
  proofUploadedCop: 0,
  paidExternalCop: 0,
  items: privateFleetPayrollItems || [],
};
```

Completar `privateFleetLedger` con los estados reales de `private_fleet_payroll_runs/items` después de ampliar selects.

## 3) `frontend/src/app/api/wallet/withdraw/route.ts`

### Objetivo

Retiro solo contra rail marketplace elegible y mensaje correcto.

### Antes de llamar `create_withdrawal_request`

```ts
const { data: eligibleTransactions, error: eligibleTxError } = await supabaseAdmin
  .from('transactions')
  .select('id, amount, type, status, money_rail, payout_eligible, locked_for_payout, external_proof_only')
  .eq('wallet_id', refreshedWallet.id)
  .eq('payout_eligible', true)
  .eq('external_proof_only', false)
  .in('money_rail', ['marketplace_freelancer'])
  .in('status', ['completed', 'paid', 'settled']);

if (eligibleTxError) {
  return NextResponse.json({ error: 'No se pudo validar saldo elegible para retiro' }, { status: 500 });
}

const marketplaceEligibleCop = (eligibleTransactions || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

if (Number(amount) > marketplaceEligibleCop) {
  return NextResponse.json({
    error: 'Solo puedes retirar saldo marketplace confirmado. Las liquidaciones privadas se pagan por fuera con comprobante.',
    marketplaceEligibleCop,
  }, { status: 400 });
}
```

### Cambiar respuesta final

```ts
return NextResponse.json({
  success: true,
  message: automaticPayoutsEnabled
    ? 'Retiro creado. El pago automático quedó en proceso y será conciliado por KargaX.'
    : 'Solicitud de retiro creada. Queda pendiente de revisión administrativa.',
  request_id: withdrawalRequest.request_id,
  payout: payoutAttempt,
});
```

### Logs/email

No enviar cuenta/documento completo en logs. Usar last4.

## 4) `frontend/src/app/billetera/page.tsx`

### Objetivo

Separar UI.

### Nuevo copy de tarjetas

- `Marketplace — saldo retirable`
- `Payouts en proceso`
- `Liquidaciones privadas — pago externo`
- `Comprobantes privados`

### Reemplazar narrativa private salary

Antes:

```text
Tu empresa libero nomina privada a tu billetera operativa.
```

Después:

```text
Tu empresa registró una liquidación privada. KargaX muestra el comprobante, pero este dinero se paga por fuera y no aumenta tu saldo retirable.
```

## 5) `frontend/src/lib/server/wallet/marketplace-release.ts`

Crear archivo. Ver skeleton en `code/frontend/src/lib/server/wallet/marketplace-release.ts`.

## 6) `frontend/src/lib/server/payouts/*`

Crear capa de providers. Ver `code/frontend/src/lib/server/payouts`.

## 7) `frontend/src/app/api/jobs/payouts/process/route.ts`

Crear job interno con `x-internal-api-key`, `PAYOUTS_ENABLED`, `PAYOUT_DRY_RUN`, batch size y límites.

## 8) `frontend/src/app/api/payouts/webhook/route.ts`

Crear después de elegir proveedor real. No activar sin firma de proveedor.
