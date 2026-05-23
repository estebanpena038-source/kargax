# 91 - Launch Checklist

## Estado

- artifact status: `completed`
- repo integration status: `completed`
- live launch execution status: `tracked inside this document`
- cierre: este archivo queda cerrado como checklist oficial de salida a produccion

## Uso

Checklist operativo de salida a produccion. Todo item debe tener evidencia o responsable claro.

## Pre-launch

| Item | Fuente de verdad | Owner | Estado |
|---|---|---|---|
| `npm run check` verde | repo / CI | CTO / Founding Engineer | passed - ejecutado localmente el `2026-04-23` |
| `npm run lint` con 0 errores y warnings triageados | repo / `lint-report.json` | CTO / Founding Engineer | warning - `0 errors`, `241 warnings` |
| `npm run check:release` verde | repo | CTO / Founding Engineer | passed - ejecutado localmente el `2026-04-23` |
| `npm run smoke:release` ejecutado y evidencia adjunta | `docs/ops/smoke-suite.md` | Head of Ops | blocked - `market_context` paso, `/api/health` devolvio `503`, admin smoke aun sin token |
| env vars auditadas | `.env.example` + entorno real | CTO / Founding Engineer | partial - Vercel tiene envs, pero staging sigue sin conectividad valida a Supabase |
| webhook firmado configurado | provider productivo | Finance Lead | passed - runtime reporta `webhook_signature` configurado |
| bootstrap operativo listo | `supabase/seeds/enterprise_bootstrap_tenant.sql` | Growth Lead | passed - release audit verde |
| runbooks escritos | `docs/runbooks` + `docs/ops` | Support Lead | passed - release audit verde |
| pricing y narrativa comercial alineados | landing, `/planes`, playbooks | CEO / Founder | pending manual - requiere rehearsal en navegador |
| fase final `17-28` priorizada | `SPTRINTS/28_PILOT_QA_AND_DEV_MASTER_PLAN.md` | CTO / Founding Engineer | planned - ejecutar despues de bugs P0 |
| lending pausado visible | `SPTRINTS/21_LENDING_PAUSE_AND_COPY_CLEANUP.md` | Finance Lead | planned - requerido para piloto sin capital |
| payouts automaticos con kill switch | `SPTRINTS/20_WALLET_SETTLEMENTS_AND_AUTOMATIC_PAYOUTS.md` | Finance Lead | planned - no habilitar produccion sin provider certificado |
| WMS dispatch -> trip validado | `SPTRINTS/23_WMS_DISPATCH_TO_TRIP_AUTOMATION.md` | Head of Ops | planned - requerido para piloto WMS/flota |
| CEO control tower operativo | `SPTRINTS/24_CEO_KARGAX_CONTROL_TOWER.md` | CEO / Founder | planned - requerido para operar pilotos |

## Launch day

| Item | Fuente de verdad | Owner | Estado |
|---|---|---|---|
| monitoreo abierto | Sentry, PostHog, `/api/health` | CTO / Founding Engineer | blocked - `/api/health` sigue `503` y marca integraciones en `false` |
| requestIds visibles | `/api/admin/overview`, incidentes, soporte | CTO / Founding Engineer | partial - visibles en `health`; falta validar admin autenticado |
| panel admin operativo | `/admin` | Support Lead | pending browser - requiere login admin en staging |
| contacto de soporte definido | `docs/ops/support-escalation.md` | Support Lead | partial - doc existe; roster humano real sigue pendiente |
| rollback path definido | `docs/ops/release-rollback.md` | CTO / Founding Engineer | partial - doc existe; falta rehearsal |
| feature flags listas | `feature_flags`, `/api/health` | CTO / Founding Engineer | passed - runtime marca flags listas |
| `CO` abierto y `PE/EC` cerrados si faltan partners | `country_registry`, flags | CEO / Founder | partial - politica definida, falta validar runtime sano |
| proveedor payouts monitoreado o apagado | Wompi/Nequi dashboard + feature flags | Finance Lead | planned - mantener `automatic_payouts_enabled=false` hasta sandbox verde |
| Sentry y rate limiting verificados | Sentry, Upstash, `/api/health` | CTO / Founding Engineer | planned - `26_STARTUP_INFRA_HARDENING.md` |

## Snapshot ejecutado - 2026-04-23

| Evidencia | Resultado |
|---|---|
| `npm run check` | passed |
| `npm run lint` | warning - `0 errors`, `241 warnings` |
| `npm run check:release` | passed |
| `npm run smoke:release -- --base-url https://kargax-staging.vercel.app` | blocked - `health` falla |
| `curl.exe -i https://kargax-staging.vercel.app/api/health` | blocked - `requestId 52878ab0-e510-497b-9304-fdd028428ef0`, `UNHEALTHY`, `TypeError: fetch failed` |

## Post-launch - primeros 60 minutos

| Minuto | Revision | Owner |
|---|---|---|
| 0-10 | `/api/health`, incidentes criticos, requestIds | CTO / Founding Engineer |
| 10-20 | pagos, webhook y conciliacion | Finance Lead |
| 20-30 | wallet, withdrawals y settlement | Finance Lead |
| 30-40 | warehouse, approvals y backlog soporte | Head of Ops |
| 40-50 | feedback del primer usuario y calidad comercial del recorrido | CEO / Founder |
| 50-60 | backlog de hardening inmediato | todos |

## No lanzar si

- dinero no esta trazable end-to-end
- auth critica o MFA siguen debiles
- la narrativa comercial promete algo que no corre
- smoke suite critica no tiene evidencia
- el equipo no sabe diagnosticar un fallo
- `/api/health` sigue en `503` o staging no puede hablar con Supabase
- cualquier email/invitacion productiva abre `localhost`
- `offer-photos` no existe o la publicacion de imagen devuelve `Bucket not found`
- lending/adelantos aparecen visibles en piloto sin capital y compliance
- payouts automaticos estan activos sin sandbox, webhook, idempotencia y kill switch
- WMS descuenta stock y crea viaje sin confirmacion explicita
