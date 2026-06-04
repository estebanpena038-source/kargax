# WORKFLOW_ISSUE_TO_RELEASE.md — KargaX

## 1. Issue

Debe incluir:

- Problema.
- Usuario afectado.
- Impacto revenue/retención.
- Alcance MVP.
- Fuera de alcance.
- Archivos probables.
- Migraciones probables.
- API/contracts.
- UI states.
- Edge cases.
- Acceptance criteria.
- Test plan.
- Riesgos.

## 2. Arquitectura

Antes de código:

```bash
# pedir a agente
Audita la tarea. No escribas código. Identifica módulos, riesgos, archivos y plan.
```

## 3. Implementación

- Diffs pequeños.
- No mezclar pricing + DB + UI + wallet en un solo cambio grande.
- Si toca Last-Mile, mantenerlo analítico-operativo.
- Si toca DB, migración nueva.

## 4. QA

Root:

```bash
npm run repo:audit
npm run check:roles
npm run security:audit
npm run check
npm run check:release
```

Frontend:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run visual:qa
npm --prefix frontend run smoke:release
```

## 5. Review

Bloquear si:

- rompe RLS/multiempresa;
- toca wallet desde Last-Mile;
- rompe Mercado Pago/reconcile;
- introduce secreto;
- ignora `role-policy`;
- edita migración vieja;
- no tiene test plan.

## 6. Release

- Resumen de cambios.
- Archivos tocados.
- Comandos corridos.
- Riesgos.
- Rollback.
- Siguiente paso comercial/producto.
