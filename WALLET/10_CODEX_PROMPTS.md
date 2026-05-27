# 10 — Prompts para Codex / dev IA

## Prompt 1 — auditoría antes de tocar código

```text
Lee AGENTS.md, README.md y toda la carpeta /WALLET.

No modifiques código todavía.

Haz una auditoría del flujo wallet/pagos:
1. Identifica todos los archivos que tocan wallets, transactions, payout_attempts, payments, cargo_offers, private_fleet_payroll_runs y private_fleet_payroll_items.
2. Encuentra el punto exacto donde una ruta marketplace queda completada/delivered.
3. Encuentra las RPCs process_successful_payment, create_withdrawal_request y process_withdrawal_request en supabase/migrations.
4. Explica qué parte ya existe y qué falta para payout automático.
5. Entrega un plan de cambios por commit.

Restricciones:
- No guardar secretos.
- No eliminar flujo admin manual.
- No mezclar flota privada con wallet marketplace.
- No permitir payout real en staging.
```

## Prompt 2 — crear migración

```text
Implementa la migración nueva para separar wallet marketplace y liquidaciones privadas.

Usa /WALLET/06_SQL_MIGRATION_DRAFT.md como guía.

Reglas:
- No edites migraciones antiguas.
- Usa IF NOT EXISTS donde sea posible.
- Mantén compatibilidad con datos actuales.
- Agrega índices de idempotencia.
- Agrega RPC claim_payout_attempts, mark_payout_paid y mark_payout_failed.
- No cambies balances históricos sin transacción compensatoria.

Al final corre checks disponibles y explica riesgos.
```

## Prompt 3 — capa de payout providers

```text
Crea la capa server-side de payouts.

Archivos esperados:
- frontend/src/lib/server/payouts/types.ts
- frontend/src/lib/server/payouts/provider.ts
- frontend/src/lib/server/payouts/providers/manual.ts
- frontend/src/lib/server/payouts/providers/cobre.ts
- frontend/src/lib/server/payouts/providers/wompi.ts
- frontend/src/lib/server/payouts/processor.ts
- frontend/src/lib/server/payouts/reconcile.ts

No uses credenciales reales.
Todo debe leer env vars.
El provider manual debe funcionar en staging.
El provider real debe fallar cerrado si faltan env vars.
No loggear account_number completo ni document_number completo.
```

## Prompt 4 — marketplace release

```text
Implementa releaseMarketplaceFreightForCompletedOffer.

Debe:
- Validar pago Mercado Pago local completado.
- Validar oferta/ruta completada.
- Validar no dispute activa si existe tabla/campo.
- Evitar doble liberación.
- Crear transaction marketplace_freight_release/trip_deposit.
- Marcar payout_eligible=true.
- Crear payout_attempt automático si existe payment method default.
- Si no existe método, dejar saldo disponible y pedir cuenta.
- Registrar critical operation.

No pagar desde webhook de Mercado Pago.
Pagar solo cuando ruta queda terminada.
```

## Prompt 5 — flota privada external proof

```text
Implementa el modo external_proof para flota privada.

Objetivo:
La empresa registra liquidación, paga por fuera y sube comprobante.
Eso no debe sumar saldo retirable a wallet.

Tareas:
- Agrega endpoints para comprobante o ajusta endpoints existentes.
- Modifica private-fleet-payroll.ts para que payment_mode='external_proof' no llame getOrCreateWallet ni actualice available_balance.
- Ajusta /api/wallet para devolver privateFleetLedger.
- Ajusta /billetera para mostrar Liquidaciones privadas separadas de Marketplace.

No eliminar mercadopago_funded: dejarlo como modo futuro detrás de flag.
```

## Prompt 6 — QA

```text
Crea tests para:
1. Marketplace payout dry-run.
2. Doble completion no paga dos veces.
3. Payout failed no marca paid.
4. Private external proof no modifica wallet.available_balance.
5. Payout real no corre si PAYOUT_DRY_RUN=true.

Ejecuta npm run lint, npm run check y npm run build si existen.
```
