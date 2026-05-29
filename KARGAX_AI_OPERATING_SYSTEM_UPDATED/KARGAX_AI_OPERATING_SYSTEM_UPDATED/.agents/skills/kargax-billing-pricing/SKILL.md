---
name: kargax-billing-pricing
description: Use when changing KargaX pricing, plans, limits, paywall, Mercado Pago, checkout, or subscription UX.
---

# KargaX Billing & Pricing Skill

## Critical files

- `frontend/src/app/planes/page.tsx`
- `frontend/src/lib/billing/pricing.ts`
- `frontend/src/lib/billing/plan-limits.ts`
- `frontend/src/app/api/billing/**`
- `frontend/src/app/api/billing/paywall-events/route.ts`
- `COMMERCIAL/**`
- `LAST-MILLA/**` when Enterprise/Control de Margen is involved
- `supabase/migrations/**`

## Workflow

1. Identify plan affected: Free, Growth, Scale, Enterprise, Enterprise Margin OS.
2. Identify limit key: warehouse/team/monthly_trip/private_fleet/last_mile_contract/last_mile_alert.
3. Update copy, plan data, UI, API and DB consistently.
4. Ensure `recordPlanLimitEvent` remains non-blocking.
5. Do not break Mercado Pago checkout/reconcile.
6. Run release checks.

## Blockers

- “Unlimited” without abuse control.
- Editing old migrations.
- Checkout changed without manual QA.
- Recommended plan missing for new limit feature.
- Last-Mile pricing touching wallet/payouts.
