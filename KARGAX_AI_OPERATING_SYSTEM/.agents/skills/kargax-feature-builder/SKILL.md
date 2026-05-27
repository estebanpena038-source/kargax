---
name: kargax-feature-builder
description: Use when implementing a KargaX feature end-to-end across frontend, API, Supabase, billing limits, UX states, and tests.
---

# KargaX Feature Builder Skill

## Goal

Turn a product idea into a safe, minimal, shippable KargaX feature.

## Workflow

1. Restate the user goal and the business outcome.
2. Read project guidance from `AGENTS.md`, `frontend/AGENTS.md`, and `supabase/AGENTS.md`.
3. Identify affected paths.
4. Decide if the feature needs:
   - UI only
   - API route
   - Supabase migration
   - server-side guard
   - billing/plan limit integration
   - event tracking
   - report/export change
5. Implement in small steps.
6. Add empty/loading/error/success states.
7. Add limit/paywall behavior when usage can create cost or operational value.
8. Run checks or provide exact commands.
9. Summarize changes and risks.

## Rules

- Do not invent schema. If schema is missing, propose migration.
- Do not edit old migrations.
- Do not break Spanish UX.
- Do not add dependencies without justification.
- Do not bypass plan limits.
- Keep first version practical: solve current revenue/retention problem, not theoretical future scale.

## Output format

```markdown
## Implementation summary
## Files changed
## Database changes
## UX states
## Billing/limits impact
## Tests run
## Manual QA
## Risks
## Next step
```
