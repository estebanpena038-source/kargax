---
name: kargax-release-qa
description: Use when preparing KargaX for release, running checks, reviewing build/lint/typecheck, smoke testing, or creating a release checklist.
---

# KargaX Release QA Skill

## Goal

Ship KargaX changes without breaking core business flows.

## Release gates

Minimum checks:

```bash
npm run lint
npm run typecheck
npm run build
npm run check
npm run check:release
```

If running from root does not work, try inside `frontend/`.

## Smoke tests

Check:

1. Landing/pricing loads.
2. Login/auth still works.
3. Business/admin can access dashboard.
4. Plans page loads real plans.
5. Free/Growth/Scale/Enterprise appear with correct prices.
6. Limit reached message is clear.
7. Upgrade checkout path works.
8. Downgrade is blocked if usage exceeds target plan.
9. Warehouse/trip creation works.
10. POD/evidence flow still works if touched.
11. Wallet/billing pages do not expose secrets.
12. No console errors in critical route.

## Output format

```markdown
## Release status
PASS / BLOCKED

## Commands run

## Results

## Manual QA

## Blockers

## Non-blocking issues

## Recommended next action
```
