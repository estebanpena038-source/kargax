# IMPLEMENTACIÃ“N â€” Plan completo para dejar KargaX listo para producciÃ³n

> Documento para dev/IA.
> Objetivo: ejecutar sin improvisar, sin romper pagos/wallet/roles/RLS y dejando evidencia de producciÃ³n.

## 0. Reglas obligatorias para el dev/IA

1. No subir secrets al repo.
2. No tocar lÃ³gica financiera sin tests y revisiÃ³n.
3. No cambiar RLS/migraciones sin rollback SQL.
4. No activar payouts automÃ¡ticos hasta tener proveedor, lÃ­mites, conciliaciÃ³n y monitoreo.
5. No presentar la billetera como tarjeta, cuenta bancaria, crÃ©dito o depÃ³sito.
6. Todo cambio sensible debe tener evidencia: test, screenshot, log o reporte JSON.
7. Cada PR debe declarar riesgo: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
8. Wallet, billing, payouts, MercadoPago, RLS, roles, geolocalizaciÃ³n y documentos son `RISK HIGH` mÃ­nimo.

## 1. PreparaciÃ³n de rama y baseline

### Objetivo

Crear una rama de producciÃ³n y capturar estado base antes de tocar algo.

### Comandos

```bash
git checkout main
git pull

git checkout -b production-readiness/kargax-go-live
npm install
npm run repo:audit
npm run check:roles
npm run security:audit
npm run check
```

### Evidencia requerida

Guardar outputs en una carpeta local o en CI artifacts:

```text
qa/evidence/production-readiness/
  repo-audit.json
  role-policy.txt
  security-audit.json
  check.txt
```

### Criterio de aceptaciÃ³n

- La rama existe.
- No hay cambios funcionales todavÃ­a.
- El equipo sabe quÃ© falla antes de implementar.

## 2. Instalar/normalizar `Produccion/`

### Objetivo

Copiar esta carpeta al repo sin tocar la app.

### Comandos

```bash
mkdir -p Produccion
# copiar todos los .md entregados dentro de Produccion/

git add Produccion
git commit -m "Add production readiness documentation"
```

### Criterio de aceptaciÃ³n

- `Produccion/README.md` existe.
- `Produccion/IMPLEMENTACION.md` existe.
- El commit no incluye secrets ni `.env.local`.

## 3. Decidir dominio canÃ³nico

### DecisiÃ³n recomendada

Para producto SaaS/logÃ­stico:

- `https://kargax.com` â†’ landing pÃºblica / marketing / home.
- `https://app.kargax.com` â†’ aplicaciÃ³n autenticada.
- `https://www.kargax.com` â†’ redirect 308 a `https://kargax.com`.

Si se quiere lanzar todo en raÃ­z al inicio, usar:

- `NEXT_PUBLIC_APP_URL=https://kargax.com`
- `ALLOWED_ORIGINS=https://kargax.com,https://www.kargax.com`

### Tareas

1. Agregar dominios en Vercel.
2. Configurar DNS segÃºn Vercel.
3. Esperar certificado HTTPS activo.
4. Probar:

```bash
curl -I https://kargax.com
curl -I https://www.kargax.com
curl -I https://app.kargax.com
```

5. Confirmar que no hay redirects a `http://`, localhost o staging.

### Criterio de aceptaciÃ³n

- Certificado vÃ¡lido.
- RedirecciÃ³n canÃ³nica decidida.
- `/api/health` responde por HTTPS.
- No hay mixed content en browser console.

## 4. Configurar variables de entorno de producciÃ³n

### Objetivo

Reemplazar placeholders/localhosts por valores productivos en Vercel/Supabase/MercadoPago, no en Git.

### Matriz mÃ­nima

