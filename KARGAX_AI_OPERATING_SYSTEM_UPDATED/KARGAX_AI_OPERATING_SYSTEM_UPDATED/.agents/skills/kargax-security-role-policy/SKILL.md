---
name: kargax-security-role-policy
description: Use when touching auth, roles, permissions, sensitive API routes, business scope, secrets, or security release gates.
---

# KargaX Security & Role Policy Skill

## Read first

- `scripts/check-role-policy.mjs`
- `scripts/security-audit.mjs`
- `frontend/src/lib/server/role-policy.ts`
- `frontend/src/lib/business-roles.ts`
- sensitive API route touched

## Rules

- Do not add manual `businessAccess.isOwner` gates in sensitive routes.
- Do not compare `teamMember.role` manually in sensitive routes.
- Use centralized role-policy/capabilities.
- Maintain business scope.
- Never expose secrets.

## Checks

```bash
npm run check:roles
npm run security:audit
npm run check:release
```

## Output

- Sensitive route touched.
- Role policy method used.
- Secret audit result.
- RLS/business scope risk.
- Decision.
