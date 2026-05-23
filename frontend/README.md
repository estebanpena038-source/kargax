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
npm run smoke:release -- --base-url https://app.kargax.com
```

## Variables de entorno

Usa [`.env.example`](</C:/kargax2/frontend/.env.example>) como base.

En produccion financiera:

- `NEXT_PUBLIC_APP_URL` debe ser HTTPS publico
- `SUPABASE_SERVICE_ROLE_KEY` es obligatoria
- `MERCADOPAGO_WEBHOOK_SECRET` es obligatoria
- `INTERNAL_API_KEY` es obligatoria para flujos internos
- `NOTIFICATION_PROVIDER` no puede ser `console`

## Notas de release

- `npm run build` compila hoy
- `npm run check:release` valida estructura, env docs y exposicion de secretos
- `npm run smoke:release` ejecuta la smoke suite asistida sobre un entorno real
- la limpieza de lint sigue siendo trabajo pendiente antes de un release financiero serio
