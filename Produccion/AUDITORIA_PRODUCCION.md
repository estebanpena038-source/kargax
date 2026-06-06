# AuditorÃ­a de producciÃ³n KargaX

## 1. Estado ejecutivo

KargaX ya tiene varias piezas de producto real:

- App principal en `frontend`.
- Backend/API con Next.js App Router.
- Supabase como base de datos, auth, storage y fuente de verdad SQL.
- MercadoPago para pagos.
- Wallet operativa con retiros, ledger marketplace y separaciÃ³n de flota privada.
- Bodegas/3PL, despacho, tracking, POD, last-mile, private fleet, pricing, reportes y roles empresariales.
- Scripts de auditorÃ­a y release gates.
- Paquete `KARGAX_AI_OPERATING_SYSTEM` para guiar agentes/devs.

**DecisiÃ³n CTO:** KargaX no estÃ¡ en cero; estÃ¡ cerca de una beta privada seria.
**DecisiÃ³n CEO:** no debe abrirse a usuarios reales masivos hasta cerrar P0 de seguridad, dominio, pagos, DB, QA y copy legal/financiera.

## 2. DiagnÃ³stico go/no-go

| Ãrea | Estado | Riesgo | DecisiÃ³n |
|---|---:|---:|---|
| Arquitectura general | Fuerte | Medio | Continuar. |
| Dominio/HTTPS | Pendiente de configuraciÃ³n real | Alto | P0 antes de pÃºblico. |
| Variables de entorno | Ejemplos locales/placeholder | Alto | P0. |
| Supabase prod | Requiere validaciÃ³n remota | Alto | P0. |
| MercadoPago webhooks | Deben firmarse y probarse | Alto | P0. |
| Jobs internos/crons | Rutas pÃºblicas deben auditarse | CrÃ­tico | P0. |
| Wallet/retiros | Buen enfoque de ledger, UI confusa por tarjeta | Alto | P0 visual/compliance. |
| Roles/RLS | Base fuerte, necesita matriz final + drift scan ampliado | Alto | P0/P1. |
| Observabilidad | Sentry/PostHog vacÃ­os en env example | Alto | P0. |
| Release QA | Hay scripts, falta evidencia ejecutada | Alto | P0. |
| Legal/compliance | PÃ¡ginas existen, falta revisiÃ³n final | Alto | P0. |
| AI Operating System | Existe, debe decidirse instalaciÃ³n activa | Medio | P1. |
| Algoritmos/IA | Buen plan determinÃ­stico | Medio | P1/P2. |

## 3. Hallazgos P0 â€” bloquean producciÃ³n pÃºblica

### P0-01 â€” Dominio, HTTPS y canonical URL no estÃ¡n cerrados

**Evidencia revisada:** `README.md`, `frontend/.env.example`, `frontend/src/lib/server/cors.ts`, `frontend/src/lib/server/security-headers.ts`, `scripts/supabase-auth-url-check.mjs`.

El repo exige que `NEXT_PUBLIC_APP_URL` use HTTPS pÃºblico en producciÃ³n, pero el `.env.example` todavÃ­a arranca con localhost. Esto es normal como ejemplo, pero producciÃ³n necesita valores reales.

**Impacto:**

- Supabase Auth puede generar links a localhost o staging.
- MercadoPago puede redirigir a URLs incorrectas.
- CORS puede bloquear o permitir orÃ­genes que no corresponden.
- Google/navegadores pueden mostrar errores por HTTPS, mixed content o redirects mal configurados.

**AcciÃ³n requerida:** ver `SEGURIDAD_DOMINIO_SSL.md`.

### P0-02 â€” Secrets y variables reales deben configurarse fuera del repo

Variables crÃ­ticas que producciÃ³n debe tener configuradas en Vercel/Supabase/servicios, nunca en Markdown ni commits:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `INTERNAL_API_KEY`
- `KARGAX_CEO_EMAILS`
- `KARGAX_CEO_USER_IDS`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `QSTASH_TOKEN`, si se usa QStash
- `NEXT_PUBLIC_SENTRY_DSN`, `POSTHOG_*`, si se activan observabilidad/analytics
- `TWILIO_*`, si notificaciones dejan de ser `console`

