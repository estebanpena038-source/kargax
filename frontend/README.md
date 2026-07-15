# KargaX Frontend

Aplicacion principal de KargaX construida con Next.js App Router.

## Dominios vivos

- marketplace y viajes
- pagos y billing
- wallet y retiros
- fuel advances
- bodegas y 3PL
- holding y control corporativo
- admin y soporte

## Comandos

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run check
npm run check:release
npm run smoke:release -- --base-url https://www.kargax.online
```

## Variables de entorno

Usa [`.env.example`](</C:/kargax2/frontend/.env.example>) como base.

En produccion financiera:

- `NEXT_PUBLIC_APP_URL` debe ser HTTPS publico
- `SUPABASE_SERVICE_ROLE_KEY` es obligatoria
- `MERCADOPAGO_WEBHOOK_SECRET` es obligatoria
- `INTERNAL_API_KEY` es obligatoria para flujos internos
- `KARGAX_PROD_SUPABASE_PROJECT_REF` debe coincidir con el project ref real de Supabase produccion
- `KARGAX_STAGING_SUPABASE_PROJECT_REF` debe existir y ser diferente al ref de produccion
- `NOTIFICATION_PROVIDER=manual` mientras KargaX valida traccion sin SMS pago
- `KARGAX_MANUAL_PIN_DELIVERY_ENABLED=true` es obligatorio para preparar mensajes PIN manuales
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` y `TWILIO_MESSAGING_SERVICE_SID` deben quedar vacias hasta reactivar SMS pago
- Supabase Auth debe usar SMTP propio: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME`

En staging:

- `NEXT_PUBLIC_APP_URL=https://kargax-staging.vercel.app`
- `KARGAX_STAGING_SUPABASE_PROJECT_REF` debe coincidir con el project ref real de Supabase staging
- `KARGAX_PROD_SUPABASE_PROJECT_REF` debe existir y ser diferente al ref de staging
- `NOTIFICATION_PROVIDER=manual`
- `KARGAX_MANUAL_PIN_DELIVERY_ENABLED=true`
- No configurar `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` ni `TWILIO_MESSAGING_SERVICE_SID`
- El release gate bloquea staging si aparece Twilio o si falta el modo manual explicito

## Notas de release

- `npm run build` compila hoy
- `npm run check:release` valida estructura, env docs y exposicion de secretos
- `npm run smoke:release` ejecuta la smoke suite asistida sobre un entorno real
- la limpieza de lint sigue siendo trabajo pendiente antes de un release financiero serio
