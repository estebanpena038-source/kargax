---
name: kargax-last-mile-margin-control
description: Use for LAST-MILLA / Control de Margen work: contracts, carriers, lanes, scorecards, alerts, renegotiations, Enterprise paywall and no-wallet guardrails.
---

# KargaX Last-Mile Margin Control Skill

## Mission

Build/audit Control de Margen as an Enterprise analytical-operational module. It detects leakage and operational risk; it does not move money.

## Read first

- `LAST-MILLA/README.md`
- `LAST-MILLA/**`
- `frontend/src/app/dashboard/control-margen/page.tsx`
- `frontend/src/components/last-mile/**`
- `frontend/src/lib/last-mile/**`
- `frontend/src/app/api/last-mile/**`
- `frontend/src/lib/billing/plan-limits.ts`
- `frontend/src/lib/server/role-policy.ts`
- `supabase/migrations/**`

## Allowed

- Carriers/providers.
- Lanes/routes.
- Contracts/rates.
- Cost snapshots.
- Provider scorecards.
- Alerts.
- Renegotiation workflow.
- Read-only dashboard for Scale if product decision allows.
- Enterprise paywall.

## Forbidden

- `wallets.available_balance`.
- `wallets.pending_balance`.
- `transactions`.
- `payout_attempts`.
- Mercado Pago state.
- `/api/payments/webhook`.
- Automatic money movement.

## Output

```markdown
## Scope Last-Mile
## Files to inspect
## No-wallet verification
## Plan/limit impact
## DB/RLS impact
## Implementation plan
## Test plan
## Rollback
```
