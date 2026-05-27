# 02 — Estado actual del repo y lectura técnica

## Fuente de verdad

Según el README del repo, la app principal está en `frontend`, la historia oficial de base de datos en `supabase/migrations`, y roadmap/auditoría en `SPTRINTS`.

## Pagos Mercado Pago

### Archivo

`frontend/src/app/api/payments/webhook/route.ts`

### Estado actual

El webhook actual:

- Valida firma de Mercado Pago.
- Ignora tipos de evento no soportados.
- Consulta el pago real usando `paymentApi.get`.
- Parsea `external_reference`.
- Procesa tres tipos:
  - `billing_plan`
  - `private_fleet_payroll`
  - `freight`

### Lectura

Esto es correcto. No hay que eliminarlo.

El webhook es la entrada de verdad para pagos reales.

## Contratos de pago

### Archivo

`frontend/src/lib/contracts/payments.ts`

### Estado actual

Existen referencias separadas:

- `FreightPaymentReference`
- `BillingPlanPaymentReference`
- `PrivateFleetPayrollPaymentReference`

Esto es muy bueno porque KargaX ya separa los tipos de pago.

### Cambio recomendado

Agregar un cuarto tipo para payout si se necesita correlación externa:

```ts
export interface MarketplacePayoutReference {
  version: 1;
  kind: 'marketplace_payout';
  payout_attempt_id: string;
  offer_id: string;
  payment_id: string;
  trucker_id: string;
}
```

No es obligatorio si el proveedor de payout permite metadata propia y usamos `payout_attempts.id` como referencia externa.

## Reconciliación de flete

### Archivo

`frontend/src/lib/server/payments/freight-settlement.ts`

### Estado actual

Cuando Mercado Pago aprueba un pago de flete:

- Resuelve el pago local.
- Actualiza estado de payment.
- Ejecuta RPC `process_successful_payment`.
- Sincroniza citas de bodega.
- Envía PINs.

### Lectura

Este archivo debe seguir siendo responsable de asegurar la ruta después del pago.

No debe mandar payout todavía, porque el pago aprobado no significa que la ruta terminó.

### Cambio recomendado

Crear un servicio aparte que se invoque al completar la ruta:

`frontend/src/lib/server/wallet/marketplace-release.ts`

Ese servicio debe liberar el dinero al camionero y crear payout automático.

## Wallet del camionero

### Archivo

`frontend/src/app/billetera/page.tsx`

### Estado actual

La UI dice que la billetera es operativa con retiros a Nequi y cuentas bancarias.

Carga:

- `/api/wallet`
- `/api/wallet/withdraw`

Muestra:

- `available_balance`
- transacciones
- retiros pendientes
- método de pago guardado
- resumen de flota privada

### Problema

Hoy la UI mezcla visualmente:

- pagos de ruta
- salario mensual privado
- gastos privados
- retiros

Para el nuevo diseño, se deben separar carriles.

### Cambio recomendado

Crear secciones:

1. **Marketplace — saldo retirable**
2. **Payouts automáticos**
3. **Flota privada — liquidaciones externas**
4. **Historial**

## API wallet

### Archivo

`frontend/src/app/api/wallet/route.ts`

### Estado actual

- Solo deja entrar a `user_type === 'trucker'`.
- Crea wallet si no existe.
- Lee `wallets`.
- Lee `transactions`.
- Lee `payment_methods`.
- Lee `trip_financial_allocations`.
- Lee `private_fleet_payroll_items`.
- Arma `privateFleetSummary`.

### Problema

Debe diferenciar:

- dinero marketplace real retirable,
- liquidaciones privadas externas no retirable.

### Cambio recomendado

Devolver payload separado:

```ts
{
  marketplaceWallet: {
    availableBalance,
    pendingRelease,
    payoutProcessing,
    totalPaid,
  },
  privateFleetLedger: {
    pendingExternalPay,
    proofUploaded,
    paidExternal,
    items,
  },
  transactions,
  payoutAttempts,
}
```

## API retiro

### Archivo

`frontend/src/app/api/wallet/withdraw/route.ts`

### Estado actual

El endpoint:

- Valida monto y método.
- Valida cuenta/Nequi.
- Refresca wallet.
- Llama RPC `create_withdrawal_request`.
- Crea `payout_attempts` con estado `queued` si `automatic_payouts_enabled` está activo; si no, `manual_review`.
- Notifica al admin.
- Devuelve mensaje de revisión administrativa.

### Lectura

La base ya existe. Falta el worker real que tome `payout_attempts.status = queued` y llame al proveedor.

### Cambio recomendado

No eliminar la lógica actual. Convertirla en:

- si `automatic_payouts_enabled = false`: comportamiento actual manual.
- si `automatic_payouts_enabled = true`: crear payout attempt y procesar automático.

## Admin de retiros

### Archivos

- `frontend/src/app/api/admin/withdrawals/route.ts`
- `frontend/src/app/api/admin/withdrawals/[id]/route.ts`

### Estado actual

Existe panel/API admin para ver y procesar retiros. PATCH llama RPC `process_withdrawal_request` con `approve`, `reject` o `cancel`.

### Cambio recomendado

Mantener como fallback.

No eliminar.

Agregar acciones:

- `retry_payout`
- `force_manual_review`
- `mark_paid_manual_with_proof`

## Nómina privada actual

### Archivo

`frontend/src/lib/server/private-fleet-payroll.ts`

### Estado nuevo

La nomina privada usa `payment_mode = external_proof` por defecto:

- no suma monto a `wallet.available_balance`,
- no crea transaction `private_fleet_salary` para el modo externo,
- exige comprobante externo,
- avanza `pending_external_pay -> proof_uploaded -> paid_external`.

El modo `mercadopago_funded` queda solo como compatibilidad legacy o modo explicito controlado por flag.

### Regla vigente

Agregar `payment_mode`:

- `external_proof` = no tocar wallet, requiere comprobante.
- `mercadopago_funded` = usa Mercado Pago y puede liberar a wallet.

Default para flota privada ahora: `external_proof`.