```dotenv
NEXT_PUBLIC_APP_NAME=KargaX
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_APP_URL=https://kargax.com
ALLOWED_ORIGINS=https://kargax.com,https://www.kargax.com,https://app.kargax.com

NEXT_PUBLIC_SUPABASE_URL={{SUPABASE_PROD_URL}}
NEXT_PUBLIC_SUPABASE_ANON_KEY={{SUPABASE_PROD_ANON_KEY}}
SUPABASE_SERVICE_ROLE_KEY={{SUPABASE_PROD_SERVICE_ROLE_KEY}}

MERCADOPAGO_ACCESS_TOKEN={{MP_PROD_ACCESS_TOKEN}}
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY={{MP_PROD_PUBLIC_KEY}}
MERCADOPAGO_WEBHOOK_SECRET={{MP_WEBHOOK_SECRET}}
ALLOW_UNSIGNED_MP_WEBHOOKS_IN_PREVIEW=false

NEXT_PUBLIC_PAYMENT_SUCCESS_URL=https://kargax.com/pago/exitoso
NEXT_PUBLIC_PAYMENT_FAILURE_URL=https://kargax.com/pago/fallido
NEXT_PUBLIC_PAYMENT_PENDING_URL=https://kargax.com/pago/pendiente

INTERNAL_API_KEY={{LONG_RANDOM_INTERNAL_KEY}}

NOTIFICATION_PROVIDER=twilio
TWILIO_ACCOUNT_SID={{TWILIO_ACCOUNT_SID}}
TWILIO_AUTH_TOKEN={{TWILIO_AUTH_TOKEN}}
TWILIO_PHONE_NUMBER={{TWILIO_PHONE_NUMBER}}

PAYOUTS_ENABLED=false
PAYOUT_DRY_RUN=true
PAYOUT_PROVIDER=manual
PAYOUT_WEBHOOK_SECRET={{PAYOUT_WEBHOOK_SECRET_IF_USED}}
PAYOUT_MAX_SINGLE_COP=500000
PAYOUT_DAILY_LIMIT_COP=2000000
PAYOUT_MIN_AMOUNT_COP=50000
PAYOUT_BATCH_SIZE=10
PRIVATE_FLEET_PAYROLL_WALLET_RELEASE_ENABLED=false

UPSTASH_REDIS_REST_URL={{UPSTASH_URL}}
UPSTASH_REDIS_REST_TOKEN={{UPSTASH_TOKEN}}

NEXT_PUBLIC_SENTRY_DSN={{SENTRY_DSN}}
NEXT_PUBLIC_POSTHOG_KEY={{POSTHOG_PUBLIC_KEY}}
POSTHOG_API_KEY={{POSTHOG_PRIVATE_KEY}}
POSTHOG_CAPTURE_URL={{POSTHOG_CAPTURE_URL}}

KARGAX_CEO_EMAILS={{FOUNDER_EMAILS_COMMA_SEPARATED}}
KARGAX_CEO_USER_IDS={{FOUNDER_USER_IDS_COMMA_SEPARATED}}
```

### Criterio de aceptaciÃ³n

- No queda `localhost` en env de producciÃ³n.
- `NOTIFICATION_PROVIDER` no queda en `console` para producciÃ³n real.
- `PAYOUTS_ENABLED=false` hasta terminar auditorÃ­a de pagos salientes.
- `ALLOW_UNSIGNED_MP_WEBHOOKS_IN_PREVIEW=false`.
- `INTERNAL_API_KEY` existe y no estÃ¡ en Markdown/commits.

## 5. Supabase producciÃ³n/staging

### Objetivo

Garantizar que DB, RLS, storage y Auth estÃ¡n sincronizados con la app.

### Pasos

1. Crear proyecto Supabase staging y producciÃ³n.
2. Aplicar migraciones desde `supabase/migrations`.
3. Confirmar que no hay migraciones duplicadas mal ordenadas.
4. Revisar `000_run_all.sql` si se usa como bootstrap.
5. Crear buckets requeridos:
   - `offer-photos`
   - `trip-photos`
   - `trip-signatures`
   - `warehouse-sku-images`
   - `private-fleet-payment-proofs`
