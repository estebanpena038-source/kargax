---
name: kargax-supabase-migration-guardian
description: Use for database changes, Supabase migrations, RLS, seeds, plan limits, paywall tables, or last_mile_* schema work.
---

# KargaX Supabase Migration Guardian Skill

## Rules

- Never edit old migrations.
- New migration only.
- Idempotent where possible.
- RLS/business_id first.
- No secrets.
- If Last-Mile: write `last_mile_*` only; do not touch wallet/payments.
- If pricing/limits: align DB + UI + COMMERCIAL + docs.

## Checklist

1. Table/column exists? Confirm.
2. Migration name.
3. RLS policy.
4. Indexes.
5. Seed/feature matrix.
6. Backfill safety.
7. Rollback conceptual.
8. Test query.

## Checks

```bash
npm run supabase:inspect
npm run security:audit
npm run check:release
```