**AcciÃ³n requerida:** crear matriz de env prod/staging, rotar cualquier secreto expuesto en chats/screenshots/docs y correr `npm run security:audit`.

### P0-03 â€” Rutas pÃºblicas de jobs internos deben auditarse antes de producciÃ³n

En el proxy aparecen rutas pÃºblicas como `/api/jobs/payouts/process`. Eso no necesariamente es una vulnerabilidad si la ruta internamente exige `INTERNAL_API_KEY`, firma, cron secret o validaciÃ³n fuerte. Pero si no lo exige, serÃ­a crÃ­tico.

**AcciÃ³n requerida:**

- Abrir cada ruta pÃºblica sensible.
- Confirmar autenticaciÃ³n server-to-server.
- Rechazar requests sin `X-Internal-Api-Key` o firma equivalente.
- Agregar tests de 401/403.
- No depender solo de â€œruta ocultaâ€.

Rutas a revisar con lupa:

- `/api/jobs/payouts/process`
- `/api/payments/webhook`
- `/api/ops/events`
- `/api/notifications/send-pin`
- `/api/notifications/inspection`
- `/api/support/requests`
- cualquier cron en `vercel.json`

### P0-04 â€” Rate limiting en producciÃ³n debe ser distribuido

El proxy tiene lÃ­mites por familia de ruta, pero si Upstash no estÃ¡ configurado usa fallback en memoria. En serverless, memoria no es confiable entre instancias.

**Impacto:** abuso de login, soporte, mutaciones, webhooks o APIs.

**AcciÃ³n requerida:** configurar Upstash/Vercel KV o proveedor equivalente, y alertar si el proxy cae a fallback en producciÃ³n.

### P0-05 â€” CSP permite `unsafe-inline` y `unsafe-eval`

La CSP actual permite integraciones complejas como MercadoPago/Google, pero `unsafe-inline` y `unsafe-eval` reducen la protecciÃ³n contra XSS.

**DecisiÃ³n recomendada:**

- No romper producciÃ³n de golpe.
- Primero agregar `Content-Security-Policy-Report-Only` en staging.
- Medir violaciones reales.
- Reducir gradualmente `unsafe-eval` y `unsafe-inline` si Next/MercadoPago/Recaptcha lo permiten.

### P0-06 â€” Wallet: quitar tarjeta visual antes del lanzamiento

La billetera ya tiene buena lÃ³gica de ledger operativo y copy de â€œno producto financieroâ€. Sin embargo, la parte superior se ve como tarjeta premium/crÃ©dito: chip, nÃºmero tipo tarjeta, estÃ©tica bancaria y â€œKX Verifiedâ€. Eso contradice el posicionamiento de ledger operativo.

**AcciÃ³n requerida:** reemplazar por panel de saldo operativo. Ver `UI_WALLET_SIN_TARJETA.md`.

### P0-07 â€” Supabase producciÃ³n debe probarse contra schema real

Hay muchas migraciones y el release-check valida formas de tablas, flags y buckets. Pero antes de producciÃ³n se necesita evidencia real contra la base de producciÃ³n o staging final.

**Acciones requeridas:**

- Ejecutar migraciones en staging limpia.
- Validar `000_run_all.sql` o historial de migraciones.
- Verificar orden de migraciones numeradas y timestamped.
- Revisar duplicidad/orden de archivos `036_*`.
- Ejecutar `npm run supabase:inspect -- --json`.
- Ejecutar `npm run check:release` con env de producciÃ³n/staging.
- Verificar RLS por rol.
- Crear buckets y policies de storage.

### P0-08 â€” Supabase Auth URLs deben aceptar producciÃ³n

El repo tiene script especÃ­fico para validar magic links, callback, recovery e invite. Este script debe pasar con `NEXT_PUBLIC_APP_URL` real.

**AcciÃ³n requerida:**

- Supabase Auth > URL Configuration:
  - Site URL: `https://kargax.com` o `https://app.kargax.com` segÃºn decisiÃ³n.
  - Redirect URLs: producciÃ³n, www/app si aplica, staging y localhost solo para dev.
- Ejecutar `npm run supabase:auth-url-check`.

### P0-09 â€” Observabilidad no puede quedar vacÃ­a

Antes de usuarios reales se necesita:

