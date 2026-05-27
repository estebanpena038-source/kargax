# 01 — Auditoría contra repo real

## Archivos leídos y por qué

| Archivo | Motivo |
|---|---|
| `README.md` | Fuente de verdad del repo y regla de wallet como ledger operativo. |
| `package.json` | Comandos raíz para QA/release. |
| `frontend/package.json` | Stack, scripts y dependencias reales. |
| `frontend/src/app/api/payments/webhook/route.ts` | Entrada real de pagos Mercado Pago. |
| `frontend/src/lib/contracts/payments.ts` | Contratos `external_reference` para separar tipos de pago. |
| `frontend/src/lib/server/payments/freight-settlement.ts` | Reconciliación de flete marketplace cuando Mercado Pago aprueba. |
| `frontend/src/lib/server/private-fleet-payroll.ts` | Punto crítico donde nómina privada toca wallet. |
| `frontend/src/app/api/wallet/route.ts` | Payload actual de billetera y mezcla de summary privado. |
| `frontend/src/app/api/wallet/withdraw/route.ts` | Creación de retiros y `payout_attempts`. |
| `frontend/src/app/api/admin/withdrawals/route.ts` | Panel/listado admin de retiros. |
| `frontend/src/app/api/admin/withdrawals/[id]/route.ts` | Aprobación/rechazo/cancelación manual. |
| `frontend/src/app/billetera/page.tsx` | UI actual que mezcla salario, gastos, ruta y saldo operativo. |
| `frontend/src/lib/server/feature-flags.ts` | Flag `automatic_payouts_enabled` existe pero está desactivado por defecto. |
| `frontend/src/lib/server/runtime-env.ts` | Validaciones de producción existentes. |
| `frontend/src/lib/mercadopago/config.ts` | Seguridad del webhook Mercado Pago. |

## Hallazgos confirmados

### 1. El repo ya define wallet como ledger operativo

El `README.md` del repo dice que la billetera debe tratarse como ledger operativo y no como depósito bancario comercializado. Esto confirma que la arquitectura correcta es ledger auditado, no “cuenta bancaria”.

### 2. El webhook Mercado Pago está bien ubicado

`frontend/src/app/api/payments/webhook/route.ts`:

- Valida firma.
- Solo procesa `payment`.
- Llama `paymentApi.get` para consultar el pago real.
- Parsea `external_reference`.
- Separa `billing_plan`, `private_fleet_payroll` y `freight`.

Este archivo no debe pagar directamente al camionero de marketplace. Debe reconciliar pago. La liberación debe ocurrir en cierre de ruta.

### 3. Contratos de pago están bien separados, pero falta payout reference

`frontend/src/lib/contracts/payments.ts` separa:

- `FreightPaymentReference`
- `BillingPlanPaymentReference`
- `PrivateFleetPayrollPaymentReference`

Esto es buen diseño. Para payouts se recomienda agregar `MarketplacePayoutReference` si el proveedor necesita correlación externa.

### 4. Flete marketplace se reconcilia con RPC, no se libera en wallet

`frontend/src/lib/server/payments/freight-settlement.ts` resuelve payment/offer, actualiza pago, ejecuta `process_successful_payment`, sincroniza bodega y envía PINs. Correcto: el pago aprobado asegura la ruta, pero no debería ser payout todavía.

### 5. Bug crítico: nómina privada libera a wallet

`frontend/src/lib/server/private-fleet-payroll.ts` hoy hace esto:

- Carga `private_fleet_payroll_runs`.
- Si Mercado Pago aprueba, marca run como `funded`.
- Carga `private_fleet_payroll_items`.
- Por cada item crea wallet si no existe.
- Suma `amount` a `wallet.available_balance`.
- Crea transaction `private_fleet_salary`.
- Marca item como `released_to_wallet`.

Ese comportamiento es peligroso para el modo privado externo. Debe quedar permitido solo para un modo explícito `mercadopago_funded`, nunca como default.

### 6. `/api/wallet` mezcla rails en payload

`frontend/src/app/api/wallet/route.ts` retorna `wallet`, `transactions`, `settlementTimeline`, `privateFleetSummary`, `privateFleetAllocations` y `privateFleetPayrollItems`. El problema es que `privateFleetSummary.salaryReleasedCop` termina mostrado como parte de la experiencia de wallet, no como ledger documental externo.

Debe devolver:

```ts
marketplaceWallet: {
  availableBalanceCop: number;
  pendingReleaseCop: number;
  payoutProcessingCop: number;
  totalPaidCop: number;
}

privateFleetLedger: {
  pendingExternalPayCop: number;
  proofUploadedCop: number;
  paidExternalCop: number;
  items: Array<...>;
}
```

Y mantener campos legacy temporalmente para no romper UI.

### 7. `/api/wallet/withdraw` ya crea `payout_attempts`, pero falta rail validation

El endpoint valida monto, método, AAL2, wallet, guarda método, llama RPC `create_withdrawal_request` y hace upsert en `payout_attempts`. Pero no valida que el monto venga de saldo marketplace elegible. Si `available_balance` fue inflado por `private_fleet_salary`, se puede retirar dinero privado/documental.

Además, aunque `automatic_payouts_enabled` esté activo, responde “pendiente de aprobación administrativa”. La UX no distingue cola automática vs revisión manual.

### 8. Admin withdrawals es fallback, no processor automático

`admin/withdrawals` lista transacciones `withdrawal`. `[id]/route.ts` llama RPC `process_withdrawal_request` con `approve|reject|cancel`. Eso debe mantenerse como fallback manual, pero no es worker de payout.

Faltan acciones:

- `retry_payout`
- `force_manual_review`
- `mark_paid_manual_with_proof`
- `reconcile_provider_status`

### 9. UI `/billetera` mezcla salario privado con saldo operativo

La UI muestra tarjetas como “Pago por ruta”, “Salario mensual”, “Gastos del viaje”, “Operativo liberado”. El copy de `private_fleet_salary` dice que la empresa liberó nómina a la billetera operativa. Para `external_proof`, eso debe cambiar a “Liquidaciones privadas” y no formar parte de saldo retirable.

### 10. Feature flag existe, pero falta sistema real detrás

`automatic_payouts_enabled` existe y está `false` por defecto. El repo todavía necesita:

- provider abstraction,
- processor,
- job interno,
- webhook de payout,
- controles dry-run,
- límites por payout,
- conciliación.

## Conclusión CTO

La base está bien encaminada, pero la mezcla actual se concentra en dos zonas:

1. **`releasePrivateFleetPayrollRun` toca wallet para nómina privada.**
2. **`/api/wallet` y `/billetera` no separan visualmente saldo marketplace retirable vs liquidaciones privadas externas.**

La solución no es borrar la wallet. La solución es endurecer rails, bloquear salida de dinero privado externo y crear release/payout marketplace únicamente después del cierre real de entrega.
