# CERRADO - SPRINT 26

# 26 - Startup Infra Hardening

## Estado

- artifact status: `completed`
- cerrado el: `2026-05-19`
- prioridad: alta antes de pilotos publicos
- owner: CTO / Founding Engineer

## Implementacion cerrada 2026-05-19

- Se agrego `release_gate_checks` en `supabase/migrations/044_retention_infra_pricing.sql`.
- Se agrego flag `release_gate_required=true`.
- `frontend/scripts/release-check.mjs` valida envs criticas, URL publica, proxy/rate limit, health route, migraciones clave y typecheck.
- `frontend/scripts/smoke-suite.mjs` valida endpoints publicos contra `SMOKE_BASE_URL` o `NEXT_PUBLIC_APP_URL`.
- `proxy.ts` ahora expone headers de rate limit y registra fallback in-memory en produccion si Upstash no esta disponible.
- `/api/health` reporta infra: release gate, Sentry, Upstash, webhook Mercado Pago y payouts automaticos.
- Decision Clerk queda documentada: no migrar antes de piloto.
- Typecheck frontend ejecutado y limpio.

## Proposito

Completar la infraestructura de startup moderna sin sobreconstruir. KargaX necesita monitoreo, rate limiting, DNS seguro, secretos, backups, healthchecks y release gate real.

## Fuentes oficiales

- Sentry Next.js: `https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/`
- Upstash Rate Limit: `https://upstash.com/docs/oss/sdks/ts/ratelimit/overview`
- Clerk Next.js: `https://clerk.com/docs/nextjs/getting-started/quickstart`
- Cloudflare proxied DNS: `https://developers.cloudflare.com/dns/manage-dns-records/reference/proxied-dns-records/`

## Decision Clerk

No migrar a Clerk en piloto.

Motivo:

- Supabase Auth ya esta integrado con RLS.
- Ya existe session bridge.
- Ya hay MFA.
- Ya existen invitaciones.
- Migrar auth antes de piloto aumenta riesgo.

Accion:

- Documentar Clerk como evaluacion post-piloto.
- Solo reconsiderar si Supabase Auth bloquea ventas o seguridad.

## Sentry

Estado actual observado:

- `.env.example` tiene `NEXT_PUBLIC_SENTRY_DSN`.
- No se observa dependencia `@sentry/nextjs` en `frontend/package.json`.

Trabajo:

- Instalar `@sentry/nextjs`.
- Crear config de Sentry para Next.js.
- Capturar errores server/client.
- Enmascarar PII.
- Configurar environment: local, preview, staging, production.
- Crear prueba intencional controlada en staging.

## Upstash y rate limiting

Estado actual observado:

- `frontend/src/proxy.ts` ya implementa rate limiting con Upstash REST opcional y fallback in-memory.

Trabajo:

- Decidir si mantener REST propio o migrar a SDK `@upstash/ratelimit`.
- Mantener familias: auth, webhook, admin replay, onboarding, read, mutation.
- Agregar metricas de bloqueos.
- Probar `429`.
- No depender de in-memory en produccion.

## Cloudflare DNS

Trabajo externo:

- Apuntar dominio publico.
- Proxied para app web si aplica.
- DNS-only para verificaciones que no deben pasar por proxy.
- SSL/TLS full.
- WAF basico.
- Regla para bloquear paises o bots si se justifica.
- Proteger origen si no es Vercel-only.

## Secrets

Rotar o validar:

- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `INTERNAL_API_KEY`
- `TWILIO_AUTH_TOKEN`
- `POSTHOG_API_KEY`
- `UPSTASH_REDIS_REST_TOKEN`
- `QSTASH_TOKEN`
- futuros secrets Wompi/Nequi

## Healthchecks

`/api/health` debe reportar:

- Supabase reachable.
- DB query basica.
- Auth config.
- Storage buckets criticos.
- Mercado Pago webhook secret.
- Upstash.
- Sentry.
- Payout providers por ambiente.
- Feature flags.

## Backups y DR

- Confirmar backups Supabase.
- Backup de storage critico.
- Runbook de restore.
- Rehearsal minimo antes de produccion.
- Registro de ultimo backup validado.

## Release gate

No lanzar si:

- Build falla.
- Typecheck falla.
- Health falla.
- Auth links van a localhost.
- Storage `offer-photos` falla.
- Webhook pagos no esta firmado.
- Rate limiting no funciona en auth.
- Sentry no recibe evento.
- Smoke suite sin evidencia.

## QA

- Error controlado llega a Sentry.
- Auth brute force devuelve 429.
- Webhook no se rompe por rate limit normal.
- Cloudflare no rompe callbacks.
- Health muestra integraciones reales.
- Secrets no aparecen en logs.

## Definition of Done

- Infra minima lista para pilotos externos.
- El equipo sabe diagnosticar caidas.
- Todo fallo critico tiene owner y runbook.
- No se requiere adivinar variables de entorno.