6. Configurar Storage Policies.
7. Configurar Auth:
   - Site URL correcto.
   - Redirect URLs correctos.
   - Email templates sin localhost.
8. Ejecutar inspecciÃ³n:

```bash
npm run supabase:inspect -- --json
npm run supabase:auth-url-check
npm run check:release
```

### Tests manuales de Supabase

- Login trucker.
- Login business owner.
- Login team member con rol limitado.
- Login admin.
- Magic link/callback.
- Recovery password.
- Invite team.
- Upload evidencia.
- Ver evidencia solo con permisos correctos.
- Intentar cross-business access y esperar 403.

### Criterio de aceptaciÃ³n

- `supabase:auth-url-check` pasa.
- `check:release` pasa contra DB staging/prod.
- No hay links a localhost.
- RLS impide lectura/escritura entre empresas.
- Buckets existen y no son pÃºblicos si no corresponde.

## 6. Seguridad de API, proxy y jobs

### Objetivo

Evitar que rutas sensibles se puedan invocar pÃºblicamente sin autorizaciÃ³n.

### Rutas pÃºblicas a revisar

- `/api/payments/webhook`
- `/api/jobs/payouts/process`
- `/api/ops/events`
- `/api/notifications/send-pin`
- `/api/notifications/inspection`
- `/api/support/requests`
- `/api/onboarding/status`
- `/api/onboarding/checklist`

### PatrÃ³n obligatorio para jobs internos

Cada job interno debe validar una de estas opciones:

1. `X-Internal-Api-Key` igual a `INTERNAL_API_KEY` con comparaciÃ³n segura.
2. Firma HMAC con timestamp y tolerancia corta.
3. Token de cron del proveedor.
4. QStash signature si se usa QStash.

### Test mÃ­nimo por ruta job

```bash
curl -i -X POST https://kargax.com/api/jobs/payouts/process
# esperado: 401 o 403

curl -i -X POST https://kargax.com/api/jobs/payouts/process \
  -H "X-Internal-Api-Key: wrong"
# esperado: 401 o 403
```

Luego probar con secret real desde entorno seguro, nunca pegado en docs.

### Webhooks MercadoPago

Validar:

- Firma obligatoria.
- Idempotencia.
- Replay protection.
- Logs sin datos sensibles completos.
- Modo sandbox antes de producciÃ³n.
- Alertas por fallo.

### Criterio de aceptaciÃ³n

- Todas las rutas internas devuelven 401/403 sin credencial.
- Webhook rechaza firma invÃ¡lida.
- Jobs no se pueden disparar desde navegador comÃºn.
- Rate limit distribuido activo.

## 7. Quitar tarjeta visual de billetera

### Objetivo

Cambiar UI, no lÃ³gica.

### Archivo principal

```text
frontend/src/app/billetera/page.tsx
```

### QuÃ© NO se debe romper

- `withdrawableMarketplaceBalance`
- `marketplaceWallet`
- `pendingWithdrawals`
- `privateFleetLedger`
- `openWithdrawModal`
- `handleSubmitWithdrawal`
- validaciones de monto mÃ­nimo
- separaciÃ³n marketplace vs flota privada
- API `/api/wallet/withdraw`
- AAL2/MFA requerido para retiro

### QuÃ© se debe quitar

- Visual tipo tarjeta bancaria/crÃ©dito.
- Aspect ratio de tarjeta.
- Chip visual.
- NÃºmero tipo tarjeta (`walletCardNumber`) si solo existe para la tarjeta.
- Copy como â€œTarjeta premium KargaX Walletâ€.
- Ãcono `CreditCard` como identidad principal de la billetera.

### QuÃ© se debe poner

Panel de saldo operativo con 4 bloques:

