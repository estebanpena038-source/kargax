# Checklist Go-Live KargaX

## Regla

Si un P0 estÃ¡ incompleto, no hay producciÃ³n pÃºblica.

## 1. Repo y rama

- [ ] Rama `production-readiness/kargax-go-live` creada.
- [ ] `Produccion/` copiado al repo.
- [ ] No hay `.env.local` commiteado.
- [ ] No hay secrets en Markdown, screenshots o logs.
- [ ] Deuda de repo anidado documentada o resuelta.
- [ ] `KARGAX_AI_OPERATING_SYSTEM` tiene decisiÃ³n: instalado en raÃ­z o mantenido como paquete.

## 2. Dominio y SSL

- [ ] Dominio canÃ³nico decidido: `kargax.com` o `app.kargax.com`.
- [ ] DNS configurado.
- [ ] Certificado HTTPS activo.
- [ ] HTTP redirige a HTTPS.
- [ ] `www` redirige correctamente.
- [ ] No hay redirect loop.
- [ ] No hay mixed content.
- [ ] `/api/health` responde por HTTPS.
- [ ] Search Console configurado.

## 3. Variables de entorno

- [ ] `NEXT_PUBLIC_APP_URL` usa HTTPS real.
- [ ] `ALLOWED_ORIGINS` no usa `*`.
- [ ] Supabase URL/anon/service role configurados.
- [ ] MercadoPago prod/sandbox correcto segÃºn ambiente.
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` configurado.
- [ ] `INTERNAL_API_KEY` configurado.
- [ ] `NOTIFICATION_PROVIDER` no queda `console` en producciÃ³n real.
- [ ] Upstash/Redis configurado para rate limiting.
- [ ] Sentry/PostHog o alternativa configurada.
- [ ] CEO allowlist configurada.
- [ ] Payouts automÃ¡ticos apagados si no hay auditorÃ­a final.

## 4. Supabase

- [ ] Migraciones aplicadas en staging.
- [ ] Migraciones aplicadas en producciÃ³n.
- [ ] Orden de migraciones revisado.
- [ ] `000_run_all.sql` revisado si se usa.
- [ ] Duplicidad de numeraciÃ³n `036_*` revisada.
- [ ] Buckets requeridos creados.
- [ ] Storage policies revisadas.
- [ ] RLS activa en tablas sensibles.
- [ ] Seeds/feature flags requeridos cargados.
- [ ] Auth Site URL correcto.
- [ ] Auth Redirect URLs correctos.
- [ ] Email templates sin localhost.

## 5. Pagos MercadoPago

- [ ] Credenciales configuradas por ambiente.
- [ ] Webhook URL apunta al dominio final.
- [ ] Webhook exige firma.
- [ ] Firma invÃ¡lida rechazada.
- [ ] Evento duplicado no duplica transacciÃ³n.
- [ ] Pago aprobado funciona.
- [ ] Pago fallido funciona.
- [ ] Pago pendiente funciona.
- [ ] Redirect success/failure/pending funciona.
- [ ] Logs no exponen secretos ni PII completa.

## 6. Wallet y retiros

- [ ] Tarjeta visual eliminada.
- [ ] Panel dice â€œSaldo operativoâ€.
- [ ] No aparece nÃºmero tipo tarjeta.
- [ ] No se usa `CreditCard` como identidad de wallet.
- [ ] Marketplace balance separado de flota privada.
- [ ] Monto mÃ­nimo 50.000 COP validado.
- [ ] Usuario no trucker bloqueado.
- [ ] Retiro requiere sesiÃ³n y AAL2/MFA.
- [ ] Cuenta/documento enmascarados.
- [ ] Payouts automÃ¡ticos apagados hasta auditorÃ­a.
- [ ] Retiros manuales tienen runbook operativo.

## 7. Jobs, crons y rutas pÃºblicas

- [ ] `/api/jobs/payouts/process` exige secret/firma.
- [ ] `/api/payments/webhook` exige firma.
- [ ] Rutas pÃºblicas revisadas una por una.
- [ ] POST/PUT/PATCH/DELETE sensibles devuelven 401/403 sin credencial.
- [ ] Rate limiting distribuido activo.
- [ ] Alertas por abuso/429 configuradas.
- [ ] `vercel.json` crons revisados.

## 8. Roles y permisos

- [ ] Matriz final de roles aprobada.
- [ ] `check-role-policy.mjs` ampliado.
- [ ] Tests por owner.
- [ ] Tests por dispatcher.
- [ ] Tests por finance_accountant.
- [ ] Tests por warehouse_operator.
- [ ] Tests por auditor.
- [ ] Tests por viewer.
- [ ] Tests admin con MFA.
- [ ] Tests CEO allowlist.
- [ ] Cross-business access devuelve 403.

## 9. UI/Responsive

- [ ] 320px sin overflow.
- [ ] 375px sin overflow.
- [ ] 768px correcto.
- [ ] Desktop correcto.
- [ ] Sidebar no tapa contenido.
- [ ] Tablas tienen versiÃ³n mobile.
- [ ] Botones touch â‰¥44px.
- [ ] Estados tienen texto + icono + color.
- [ ] Loading/empty/error states.
- [ ] Wallet/billing/liquidaciones sin confusiÃ³n.

## 10. Observabilidad

- [ ] Error tracking activo.
- [ ] Release tag con commit SHA.
- [ ] Uptime `/api/health`.
- [ ] Alertas por 5xx.
- [ ] Alertas webhook fallido.
- [ ] Alertas job fallido.
- [ ] Alertas auth spikes.
- [ ] Logs redacted.
- [ ] Runbook incidente creado.

## 11. Legal/compliance

- [ ] TÃ©rminos revisados.
- [ ] Privacidad revisada.
- [ ] Tratamiento de datos personales revisado.
- [ ] GeolocalizaciÃ³n explicada.
- [ ] Evidencias/fotos/firmas explicadas.
- [ ] Wallet redactada como ledger operativo.
- [ ] Flota privada: pagos externos explicados.
- [ ] Soporte/contacto visible.

## 12. Comandos finales

Ejecutar y guardar evidencia:

```bash
npm install
npm run repo:audit
npm run check:roles
npm run security:audit
npm run supabase:inspect -- --json
npm run supabase:auth-url-check
npm run check
npm run check:release
npm --prefix frontend run visual:qa
npm --prefix frontend run visual:qa:browser
npm --prefix frontend run smoke:release -- --base-url https://kargax.com
```

## 13. No-Go inmediato si pasa algo de esto

- [ ] Cualquier secret aparece en repo/log/screenshot.
- [ ] Auth redirect apunta a localhost.
- [ ] Webhook acepta firma invÃ¡lida.
- [ ] Job interno corre sin secret.
- [ ] RLS permite cross-business.
- [ ] Wallet parece tarjeta/crÃ©dito.
- [ ] `check:release` falla.
- [ ] `/api/health` falla.
- [ ] Hay mixed content.
- [ ] ProducciÃ³n usa `NOTIFICATION_PROVIDER=console` para operaciones reales.
- [ ] Payout automÃ¡tico activo sin auditorÃ­a.

## 14. DÃ­a 0

- [ ] Deploy producciÃ³n.
- [ ] Smoke producciÃ³n.
- [ ] Crear usuario trucker test.
- [ ] Crear business test.
- [ ] Probar auth callback.
- [ ] Probar dashboard.
- [ ] Probar wallet sin tarjeta.
- [ ] Probar soporte.
- [ ] Probar pago de bajo riesgo segÃºn ambiente permitido.
- [ ] Ver logs 60 minutos.
- [ ] Mantener feature flags riesgosas apagadas.

## 15. Rollback

- [ ] Ãšltimo deployment estable identificado.
- [ ] Backup DB disponible.
- [ ] Feature flags para apagar pagos/withdrawals/lending/tracking si hace falta.
- [ ] Contacto interno de incidentes.
- [ ] Mensaje de estado para usuarios si hay degradaciÃ³n.
