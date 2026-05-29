---
name: kargax-debugger
description: Use for debugging KargaX errors with ranked hypotheses, files, logs, minimal fix, robust fix, and regression checks.
---

# KargaX Debugger Skill

## Workflow

1. Capture route, user role, plan, action, expected, actual.
2. Rank hypotheses by probability.
3. List files/logs to inspect.
4. Check whether issue touches auth, RLS, billing, wallet, Last-Mile, API envelope or UI state.
5. Propose minimal fix.
6. Propose robust fix.
7. Define regression checks.

## Common checks

- Session/access token.
- Business scope.
- Role-policy.
- Plan limits and paywall events.
- Supabase RLS.
- API envelope parsing.
- Last-Mile 402/403 handling.
- Mercado Pago/reconcile if payment issue.