1. **Disponible para retiro** â€” `formatCOP(withdrawableMarketplaceBalance || 0)`.
2. **Pendiente marketplace** â€” `marketplaceWallet?.pendingReleaseCop`.
3. **En proceso de retiro** â€” `marketplaceWallet?.payoutProcessingCop` o suma de `pendingWithdrawals`.
4. **Pagado este mes** â€” `marketplaceWallet?.paidThisMonthCop`.

Copy superior:

```text
Saldo operativo KargaX
Ledger marketplace para retiros verificados
```

Copy aclaratorio:

```text
Este panel muestra saldo operativo de marketplace confirmado. No es una tarjeta, cuenta bancaria, depÃ³sito ni producto de crÃ©dito. Las liquidaciones privadas externas se registran como soporte y no aumentan el saldo disponible para retiro.
```

### Pseudocambio orientativo

```tsx
<motion.section
  initial={{ opacity: 0, y: 18 }}
  animate={{ opacity: 1, y: 0 }}
  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_48px_-38px_rgba(10,10,10,.55)]"
  aria-label="Panel de saldo operativo KargaX Wallet"
>
  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Saldo operativo KargaX</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Ledger marketplace para retiros verificados</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
        Este panel muestra saldo operativo de marketplace confirmado. No es una tarjeta,
        cuenta bancaria, deposito ni producto de credito.
      </p>
    </div>
    <div className="rounded-lg border border-zinc-200 bg-zinc-950 px-4 py-3 text-white">
      <p className="text-xs uppercase tracking-[0.18em] text-white/50">Disponible para retiro</p>
      <p className="font-money mt-2 text-3xl font-semibold">{formatCOP(withdrawableMarketplaceBalance || 0)}</p>
    </div>
  </div>

  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {/* tiles de marketplaceWallet */}
  </div>
</motion.section>
```

### QA obligatorio

- `/billetera` como trucker con saldo cero.
- `/billetera` como trucker con saldo disponible.
- `/billetera` con retiro pendiente.
- `/billetera` con liquidaciones privadas externas.
- usuario no trucker debe seguir bloqueado.
- 320px sin overflow horizontal.
- 375px, 768px, desktop.
- No aparece la palabra â€œtarjetaâ€ en aria labels/copy visual.
- No aparece nÃºmero tipo tarjeta.

## 8. Pagos, wallet y payouts

### MercadoPago entrada de dinero

1. Configurar credenciales producciÃ³n.
2. Configurar webhook URL:

```text
https://kargax.com/api/payments/webhook
```

3. Probar sandbox.
4. Probar firma invÃ¡lida.
5. Probar pago duplicado.
6. Probar pago aprobado, pendiente, fallido.
7. Probar redirects success/failure/pending.

### Wallet/retiros

Mantener:

- monto mÃ­nimo 50.000 COP,
- idempotencia,
- separaciÃ³n marketplace/private fleet,
- retiros manuales por defecto,
- AAL2/MFA para retiro,
- enmascaramiento de cuenta/documento.

### Payouts automÃ¡ticos

No activar hasta cumplir:

- proveedor validado,
- contrato/soporte legal,
- lÃ­mites bajos,
- daily limit,
- conciliaciÃ³n,
- manejo de reversas,
- tablero de operaciones,
- alertas,
- dry-run mÃ­nimo una semana.

## 9. Roles, RLS y permisos

### Objetivo

Alinear UI, API y DB.

### Acciones

1. Crear matriz final de permisos basada en:
   - `frontend/src/lib/business-roles.ts`
   - `frontend/src/lib/server/role-policy.ts`
   - polÃ­ticas RLS en `supabase/migrations`
2. Ampliar `scripts/check-role-policy.mjs` para cubrir:
   - `frontend/src/app/api/admin`
   - `frontend/src/app/api/wallet`
   - `frontend/src/app/api/jobs`
   - `frontend/src/app/api/payments`
   - `frontend/src/app/api/warehouses`
   - `frontend/src/app/api/tracking`
   - `frontend/src/app/api/support`
