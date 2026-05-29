---
name: kargax-release-qa
description: Use before release, merge, or after code changes to define and run KargaX QA gates.
---

# KargaX Release QA Skill

## Root checks

```bash
npm run repo:audit
npm run check:roles
npm run security:audit
npm run check
npm run check:release
```

## Frontend checks

```bash
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run test:algorithms
npm --prefix frontend run visual:qa
npm --prefix frontend run smoke:release
```

## Manual QA map

- Login/logout.
- Dashboard.
- Planes/checkout/reconcile.
- Paywall events.
- Bodegas/viajes/POD.
- Wallet read-only/ledger flows if touched.
- `/dashboard/control-margen` if Last-Mile touched.
- Mobile responsive.

## Output

- Commands run.
- Pass/fail.
- Manual routes tested.
- Blockers.
- Release decision.
