# 10 — Prompt para Codex/dev IA

```text
Actúa como founding engineer senior de KargaX.

Objetivo: implementar WALLET2.0 separando marketplace freelancer de flota privada externa, sin romper pagos Mercado Pago, billing, wallet ni RLS.

Lee antes de tocar código:
- README.md
- AGENTS.md si existe
- frontend/AGENTS.md si existe
- supabase/AGENTS.md si existe
- WALLET2.0/README.md
- WALLET2.0/01_AUDITORIA_REPO_REAL.md
- WALLET2.0/05_MIGRACION_FINAL.sql
- frontend/src/app/api/payments/webhook/route.ts
- frontend/src/lib/contracts/payments.ts
- frontend/src/lib/server/payments/freight-settlement.ts
- frontend/src/lib/server/private-fleet-payroll.ts
- frontend/src/app/api/wallet/route.ts
- frontend/src/app/api/wallet/withdraw/route.ts
- frontend/src/app/billetera/page.tsx
- supabase/migrations/**

Implementa en commits pequeños:

1. Crear migración nueva basada en WALLET2.0/05_MIGRACION_FINAL.sql. No editar migraciones viejas.
2. Modificar private-fleet-payroll.ts para que payment_mode='external_proof' no toque wallet ni cree transaction retirable.
3. Ajustar /api/wallet para retornar marketplaceWallet y privateFleetLedger manteniendo campos legacy.
4. Ajustar /api/wallet/withdraw para validar monto contra transactions marketplace payout_eligible, no solo available_balance.
5. Crear frontend/src/lib/server/payouts/* y job /api/jobs/payouts/process en dry-run/manual.
6. Crear frontend/src/lib/server/wallet/marketplace-release.ts.
7. Localizar handler/RPC exacto donde una ruta queda completada/delivered y llamar releaseMarketplaceFreightForCompletedOffer ahí, no en webhook Mercado Pago.
8. Ajustar UI /billetera para separar Marketplace y Liquidaciones privadas.
9. Agregar tests o checks manuales de WALLET2.0/07_QA_RUNBOOK.md.

Reglas duras:
- No guardar secretos.
- No activar proveedor real en staging.
- No pagar desde webhook Mercado Pago.
- No permitir retiro sobre private_fleet_salary/external_proof/legacy.
- No borrar admin manual fallback.
- No debilitar RLS.
- No cambiar balances históricos sin transacción compensatoria.

Al final entrega:
- archivos modificados,
- diff resumido,
- comandos ejecutados,
- riesgos,
- pasos manuales de QA.
```
