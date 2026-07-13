# KargaX Supabase Auth Templates

Estos templates reemplazan los correos default de Supabase para que Auth use
enlaces `token_hash` validados por KargaX con `verifyOtp`. Esto evita el fallo
PKCE cuando Gmail, Android, iOS o un navegador distinto abre el correo fuera del
navegador donde se pidio el registro.

## Templates a cargar en Supabase

En Supabase Dashboard > Authentication > Emails:

| Supabase email | File | Subject |
| --- | --- | --- |
| Confirm signup | `confirm-signup.html` | `Confirma tu correo en KargaX` |
| Invite user | `invite.html` | `Tu acceso empresarial a KargaX esta listo` |
| Magic Link | `magic-link.html` | `Entra a KargaX` |
| Reset password | `recovery.html` | `Restablece tu acceso a KargaX` |

Cada template debe usar este patron:

```html
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=<tipo>
```

Tipos esperados:

- `email` para confirmacion de registro.
- `invite` para invitaciones.
- `magiclink` para magic links.
- `recovery` para recuperacion de contrasena.

No usar `{{ .ConfirmationURL }}` en emails productivos de KargaX.

## Auth URL configuration

Produccion:

- Site URL: `https://kargax.online`
- Redirect URLs:
  - `https://kargax.online/auth/callback`
  - `https://kargax.online/auth/reset-password`
  - `https://kargax.online/auth/invite/accept`
  - `https://www.kargax.online/auth/callback` si `www.kargax.online` esta aliasado al proyecto productivo
  - `https://www.kargax.online/auth/reset-password` si `www.kargax.online` esta aliasado al proyecto productivo
  - `https://www.kargax.online/auth/invite/accept` si `www.kargax.online` esta aliasado al proyecto productivo
  - `https://app.kargax.online/auth/callback` si `app.kargax.online` esta aliasado al proyecto productivo
  - `https://app.kargax.online/auth/reset-password` si `app.kargax.online` esta aliasado al proyecto productivo
  - `https://app.kargax.online/auth/invite/accept` si `app.kargax.online` esta aliasado al proyecto productivo

Dominios legacy, solo si deben seguir aceptando enlaces ya enviados:

- `https://kargax.com/auth/callback`
- `https://kargax.com/auth/reset-password`
- `https://kargax.com/auth/invite/accept`
- `https://app.kargax.com/auth/callback`
- `https://app.kargax.com/auth/reset-password`
- `https://app.kargax.com/auth/invite/accept`

Staging, si sigue activo:

- Site URL: `https://kargax-staging.vercel.app`
- Redirect URLs:
  - `https://kargax-staging.vercel.app/auth/callback`
  - `https://kargax-staging.vercel.app/auth/reset-password`
  - `https://kargax-staging.vercel.app/auth/invite/accept`

## SMTP productivo

Configurar SMTP con dominio propio. Recomendado para KargaX:

- Provider: Resend SMTP.
- From: `KargaX <noreply@auth.kargax.com>`.
- DNS obligatorio: SPF, DKIM y DMARC.

La verificacion completa requiere enviar correos reales desde produccion y
confirmar que el remitente ya no aparece como Supabase.

## Check local

```bash
npm run supabase:auth-template-check
```

## Check remoto

Con token de Supabase Management:

```bash
$env:SUPABASE_ACCESS_TOKEN="..."
npm run supabase:auth-config-check -- --project-ref kutgkfrjpujvtnimjnvo --base-url https://kargax.online --extra-origin https://www.kargax.online
```

Cuando SMTP propio este configurado, exigirlo en el gate:

```bash
npm run supabase:auth-config-check -- --project-ref kutgkfrjpujvtnimjnvo --base-url https://kargax.online --extra-origin https://www.kargax.online --require-smtp
```

## Aplicacion por Management API

Con token de Supabase Management:

```bash
$env:SUPABASE_ACCESS_TOKEN="..."
npm run supabase:auth-template-apply -- --project-ref kutgkfrjpujvtnimjnvo --base-url https://kargax.online --extra-origin https://www.kargax.online
```

Para incluir SMTP en el mismo PATCH:

```bash
$env:SMTP_HOST="smtp.resend.com"
$env:SMTP_PORT="587"
$env:SMTP_USER="resend"
$env:SMTP_PASS="re_..."
$env:SMTP_ADMIN_EMAIL="noreply@auth.kargax.com"
$env:SMTP_SENDER_NAME="KargaX"
npm run supabase:auth-template-apply -- --project-ref kutgkfrjpujvtnimjnvo --base-url https://kargax.online --extra-origin https://www.kargax.online --include-smtp
```
