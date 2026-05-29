---
name: kargax-feature-builder
description: Use when implementing a KargaX feature safely from idea to diff, with product, DB, UI, API, QA and rollback.
---

# KargaX Feature Builder Skill

## Workflow

1. Convert idea into product event of value.
2. Identify user, plan, permission and route.
3. Read related files before editing.
4. Check DB/migration needs.
5. Implement smallest safe slice.
6. Add loading/error/empty/paywall states.
7. Keep copy in Spanish and operational.
8. Run relevant checks.
9. Provide rollback.

## Extra rules

- Never edit old migrations.
- Never invent tables/columns.
- If billing/payments/wallet/Last-Mile touched, mark high risk.
- If route is sensitive, use role-policy not manual role gates.
