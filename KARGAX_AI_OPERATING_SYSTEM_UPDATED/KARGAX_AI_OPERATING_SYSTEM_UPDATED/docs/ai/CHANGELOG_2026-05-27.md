# CHANGELOG_2026-05-27 — KargaX AI Operating System

## Detectado

El paquete AI original estaba actualizado a la arquitectura base de KargaX, pero el repo actual ya contiene cambios posteriores o más específicos:

- `frontend/package.json` incluye scripts nuevos: `test:algorithms`, `visual:qa`, `visual:qa:browser`, `smoke:release`, `debug:payment`.
- `plan-limits.ts` incluye `last_mile_contract_limit` y `last_mile_alert_limit`.
- `/planes` maneja Acceso Operativo, reconcile de pago y estados de checkout/infraestructura.
- LAST-MILLA define Control de Margen como Enterprise analítico-operativo.
- `/dashboard/control-margen` ya apunta a `LastMileDashboard`.
- `frontend/src/components/last-mile/LastMileDashboard.tsx` existe y fue modificado después del paquete AI original.
- `frontend/src/lib/last-mile/client.ts` define cliente para dashboard, contracts, recompute, alerts y renegotiations.
- `frontend/src/lib/last-mile/types.ts` define access, carriers, lanes, contracts, snapshots, scorecards y recommendations.
- Root scripts incluyen `check:roles`, `security:audit`, `supabase:inspect`, `supabase:auth-url-check`.

## Acción aplicada

- Se actualizó `AGENTS.md` con Last-Mile, QA, roles y seguridad.
- Se actualizó `GPT.md` para Custom GPT.
- Se actualizó `AI_PROMPTS.md` con prompts específicos de Last-Mile y QA.
- Se expandió `.codex/config.example.toml` con rutas y comandos nuevos.
- Se agregaron `frontend/AGENTS.md` y `supabase/AGENTS.md` faltantes.
- Se agregaron skills nuevos para Last-Mile, security/role-policy y migraciones Supabase.
- Se actualizó mapa de arquitectura.

## Riesgos que quedan vivos

- Confirmar que todas las rutas `/api/last-mile/**` usan auth + business scope + role-policy.
- Confirmar que la migración final de `last_mile_*` está en `supabase/migrations/` y no solo en draft.
- Confirmar que `paywall-events` reconoce features Last-Mile si se quiere recommendedPlan específico.
- Ejecutar `visual:qa` y `smoke:release` después de copiar el paquete.
