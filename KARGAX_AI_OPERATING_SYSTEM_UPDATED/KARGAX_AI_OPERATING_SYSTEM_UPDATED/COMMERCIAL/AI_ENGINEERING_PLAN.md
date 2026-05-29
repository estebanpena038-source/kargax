# AI Engineering Plan para KargaX — ACTUALIZADO

## Decisión CEO

KargaX debe usar ChatGPT Pro/Codex como sistema operativo de construcción, QA y crecimiento. No como chat suelto.

Estrategia:

1. `AGENTS.md` como reglas permanentes.
2. `.agents/skills/*/SKILL.md` para workflows repetibles.
3. `GPT.md` para Custom GPT CTO/Growth.
4. `AI_PROMPTS.md` para prompts fuertes.
5. `docs/ai/KARGAX_ARCHITECTURE_MAP.md` como mapa vivo del repo.
6. Ciclo diario: issue → plan → diff → pruebas → release → aprendizaje → actualizar instrucciones.

## Cambios recientes que la IA debe conocer

- LAST-MILLA / Control de Margen ya es módulo central Enterprise.
- La UI vive en `/dashboard/control-margen`.
- El cliente/tipos viven en `frontend/src/lib/last-mile/*`.
- Los componentes viven en `frontend/src/components/last-mile/*`.
- Los límites Last-Mile son `last_mile_contract_limit` y `last_mile_alert_limit`.
- El flujo de planes maneja `Acceso Operativo`, estados de infraestructura y reconciliación de pago.
- QA ahora incluye visual QA, smoke release, algoritmos P0 y debug de payment.
- El repo tiene guardia de roles y auditoría de secretos.

## Rutina semanal

### Lunes — Producto/revenue

- Elegir 1 feature con impacto en activación, retención o Enterprise.
- Pedir arquitectura antes de código.
- Convertir en issue técnico con riesgos.

### Martes/Miércoles — Implementación

- Codex implementa en diffs pequeños.
- No tocar billing/RLS/wallet/Last-Mile sin test plan.
- Revisar rutas sensibles antes de merge.

### Jueves — QA/release

- `npm run check:release`.
- `npm --prefix frontend run visual:qa` si toca UI.
- `npm --prefix frontend run smoke:release`.
- QA manual de planes, checkout, paywall y control de margen si aplica.

### Viernes — Comercial/aprendizaje

- Usar lo construido en demos.
- Registrar objeciones.
- Actualizar `COMMERCIAL/`, `LAST-MILLA/`, `AGENTS.md` y skills.

## Prompts buenos

```text
Audita Control de Margen. No toques wallet ni pagos. Lee LAST-MILLA, frontend/src/lib/last-mile y frontend/src/app/api/last-mile. Dame riesgos, plan y checks.
```

```text
Arregla un bug de plan limits. Lee frontend/src/lib/billing/plan-limits.ts, frontend/src/app/planes/page.tsx y /api/billing/paywall-events. No cambies Mercado Pago. Entrega diff y pruebas.
```

```text
Revisa esta PR como CTO. Bloquea si rompe role-policy, RLS, checkout, wallet, Last-Mile o release QA.
```

## KPIs de uso IA

- Features entregadas sin romper release.
- Bugs evitados por review.
- Cambios con test plan.
- Tiempo issue → release.
- Demos comerciales habilitadas.
- Prompts convertidos en reglas permanentes.
- Errores repetidos corregidos en AGENTS/skills.
