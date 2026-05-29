# KargaX AI Operating System â€” ACTUALIZADO 2026-05-29

Paquete drop-in actualizado para que ChatGPT Pro, Codex y agentes trabajen con el estado real de `estebanpena038-source/kargax` despuÃ©s de los Ãºltimos cambios de producto, QA, pricing, Last-Mile y seguridad.

> Nombre correcto detectado en el repo: `KARGAX_AI_OPERATING_SYSTEM`.
> El usuario lo escribiÃ³ como `KARGAX_IA_OPERATING_SYSTEM`, pero la carpeta real usa `AI`.

## QuÃ© actualiza esta versiÃ³n

Esta versiÃ³n ya no solo entiende el KargaX base de bodegas/flota/POD/wallet/billing. Ahora tambiÃ©n incorpora:

1. **Control de Margen / LAST-MILLA** como mÃ³dulo Enterprise analÃ­tico-operativo.
2. **LÃ­mites nuevos de plan**: `last_mile_contract_limit` y `last_mile_alert_limit`.
3. **Acceso Operativo** como estado de activaciÃ³n/piloto comercial, sin perder datos cuando expira.
4. **Paywall telemetry** con `/api/billing/paywall-events`.
5. **QA release moderno**: `visual:qa`, `visual:qa:browser`, `smoke:release`, `test:algorithms`, `debug:payment`.
6. **Guardia de roles** con `scripts/check-role-policy.mjs` para evitar drift manual en rutas sensibles.
7. **Security audit** para secretos de Mercado Pago, Supabase rol de servicio, `clave interna de API` y webhook secret.
8. **Arquitectura Last-Mile implementada** en `frontend/src/lib/last-mile`, `frontend/src/components/last-mile` y `/dashboard/control-margen`.
9. **Reglas fuertes de no tocar wallet/pagos** desde LAST-MILLA: el mÃ³dulo lee operaciÃ³n y escribe `last_mile_*`, no mueve dinero.

## Estructura actualizada del paquete

```text
KARGAX_AI_OPERATING_SYSTEM/
â”œâ”€ README.md
â”œâ”€ AGENTS.md
â”œâ”€ GPT.md
â”œâ”€ AI_PROMPTS.md
â”œâ”€ INSTALL_OR_UPDATE.md
â”œâ”€ .codex/
â”‚  â””â”€ config.example.toml
â”œâ”€ .agents/
â”‚  â””â”€ skills/
â”‚     â”œâ”€ kargax-architecture-audit/SKILL.md
â”‚     â”œâ”€ kargax-feature-builder/SKILL.md
â”‚     â”œâ”€ kargax-billing-pricing/SKILL.md
â”‚     â”œâ”€ kargax-release-qa/SKILL.md
â”‚     â”œâ”€ kargax-debugger/SKILL.md
â”‚     â”œâ”€ kargax-commercial-growth/SKILL.md
â”‚     â”œâ”€ kargax-last-mile-margin-control/SKILL.md
â”‚     â”œâ”€ kargax-security-role-policy/SKILL.md
â”‚     â””â”€ kargax-supabase-migration-guardian/SKILL.md
â”œâ”€ frontend/
â”‚  â””â”€ AGENTS.md
â”œâ”€ supabase/
â”‚  â””â”€ AGENTS.md
â”œâ”€ COMMERCIAL/
â”‚  â””â”€ AI_ENGINEERING_PLAN.md
â””â”€ docs/
   â””â”€ ai/
      â”œâ”€ KARGAX_ARCHITECTURE_MAP.md
      â”œâ”€ HOW_TO_USE_CHATGPT_PRO_FOR_KARGAX.md
      â”œâ”€ WORKFLOW_ISSUE_TO_RELEASE.md
      â”œâ”€ SOURCES.md
      â””â”€ CHANGELOG_2026-05-27.md
```

## CÃ³mo instalar

Desde la raÃ­z de `C:\kargax2`:

```bash
# 1) Copia el contenido de esta carpeta dentro de KARGAX_AI_OPERATING_SYSTEM
# 2) Copia estos archivos al root si quieres activar agentes en todo el repo:
cp KARGAX_AI_OPERATING_SYSTEM/AGENTS.md AGENTS.md
cp KARGAX_AI_OPERATING_SYSTEM/GPT.md GPT.md
cp KARGAX_AI_OPERATING_SYSTEM/AI_PROMPTS.md AI_PROMPTS.md
cp -r KARGAX_AI_OPERATING_SYSTEM/.agents .agents
cp -r KARGAX_AI_OPERATING_SYSTEM/.codex .codex
cp KARGAX_AI_OPERATING_SYSTEM/frontend/AGENTS.md frontend/AGENTS.md
cp KARGAX_AI_OPERATING_SYSTEM/supabase/AGENTS.md supabase/AGENTS.md
mkdir -p docs/ai COMMERCIAL
cp -r KARGAX_AI_OPERATING_SYSTEM/docs/ai/* docs/ai/
cp KARGAX_AI_OPERATING_SYSTEM/COMMERCIAL/AI_ENGINEERING_PLAN.md COMMERCIAL/AI_ENGINEERING_PLAN.md
```

## ValidaciÃ³n mÃ­nima despuÃ©s de copiar

```bash
npm run repo:audit
npm run check:roles
npm run security:audit
npm run check
npm run check:release
npm --prefix frontend run visual:qa
npm --prefix frontend run smoke:release
```

Si tocas Last-Mile/Control de Margen, agrega:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

## Regla de oro

KargaX no es una app genÃ©rica de tracking. Es un sistema operativo logÃ­stico para cerrar entregas con evidencia, controlar operaciÃ³n, monetizar capacidad, reducir fuga de margen y proteger confianza B2B.
