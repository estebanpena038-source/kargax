# Estado go-live KargaX - 2026-06-04

## Decision CTO

KargaX no esta listo para produccion publica abierta todavia.

El codigo local ya cerro varios P0 del paquete de produccion, pero quedan No-Go externos de dominio, TLS, Supabase Auth y variables productivas. Este archivo deja evidencia operativa para repetir la verificacion sin depender del historial del chat.

## Implementado en repo

- Documentacion copiada desde `Produccion_KargaX/Produccion/*.md` hacia `Produccion/`.
- Wallet `/billetera` cambiada de visual tipo tarjeta a panel de saldo operativo KargaX.
- Webhook MercadoPago con firma invalida ahora responde `401` antes de consultar MercadoPago.
- Jobs internos sensibles usan helper server-side con comparacion segura de `INTERNAL_API_KEY`.
- Logs de notificaciones reducen exposicion de telefono/datos sensibles.
- CORS en produccion estricta ya no permite localhost por defecto.
- CSP mantiene politica actual y soporta `Content-Security-Policy-Report-Only`.
- `check-role-policy.mjs` cubre mas raices sensibles y alerta gates manuales heredados.
- `smoke-suite.mjs` acepta `--base-url`, como pide el runbook.
- `release-check.mjs` falla si produccion no usa el canonical `https://kargax.com`.
- `supabase-auth-url-check.mjs` acepta `--base-url` para validar auth redirects contra el dominio real.

## Evidencia local que paso

Comandos ejecutados con resultado correcto:

```bash
npm run repo:audit
npm run check:roles
npm run security:audit
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run visual:qa
npm --prefix frontend run visual:qa:browser
npm run supabase:inspect -- --json
```

Notas:

- `check:roles` pasa con advertencias de gates manuales heredados.
- `lint` pasa sin errores, con warnings existentes.
- `visual:qa:browser` paso contra servidor local y dejo evidencia en `qa/visual-release-gate/latest.json`.
- Validacion local P0:
  - `POST /api/jobs/payouts/process` sin secret devuelve `401`.
  - `POST /api/payments/webhook` sin firma devuelve `401`.
  - `GET /api/health` local devuelve `200`.

## No-Go actuales

### 1. Produccion canonical sigue apuntando a staging

Comando:

```bash
npm --prefix frontend run check:release
```

Resultado esperado mientras no se corrija Vercel/env:

```json
{
  "gate": "public-url-production",
  "status": "fail",
  "evidence": {
    "appUrl": "https://kargax-staging.vercel.app",
    "canonicalAppUrl": "https://kargax.com",
    "reason": "Production canonical domain mismatch"
  }
}
```

Accion requerida fuera del repo:

- En Vercel Production configurar `NEXT_PUBLIC_APP_URL=https://kargax.com`.
- Configurar URLs publicas de pago contra `https://kargax.com`.
- Re-desplegar produccion.

### 2. `https://kargax.com` falla smoke por TLS/DNS

Comando:

```bash
npm --prefix frontend run smoke:release -- --base-url https://kargax.com
```

Resultado actual:

- `health`: `fetch failed`
- `market-context`: `fetch failed`
- `onboarding-status`: `fetch failed`

Diagnostico observado:

- `kargax.com` resuelve a `185.27.134.215`.
- HTTPS falla por cadena TLS no confiable.

Accion requerida fuera del repo:

- Apuntar DNS a Vercel.
- Emitir certificado valido.
- Verificar redirects `http -> https` y `www -> apex`.

### 3. Supabase Auth genera redirects a localhost

Comando:

```bash
npm run supabase:auth-url-check -- --base-url https://kargax.com
```

Resultado actual:

- Se solicita `https://kargax.com/auth/callback`, `invite/accept` y `reset-password`.
- Supabase genera `http://localhost:3000`.

Accion requerida fuera del repo:

- Supabase Auth > URL Configuration:
  - Site URL: `https://kargax.com`
  - Redirect URLs:
    - `https://kargax.com/auth/callback`
    - `https://kargax.com/auth/invite/accept`
    - `https://kargax.com/auth/reset-password`
    - `https://www.kargax.com/auth/callback`
    - `https://www.kargax.com/auth/invite/accept`
    - `https://www.kargax.com/auth/reset-password`
- Mantener localhost solo para desarrollo.

## Comando de revalidacion go-live

Ejecutar cuando DNS, Vercel y Supabase Auth esten corregidos:

```bash
npm run repo:audit
npm run check:roles
npm run security:audit
npm run check:release
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run visual:qa
npm --prefix frontend run visual:qa:browser
npm run supabase:inspect -- --json
npm run supabase:auth-url-check -- --base-url https://kargax.com
npm --prefix frontend run smoke:release -- --base-url https://kargax.com
```

## Siguiente decision

No hacer go-live publico hasta que estos tres comandos pasen:

```bash
npm --prefix frontend run check:release
npm run supabase:auth-url-check -- --base-url https://kargax.com
npm --prefix frontend run smoke:release -- --base-url https://kargax.com
```
