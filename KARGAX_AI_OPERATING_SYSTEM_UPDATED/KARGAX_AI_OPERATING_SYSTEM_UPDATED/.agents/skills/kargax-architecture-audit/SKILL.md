---
name: kargax-architecture-audit
description: Use when auditing KargaX architecture, repo structure, data flow, module boundaries, or technical risk before implementing a feature.
---

# KargaX Architecture Audit Skill

## Goal

Audit KargaX before implementation so changes do not break billing, logistics workflows, Supabase, RLS, wallet, marketplace, Last-Mile, role-policy, or UX.

## Workflow

1. Define feature/problem in one sentence.
2. Map affected domain: auth, roles, bodegas, viajes, POD, flota, marketplace, billing, wallet, reports, Last-Mile, QA.
3. List concrete files to inspect first.
4. Identify DB impact and migration need.
5. Identify risks: revenue, retention, security/RLS, role-policy, operational UX, data integrity, wallet/pagos, Last-Mile.
6. Recommend MVP and non-goals.
7. Define acceptance criteria and test plan.
8. Decide: implement now, split, block, or ask for migration/QA first.

## Output

```markdown
## Diagnóstico
## Módulos afectados
## Archivos a revisar primero
## Riesgos
## MVP recomendado
## Migraciones necesarias
## Acceptance criteria
## Test plan
## Decisión CTO
```
