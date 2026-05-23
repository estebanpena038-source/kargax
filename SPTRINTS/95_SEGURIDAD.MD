# 95 - Seguridad y Hardening

## Estado

- artifact status: `completed`
- repo integration status: `completed`
- security baseline: `hardened in repo`
- cierre: este archivo queda como evidencia del sprint de seguridad posterior al incidente reportado en Vercel

## Contexto

Se reporto un bloqueo despues de pruebas de seguridad en Vercel y la duda de si se habia ejecutado algun script no identificado. La revision local no puede confirmar actividad remota dentro de Vercel, pero si deja controles en repo para reducir superficie de ataque y detectar regresiones.

## Auditoria local

- `package.json` raiz y `frontend/package.json` no tienen hooks `preinstall`, `install`, `postinstall` ni `prepare`.
- No se encontro un script propio obvio con `curl`, `wget`, `powershell`, `Start-Process`, `child_process` o `eval`.
- La app ya tenia base previa de auth, MFA admin, rate limiting y headers, pero con duplicacion de CSP entre `next.config.ts` y `src/proxy.ts`.
- Se detectaron 7 tablas creadas por migraciones sin `ENABLE ROW LEVEL SECURITY`: `country_registry`, `feature_flags`, `onboarding_checklist_items`, `operation_events`, `platform_incidents`, `provider_adapter_configs`, `support_requests`.
- Staging respondio `200` en `/` y `/api/health` respondio `HEALTHY`; despues del hardening se desplego de nuevo en Vercel y el dominio `https://kargax-staging.vercel.app` quedo aliasado al build nuevo.
- Supabase CLI existe localmente, pero no hay sesion CLI remota (`SUPABASE_ACCESS_TOKEN` ausente), por lo que la migracion queda lista en repo y debe aplicarse con una sesion Supabase autenticada.
- Vercel CLI esta autenticado y el proyecto `frontend` esta vinculado.

## Hardening implementado

- CORS estricto para `/api/*` usando solo `ALLOWED_ORIGINS`.
- Preflight `OPTIONS` centralizado.
- Origins no permitidos reciben `403` antes de auth y handlers.
- Requests sin `Origin` siguen permitidos para same-origin, webhooks y server-to-server.
- Security headers compartidos entre `next.config.ts` y `src/proxy.ts`.
- CSP endurecida con `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` y `form-action 'self'`.
- HSTS se aplica solo en entorno productivo estricto.
- RLS y politicas admin/user ownership agregadas en `036_security_rls_hardening.sql`.
- `security:audit` agregado como gate de repo para scripts sospechosos, secretos, RLS y helpers de seguridad.
- API legacy del frontend removida como dependencia: el cliente ya no usa `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_API_BASE_URL` ni `/api/v1`.
- Timeouts agregados a Supabase browser client, Supabase admin client y session bridge para evitar pantallas en `Cargando...` indefinido cuando red/Supabase/Vercel se queda colgado.

## Configuracion requerida

`ALLOWED_ORIGINS` debe existir en Vercel y local con lista exacta separada por comas.

Ejemplo staging:

```env
ALLOWED_ORIGINS=https://kargax-staging.vercel.app
```

Ejemplo produccion + staging:

```env
ALLOWED_ORIGINS=https://app.kargax.com,https://kargax-staging.vercel.app
```

## Acciones externas recomendadas

- Rotar `SUPABASE_SERVICE_ROLE_KEY` si estuvo expuesta en chats, screenshots, logs o Vercel previews no confiables.
- Rotar `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `INTERNAL_API_KEY`, `TWILIO_AUTH_TOKEN`, `POSTHOG_API_KEY`, `UPSTASH_REDIS_REST_TOKEN` y `QSTASH_TOKEN` si hubo exposicion.
- Revisar Vercel Project Activity, Deploy Logs, Environment Variables y Team Audit Log para confirmar si hubo cambios remotos no autorizados.
- Validar en Supabase que las migraciones esten aplicadas y que las tablas publicas no tengan grants abiertos sin RLS.
- Aplicar `supabase/migrations/036_security_rls_hardening.sql` en el proyecto remoto cuando Supabase CLI este autenticado o desde SQL Editor.

## Criterios de cierre

- `npm run repo:audit` - passed
- `npm --prefix frontend run typecheck` - passed
- `npm --prefix frontend run check:release` - passed
- `npm run security:audit` - passed
- `npm --prefix frontend run build` - passed locally and in Vercel build
- Vercel preview deploy - passed: `https://frontend-k0bymwoya-kargaxs-projects.vercel.app`
- Vercel staging alias - passed: `https://kargax-staging.vercel.app`
- CORS staging validation - passed: allowed origin gets `204`; denied origin gets `403 CORS_ORIGIN_DENIED`
- `/api/health` staging validation - passed: `HEALTHY`
- cambios dejados en git staging
