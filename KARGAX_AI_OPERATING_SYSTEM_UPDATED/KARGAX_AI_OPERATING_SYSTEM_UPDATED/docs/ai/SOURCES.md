# SOURCES.md — Evidencia revisada para actualizar el AI Operating System

Fecha de actualización del paquete: 2026-05-29.

## Fuentes del repo usadas como base

- `README.md`: estructura oficial, fuente de verdad, comandos principales y reglas de release.
- `KARGAX_AI_OPERATING_SYSTEM/README.md`: paquete AI original y estructura esperada.
- `AGENTS.md`: reglas permanentes actuales del repo.
- `KARGAX_AI_OPERATING_SYSTEM/GPT.md`: Custom GPT original.
- `KARGAX_AI_OPERATING_SYSTEM/AI_PROMPTS.md`: prompts originales.
- `KARGAX_AI_OPERATING_SYSTEM/.codex/config.example.toml`: config original Codex.
- `KARGAX_AI_OPERATING_SYSTEM/docs/ai/KARGAX_ARCHITECTURE_MAP.md`: mapa original.
- `package.json`: scripts root actuales.
- `frontend/package.json`: scripts/deps actuales, incluyendo QA nuevo.
- `scripts/repo-audit.mjs`: auditoría root.
- `scripts/check-role-policy.mjs`: guardia de roles.
- `scripts/security-audit.mjs`: auditoría de secretos.
- `frontend/src/lib/billing/pricing.ts`: comisiones/currency.
- `frontend/src/lib/billing/plan-limits.ts`: límites, copy y paywall telemetry.
- `frontend/src/app/planes/page.tsx`: planes, Acceso Operativo y checkout UX.
- `frontend/src/app/api/billing/paywall-events/route.ts`: paywall events.
- `LAST-MILLA/README.md`: Control de Margen y reglas de no mover dinero.
- `frontend/src/app/dashboard/control-margen/page.tsx`: entrypoint Last-Mile.
- `frontend/src/components/last-mile/LastMileDashboard.tsx`: dashboard activo.
- `frontend/src/lib/last-mile/client.ts`: cliente API Last-Mile.
- `frontend/src/lib/last-mile/types.ts`: modelo frontend Last-Mile.

## Cambios incorporados

- Last-Mile/Control de Margen pasó de idea/documentación a superficie real de producto.
- QA/release se volvió más fuerte con visual QA, smoke release, algorithms P0 y debug payment.
- Billing agregó límites y telemetría para last-mile contract/alert limits.
- Se añadieron reglas para role-policy y security-audit.
- Se creó un skill específico para Last-Mile y otro para roles/seguridad.
