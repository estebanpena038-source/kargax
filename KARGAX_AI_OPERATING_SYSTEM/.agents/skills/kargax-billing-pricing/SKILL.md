---
name: kargax-billing-pricing
description: Use when changing KargaX pricing, plans, billing limits, checkout, paywalls, Mercado Pago, free access, or monetization.
---

# KargaX Billing & Pricing Skill

## Goal

Improve monetization without breaking checkout, plan limits, Mercado Pago reconciliation, or customer activation.

## Commercial rule

KargaX should not be sold as a cheap app. It should be sold as operational control and evidence that reduces claims, rework, and manual coordination.

## Recommended public pricing

- Free: $0 COP, 50 viajes/mes, 1 bodega, 2 usuarios, 3 conductores.
- Growth: $299.000 COP/mes, 500 viajes/mes, 3 bodegas, 10 usuarios, 15 conductores.
- Scale: $799.000 COP/mes, 2.000 viajes/mes, 10 bodegas, 30 usuarios, 50 conductores.
- Enterprise: desde $2.500.000 COP/mes, volumen personalizado, multiempresa, API, soporte premium.

Optional founder offer:

- Growth founder: $149.000 COP/mes por 3 meses.
- $80.000 COP/mes solo como excepcion controlada para primeros casos reales, no como precio principal.

## Workflow

1. Inspect current pricing sources:
   - `frontend/src/app/planes/page.tsx`
   - `frontend/src/lib/billing/pricing.ts`
   - `frontend/src/lib/billing/plan-limits.ts`
   - billing API routes
   - `supabase/migrations/`
2. Determine whether prices are hardcoded, loaded from `billing_plans`, or both.
3. Update public UI copy and database seed/migration together.
4. Ensure paywall copy points to recommended plan.
5. Avoid "ilimitado" except Enterprise with contract.
6. Run checkout smoke path if possible.

## Copy rules

Use:

- "Acceso Operativo gratis" for high-limit activation.
- "Volumen personalizado" for Enterprise.
- "Soporte descargable por entrega".
- "Evidencia de receptor, hora, foto/firma y novedad".

Avoid:

- "piloto" when the user wants ready-to-use activation.
- "ilimitado" as public uncontrolled promise.
- Banking/financial promises for wallet.

## Output format

```markdown
## Pricing decision
## Files to change
## Migration plan
## UI copy
## Checkout/paywall impact
## QA checklist
## Risks
```
