---
name: kargax-architecture-audit
description: Use when auditing KargaX architecture, repo structure, data flow, module boundaries, or technical risk before implementing a feature.
---

# KargaX Architecture Audit Skill

## Goal

Audit KargaX before implementation so changes do not break billing, logistics workflows, Supabase, RLS, wallet, marketplace, or customer-facing UX.

## Trigger examples

Use this skill when the user asks:

- "revisa arquitectura"
- "antes de programar dime que tocar"
- "audita esta feature"
- "que archivos hay que editar"
- "esto rompe algo?"

## Workflow

1. Identify the feature/problem in one sentence.
2. Map affected domain:
   - auth/roles
   - business/company/team
   - warehouses/inventory
   - trips/shipments
   - private fleet/drivers
   - POD/evidence/PIN/signature/photo
   - billing/plans/limits
   - wallet/liquidations
   - marketplace/commissions
   - reports/exports
3. List files to inspect first. Prefer concrete paths.
4. Identify database impact. If schema or seed changes are needed, require a new migration under `supabase/migrations/`.
5. Identify product risk:
   - revenue risk
   - retention risk
   - security/RLS risk
   - operational UX risk
   - data integrity risk
6. Recommend MVP scope and non-goals.
7. Define acceptance criteria and test plan.

## Output format

```markdown
## Diagnostico

## Modulos afectados

## Archivos a revisar primero

## Riesgos

## MVP recomendado

## Migraciones necesarias

## Acceptance criteria

## Test plan

## Decision CTO
```

## KargaX known truths

- App principal: `frontend/`.
- DB truth: `supabase/migrations/`.
- Comercial: `COMMERCIAL/`.
- Product core: cierre logistico con evidencia, flota privada, bodega, marketplace, wallet y billing.
