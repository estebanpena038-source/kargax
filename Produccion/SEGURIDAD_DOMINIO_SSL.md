# Seguridad, dominio y SSL para `kargax.com`

## Objetivo

Que `kargax.com` cargue con HTTPS vÃ¡lido, sin advertencias de navegador/Google, sin mixed content, con redirects correctos, CORS controlado, Auth redirects correctos y webhooks apuntando al dominio final.

## 1. DecisiÃ³n de arquitectura de dominio

### Recomendado

| Dominio | Uso |
|---|---|
| `https://kargax.com` | Landing/home pÃºblica o app inicial si se lanza simple. |
| `https://www.kargax.com` | Redirect 308 a `https://kargax.com`. |
| `https://app.kargax.com` | App autenticada cuando separen marketing/app. |
| `https://staging.kargax.com` | Staging si se configura dominio propio. |

### Si solo se lanza uno ahora

Usar `https://kargax.com` como canonical y no mezclar con `app.kargax.com` hasta que estÃ© listo.

## 2. Vercel / hosting

### Tareas

1. Agregar dominio en proyecto Vercel correcto.
2. Configurar DNS exactamente como indique Vercel.
3. Esperar certificado activo.
4. Activar redirect `www` â†’ raÃ­z o raÃ­z â†’ `www`, pero no ambos.
5. Confirmar que Vercel muestra dominio como `Valid Configuration`.

### Pruebas

```bash
curl -I https://kargax.com
curl -I https://www.kargax.com
curl -I http://kargax.com
curl -I http://www.kargax.com
```

Esperado:

- HTTPS devuelve 200/30x vÃ¡lido.
- HTTP redirige a HTTPS.
- Certificado no expirado.
- No hay redirect loop.

## 3. Variables de entorno que afectan seguridad de dominio

### ProducciÃ³n raÃ­z

```dotenv
NEXT_PUBLIC_APP_URL=https://kargax.com
ALLOWED_ORIGINS=https://kargax.com,https://www.kargax.com
NEXT_PUBLIC_PAYMENT_SUCCESS_URL=https://kargax.com/pago/exitoso
NEXT_PUBLIC_PAYMENT_FAILURE_URL=https://kargax.com/pago/fallido
NEXT_PUBLIC_PAYMENT_PENDING_URL=https://kargax.com/pago/pendiente
```

### ProducciÃ³n con app subdomain

```dotenv
NEXT_PUBLIC_APP_URL=https://app.kargax.com
ALLOWED_ORIGINS=https://app.kargax.com,https://kargax.com,https://www.kargax.com
NEXT_PUBLIC_PAYMENT_SUCCESS_URL=https://app.kargax.com/pago/exitoso
NEXT_PUBLIC_PAYMENT_FAILURE_URL=https://app.kargax.com/pago/fallido
NEXT_PUBLIC_PAYMENT_PENDING_URL=https://app.kargax.com/pago/pendiente
```

## 4. Supabase Auth URL Configuration

En Supabase Dashboard:

### Site URL

Usar el mismo canonical que `NEXT_PUBLIC_APP_URL`.

```text
https://kargax.com
```

o

```text
https://app.kargax.com
```

### Redirect URLs

Agregar explÃ­citamente:

```text
https://kargax.com/auth/callback
https://kargax.com/auth/invite/accept
https://kargax.com/auth/reset-password
https://www.kargax.com/auth/callback
https://www.kargax.com/auth/invite/accept
https://www.kargax.com/auth/reset-password
```

Si se usa app subdomain:

```text
https://app.kargax.com/auth/callback
https://app.kargax.com/auth/invite/accept
https://app.kargax.com/auth/reset-password
```

Mantener localhost solo en desarrollo:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/invite/accept
http://localhost:3000/auth/reset-password
```

### ValidaciÃ³n

```bash
npm run supabase:auth-url-check
```

No debe devolver localhost ni mismatch.

## 5. MercadoPago

### URLs

Configurar en MercadoPago:

```text
Webhook: https://kargax.com/api/payments/webhook
Success: https://kargax.com/pago/exitoso
Failure: https://kargax.com/pago/fallido
Pending: https://kargax.com/pago/pendiente
```

Si se usa app subdomain, cambiar a `https://app.kargax.com`.

### Seguridad

- Webhook secret obligatorio.
- Rechazar webhooks sin firma vÃ¡lida.
- Idempotencia por payment/preference/event id.
- No loggear payload sensible completo.
- Probar sandbox primero.

## 6. Headers de seguridad

El repo ya centraliza headers en `frontend/src/lib/server/security-headers.ts` y los aplica desde `next.config.ts` y proxy/CORS.

### Mantener

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Strict-Transport-Security` en producciÃ³n

### Revisar

La CSP permite `unsafe-inline` y `unsafe-eval`. Plan:

1. Staging con report-only.
2. Medir errores reales.
3. Reducir gradualmente.
4. No romper MercadoPago/Recaptcha/Next.

## 7. HSTS

El header HSTS solo debe activarse cuando:

- HTTPS funciona.
- Todos los subdominios necesarios tienen certificado.
- No existe subdominio viejo sin HTTPS.
- El canonical estÃ¡ decidido.

El repo ya usa:

```text
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

**Cuidado:** `includeSubDomains; preload` es serio. No pedir preload pÃºblico hasta estar 100% seguro de subdominios.

## 8. Mixed content

Revisar que no existan assets HTTP:

- imÃ¡genes,
- scripts,
- fonts,
- APIs,
- Supabase URLs,
- MercadoPago callbacks,
- mapas/geolocation si se agregan.

Comando bÃ¡sico:

```bash
grep -R "http://" frontend/src frontend/public docs supabase --exclude-dir=node_modules --exclude-dir=.next
```

Permitido solo para localhost/dev docs si no entra a producciÃ³n.

## 9. Google / navegador â€œsitio no seguroâ€

Causas comunes:

- Certificado SSL no activo.
- HTTP sin redirect a HTTPS.
- Mixed content.
- Dominio con malware/phishing reportado.
- Formulario sensible en HTTP.
- Cookies sin `Secure`.
- Supabase/Auth redirect a dominio distinto inseguro.

Checklist:

- Agregar Google Search Console.
- Verificar propiedad DNS.
- Enviar sitemap si existe.
- Revisar Security Issues en Search Console.
- Revisar Safe Browsing si aparece warning.
- No usar logos/copy que parezcan phishing de bancos/medios de pago.

## 10. Cookies/sesiÃ³n

Verificar cookies de sesiÃ³n:

- `Secure` en HTTPS.
- `HttpOnly` si son server session cookies.
- `SameSite=Lax` o `Strict` segÃºn flujo.
- No exponer tokens en localStorage si no es necesario.

## 11. CORS

`ALLOWED_ORIGINS` debe ser estricto. No usar `*` con credenciales.

Correcto:

```dotenv
ALLOWED_ORIGINS=https://kargax.com,https://www.kargax.com,https://app.kargax.com
```

Incorrecto:

```dotenv
ALLOWED_ORIGINS=*
```

## 12. Prueba final de dominio

```bash
npm run check:release
npm run supabase:auth-url-check
npm --prefix frontend run smoke:release -- --base-url https://kargax.com
```

Manual:

- abrir incÃ³gnito,
- registrar usuario,
- login,
- callback auth,
- abrir dashboard,
- abrir billetera,
- iniciar pago sandbox/low-risk,
- revisar consola browser sin mixed content ni CSP errors crÃ­ticos.
