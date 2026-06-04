# AI_PROMPTS.md — Prompts de alto apalancamiento para KargaX ACTUALIZADO

No uses prompts vacíos tipo “mejora esto”. Usa contexto, objetivo, restricciones, archivos, criterio de éxito y pruebas.

## Prompt maestro para programación

```text
Actúa como founding engineer senior de KargaX.

Objetivo: [feature/bug]

Contexto:
KargaX es un SaaS logístico para bodegas, flota privada, entregas, evidencia POD, marketplace, wallet/liquidaciones, billing, reportes y Control de Margen Last-Mile.

Archivos/rutas que debes revisar primero:
- [ruta 1]
- [ruta 2]
- [ruta 3]

Restricciones:
- No romper billing, Mercado Pago, plan limits, paywall events, role-policy ni RLS.
- No editar migraciones antiguas; crear nueva migración si hay schema/data change.
- Mantener UX en español.
- No inventar tablas/columnas; confirma contra el repo.
- Si toca LAST-MILLA, no tocar wallet/pagos/webhook.

Entrégame:
1. Diagnóstico.
2. Evidencia concreta del repo.
3. Plan de implementación.
4. Archivos a editar.
5. Diff/código.
6. Comandos de prueba.
7. Riesgos.
8. Rollback.
9. Siguiente paso.
```

## Prompt para arquitectura antes de tocar código

```text
Audita esta tarea antes de implementarla:
[TAREA]

Identifica:
- Qué módulos toca.
- Riesgos en billing, Mercado Pago, paywall events, seguridad, role-policy, RLS, wallet, Last-Mile, datos multiempresa y UX.
- Qué archivos debo leer antes.
- Qué migraciones serían necesarias.
- Qué pruebas manuales y automáticas debe pasar.
- MVP mínimo sin sobreconstruir.
No escribas código todavía. Dame decisión técnica y plan.
```

## Prompt para LAST-MILLA / Control de Margen

```text
Actúa como CTO de KargaX y audita Control de Margen.

Objetivo:
[DESCRIBE CAMBIO]

Reglas:
- LAST-MILLA es analítico-operativo y Enterprise.
- Puede leer operación y escribir tablas last_mile_*.
- No puede mover dinero ni tocar wallet, transactions, payout_attempts, Mercado Pago ni webhook de pagos.
- Debe respetar roles, RLS, plan limits y paywall.

Revisa rutas:
- LAST-MILLA/**
- frontend/src/app/dashboard/control-margen/page.tsx
- frontend/src/components/last-mile/**
- frontend/src/lib/last-mile/**
- frontend/src/app/api/last-mile/**
- frontend/src/lib/billing/plan-limits.ts
- supabase/migrations/**

Entrégame: riesgos, plan, diff seguro, pruebas y rollback.
```

## Prompt para QA release

```text
Prepara QA de release para este cambio:
[CAMBIO]

Checks disponibles:
- npm run repo:audit
- npm run check:roles
- npm run security:audit
- npm run check
- npm run check:release
- npm --prefix frontend run visual:qa
- npm --prefix frontend run smoke:release
- npm --prefix frontend run test:algorithms

Dime qué comandos correr, qué rutas probar manualmente, qué estados de error revisar y qué bloquearía el merge.
```

## Prompt para pricing y retención

```text
Actúa como CEO SaaS B2B y arquitecto de monetización.

Quiero cambiar pricing/límites de KargaX para aumentar activación y conversión a pago sin regalar operación.

Situación actual:
[pega precios/límites]

Objetivo:
- Más empresas activadas.
- Más entregas cerradas con evidencia.
- Upgrade natural a Growth/Scale/Enterprise.
- No romper checkout, plan limits, paywall events ni Mercado Pago.

Entrégame:
- Pricing recomendado.
- Límites por plan.
- Copy exacto para UI.
- Migración SQL conceptual.
- Cambios frontend/API.
- Riesgos.
- KPIs.
```

## Prompt para debug serio

```text
Tengo este error:
[ERROR/SCREENSHOT/LOG]

Contexto:
- Ruta:
- Usuario/rol:
- Plan:
- Acción:
- Esperado:
- Real:

Haz debug como senior engineer:
1. Hipótesis ordenadas.
2. Archivos a revisar.
3. Logs/comandos.
4. Fix mínimo.
5. Fix robusto.
6. Pruebas para no romper billing/RLS/Last-Mile/wallet.
```

## Prompt para review de PR

```text
Revisa esta PR como CTO de KargaX.

Prioriza:
1. Seguridad/secretos.
2. RLS/datos multiempresa.
3. Role-policy.
4. Billing/planes/Mercado Pago/paywall events.
5. Wallet/liquidaciones.
6. LAST-MILLA/Control de Margen.
7. UX operativa en español.
8. Performance.
9. Deuda técnica.

Entrega:
- Blockers.
- Comentarios importantes.
- Nitpicks.
- Pruebas faltantes.
- Decisión: merge / changes requested.
```
