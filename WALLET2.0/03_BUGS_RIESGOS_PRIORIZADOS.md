# 03 — Bugs y riesgos priorizados

## P0 — Nómina privada infla saldo retirable

**Archivo:** `frontend/src/lib/server/private-fleet-payroll.ts`

**Evidencia:** la función `releasePrivateFleetPayrollRun` crea wallet, suma a `available_balance`, crea transaction `private_fleet_salary` y marca item `released_to_wallet`.

**Impacto:** un conductor podría retirar dinero que KargaX no debería custodiar en modo privado externo.

**Fix:** agregar `payment_mode`; default `external_proof`; bloquear cualquier wallet touch si no es `mercadopago_funded`.

**Acceptance:** una liquidación privada externa no cambia `wallet.available_balance` ni crea transaction `private_fleet_salary` retirable.

---

## P0 — Retiro usa `available_balance` sin validar rail elegible

**Archivo:** `frontend/src/app/api/wallet/withdraw/route.ts`

**Evidencia:** el endpoint valida `amount <= refreshedWallet.available_balance`, pero no valida composición por `money_rail`/`payout_eligible`.

**Impacto:** si el balance ya fue contaminado por privado o legacy, el retiro puede salir.

**Fix:** calcular `marketplaceAvailableCop` desde transactions elegibles y bloquear si `amount > marketplaceAvailableCop`.

**Acceptance:** `private_fleet_salary`, `private_fleet_external`, `external_proof_only` o `legacy` no permiten retiro automático.

---

## P0 — Falta worker real de payouts

**Archivo:** falta crear `frontend/src/lib/server/payouts/processor.ts` y `frontend/src/app/api/jobs/payouts/process/route.ts`.

**Evidencia:** `/api/wallet/withdraw` crea `payout_attempts.status='queued'` si flag activo, pero no hay processor confirmado que consuma la cola.

**Impacto:** payouts se quedan en cola o se manejan manualmente sin UX clara.

**Fix:** crear processor con claim atómico, provider abstraction, dry-run, límites y webhook/conciliación.

**Acceptance:** un payout queued pasa a processing y luego paid/failed/manual_review sin duplicarse.

---

## P0 — Release marketplace no está amarrado al cierre de ruta

**Archivo:** debe localizarse handler/RPC exacto de entrega completada.

**Impacto:** si se libera en webhook de pago, se paga antes de entregar. Si no se libera nunca, marketplace no cierra flujo.

**Fix:** crear `releaseMarketplaceFreightForCompletedOffer` y llamarlo desde el punto exacto donde la ruta queda entregada/completada.

**Acceptance:** pago aprobado no crea payout; cierre de entrega sí crea release idempotente.

---

## P1 — UI mezcla salario privado con wallet operativa

**Archivo:** `frontend/src/app/billetera/page.tsx`

**Impacto:** UX confunde deuda/pago externo con dinero retirable.

**Fix:** separar secciones: “Marketplace — saldo retirable” y “Flota privada — liquidaciones externas”. Cambiar copy de `private_fleet_salary`.

**Acceptance:** el conductor ve claramente qué puede retirar y qué solo es comprobante privado.

---

## P1 — Admin fallback insuficiente para payouts

**Archivos:**

- `frontend/src/app/api/admin/withdrawals/route.ts`
- `frontend/src/app/api/admin/withdrawals/[id]/route.ts`

**Impacto:** admin solo approve/reject/cancel withdrawal, pero no gestiona retries ni comprobante manual de payout.

**Fix:** agregar endpoints/acciones sobre `payout_attempts`:

- retry,
- force manual review,
- mark paid manual with proof,
- reconcile status.

---

## P1 — Falta conciliación de provider

**Archivo:** falta `frontend/src/lib/server/payouts/reconcile.ts` y `/api/payouts/webhook/route.ts`.

**Impacto:** provider puede pagar/fallar y KargaX quedar desactualizado.

**Fix:** webhook con firma + `provider_transfer_id` + idempotencia.

---

## P2 — Copy financiero debe ser conservador

**Archivos:** UI wallet y mensajes de retiro.

**Impacto:** hablar como banco o prometer custodia puede crear riesgo regulatorio/percepción errónea.

**Fix:** usar “ledger operativo”, “saldo marketplace retirable”, “liquidación privada externa”, “KargaX no custodia este dinero”.

---

## P2 — Logs/email exponen datos bancarios completos

**Archivo:** `/api/wallet/withdraw/route.ts`, `sendAdminEmailNotification`.

**Impacto:** email/log puede contener cuenta/documento completo.

**Fix:** usar snapshot con last4 para logs y dashboard; datos completos solo en tabla protegida con service role y RLS.

---

## P2 — Backfill legacy sin auditoría

**Riesgo:** marcar todo `private_fleet_salary` como externo o marketplace sin revisión puede alterar reportes.

**Fix:** backfill conservador:

- `trip_deposit`, `trip_settlement` => marketplace.
- `private_fleet_salary` => `private_fleet_external_or_legacy` y no elegible hasta revisión.
- `withdrawal` => wallet_withdrawal.