- Error tracking frontend/server.
- Release tags.
- Alertas por API 5xx.
- Alertas por webhook fallido.
- Uptime check de `/api/health`.
- Log de pagos, retiros, callbacks y jobs.
- Procedimiento de rollback.

### P0-10 â€” Evidence QA obligatoria

No basta con tener scripts. Se necesita guardar evidencia:

- `npm run repo:audit`
- `npm run check:roles`
- `npm run security:audit`
- `npm run check`
- `npm run check:release`
- `npm --prefix frontend run visual:qa`
- `npm --prefix frontend run smoke:release -- --base-url <URL_PROD_O_STAGING>`
- pruebas manuales mÃ³viles 320px/375px/768px/desktop
- pruebas reales de auth, pagos, wallet, roles, bodegas, flota privada y soporte

## 4. Hallazgos P1 â€” cerrar antes de beta amplia

### P1-01 â€” ConsolidaciÃ³n Git raÃ­z + repo anidado

El README marca una deuda histÃ³rica de consolidaciÃ³n git raÃ­z + repo anidado. Antes de escalar equipo, evitar confusiÃ³n entre repos, carpetas legacy y fuentes de verdad.

**AcciÃ³n:** documentar estructura final y bloquear cambios fuera de fuente de verdad.

### P1-02 â€” `KARGAX_AI_OPERATING_SYSTEM` existe como paquete drop-in

El paquete de IA estÃ¡ dentro del repo. El README indica copiarlo a raÃ­z para activar AGENTS, skills, GPT y docs/ai.

**Riesgo:** duplicidad entre carpeta paquete y archivos ya copiados a raÃ­z.

**AcciÃ³n:** decidir una de dos:

1. Instalar completamente en raÃ­z y dejar `KARGAX_AI_OPERATING_SYSTEM` como fuente histÃ³rica.
2. Mantenerlo como paquete no activo y documentar que los AGENTS reales viven en raÃ­z.

### P1-03 â€” Check de roles debe cubrir mÃ¡s superficie

`check-role-policy.mjs` revisa rutas sensibles especÃ­ficas. Debe ampliarse a todas las rutas API con impacto financiero, tracking, storage, admin, soporte y jobs.

### P1-04 â€” DocumentaciÃ³n legal/compliance

KargaX maneja pagos, retiros, evidencia, geolocalizaciÃ³n, documentos, flota privada y datos empresariales. Antes de producciÃ³n pÃºblica, revisar:

- TÃ©rminos.
- Privacidad.
- PolÃ­tica de datos sensibles.
- RetenciÃ³n de evidencia.
- Responsabilidad de pagos externos de flota privada.
- Copy de wallet como ledger operativo, no depÃ³sito ni cuenta bancaria.

### P1-05 â€” Algoritmos determinÃ­sticos antes de ML pesado

La carpeta `ALGORITMOS` propone una capa determinÃ­stica primero. Correcto. No meter ML complejo hasta tener datos histÃ³ricos, mÃ©tricas y auditorÃ­a.

## 5. Fortalezas encontradas

- Estructura modular grande y real.
- App principal claramente identificada en `frontend`.
- SQL/migraciones como fuente de verdad.
- Release gates ya pensados.
- Scripts de seguridad y repo audit.
- Supabase Auth URL check dedicado.
- SeparaciÃ³n entre marketplace wallet y pagos privados externos.
- Reglas responsive FE bien definidas.
- Roles empresariales detallados.
- Founder/CEO control tower con allowlist.
- Headers de seguridad ya centralizados.
- CORS controlado por origins.
- `poweredByHeader: false` y TypeScript build strict.

## 6. DecisiÃ³n final

**No-Go para producciÃ³n pÃºblica hoy** si no existe evidencia de cierre P0.

**Go para staging/beta cerrada** si:

- dominio staging seguro,
- secrets reales configurados,
- DB staging migrada,
- pagos en sandbox firmados,
- wallet UI corregida,
- rutas pÃºblicas sensibles auditadas,
- release gates pasan,
- QA visual y smoke pasan,
- monitoreo activo.

**Go producciÃ³n pÃºblica** solo cuando `CHECKLIST_GO_LIVE.md` estÃ© al 100% y haya evidencia guardada.