3. Tests por rol:
   - owner puede todo en su empresa.
   - dispatcher no ve finanzas.
   - finance_accountant ve finanzas pero no opera bodega.
   - warehouse_operator no ve finanzas ni equipo.
   - viewer no muta datos.
   - auditor exporta/lee segÃºn polÃ­tica, no modifica.
   - admin requiere MFA.
   - CEO control tower requiere allowlist.

### Criterio de aceptaciÃ³n

- 403 correcto para permisos denegados.
- No hay datos cross-business.
- UI oculta acciones no permitidas, pero API tambiÃ©n bloquea.
- RLS respalda la API.

## 10. Observabilidad y monitoreo

### Tareas

1. Activar Sentry o equivalente.
2. Configurar release name con commit SHA.
3. Monitorear:
   - `/api/health`
   - login failures
   - payment webhook failures
   - withdrawal failures
   - job failures
   - DB latency
   - 5xx API
   - CORS denied spikes
   - rate limit spikes
4. Crear alertas a email/Slack/Discord interno.
5. Crear runbook de incidentes.

### Logs seguros

No loggear completo:

- documentos,
- telÃ©fonos,
- cuentas bancarias,
- access tokens,
- service role key,
- webhook secrets,
- payloads completos de pago con datos sensibles.

## 11. QA visual/responsive

### Ejecutar

```bash
npm --prefix frontend run visual:qa
npm --prefix frontend run visual:qa:browser
```

### Vistas prioritarias

- `/`
- `/login`
- `/registro`
- `/dashboard`
- `/billetera`
- `/planes`
- `/bodegas`
- `/ofertas`
- `/ofertas-aceptadas`
- `/viajes-asignados`
- `/admin`
- `/soporte`
- pÃ¡ginas de pago

### Criterios

- 320px sin overflow horizontal.
- Sidebar no tapa contenido.
- Tablas tienen versiÃ³n mobile.
- Botones touch â‰¥44px.
- Estados tienen color + texto + icono.
- Empty/loading/error states existen.
- Wallet no parece producto financiero bancario.

## 12. Release gates finales

Ejecutar en limpio:

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
npm --prefix frontend run smoke:release -- --base-url https://kargax.com
```

### Criterio de aceptaciÃ³n

- Todos pasan.
- Outputs guardados.
- No hay secrets en logs.
- No hay localhost en producciÃ³n.
- No hay warnings crÃ­ticos sin decisiÃ³n.

## 13. Launch controlado

### DÃ­a -2

- Freeze de features.
- Solo bugs P0/P1.
- Smoke staging completo.
- Backup Supabase.
- Verificar DNS y certificado.

### DÃ­a -1

- Probar pagos sandbox/final.
- Probar auth real.
- Probar wallet sin retiros automÃ¡ticos.
- Probar roles.
- Probar soporte.
- Activar monitoreo.

### DÃ­a 0

- Deploy producciÃ³n.
- Smoke producciÃ³n.
- Crear usuario trucker test.
- Crear business test.
- Hacer flujo pago de bajo valor en entorno permitido.
- Ver logs 60 minutos.
- Mantener payouts automÃ¡ticos apagados.

### Rollback

Debe existir:

- commit anterior estable,
- backup DB,
- bandera para apagar features,
- forma de apagar payments/payouts,
- contacto de operaciones.

## 14. Prompt recomendado para la IA/dev implementadora

```text
ActÃºa como Staff Engineer/CTO de KargaX. Lee Produccion/ completo antes de tocar cÃ³digo.
Implementa solo una fase por PR. No subas secrets. Respeta RISK HIGH para wallet, pagos, roles, RLS y jobs.
Primero implementa UI_WALLET_SIN_TARJETA.md sin cambiar lÃ³gica financiera.
DespuÃ©s cierra SEGURIDAD_DOMINIO_SSL.md y los P0 de AUDITORIA_PRODUCCION.md.
Cada PR debe incluir: resumen, archivos tocados, riesgo, tests ejecutados, evidencia y rollback.
```
