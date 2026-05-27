# 07 — ENV, secretos y proveedores de payout

## Regla absoluta

No poner contraseñas, tokens, API keys ni secretos dentro del repo.

No usar contraseñas personales de Nequi, Bancolombia, Davivienda o cualquier banco en código.

KargaX debe integrarse por API oficial de un proveedor de pagos/dispersión, con credenciales guardadas en variables de entorno o secret manager.

## Variables recomendadas

Agregar a `.env.example` solo nombres, nunca valores reales:

```bash
# Payouts
PAYOUTS_ENABLED=false
PAYOUT_DRY_RUN=true
PAYOUT_PROVIDER=manual
PAYOUT_WEBHOOK_SECRET=
PAYOUT_MAX_SINGLE_COP=500000
PAYOUT_DAILY_LIMIT_COP=2000000
PAYOUT_MIN_AMOUNT_COP=50000
PAYOUT_BATCH_SIZE=10

# Cobre example placeholders
COBRE_API_BASE_URL=
COBRE_API_KEY=
COBRE_API_SECRET=
COBRE_WEBHOOK_SECRET=

# Wompi / bank partner placeholders
WOMPI_API_BASE_URL=
WOMPI_PRIVATE_KEY=
WOMPI_EVENTS_SECRET=

# Existing sensitive vars
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
INTERNAL_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
```

## Producción

En Vercel/hosting:

```text
PAYOUTS_ENABLED=true
PAYOUT_DRY_RUN=false
PAYOUT_PROVIDER=<proveedor_real>
```

En staging:

```text
PAYOUTS_ENABLED=true
PAYOUT_DRY_RUN=true
PAYOUT_PROVIDER=manual
```

## Seguridad por ambiente

El código debe impedir retiros reales si:

```text
NODE_ENV !== production
VERCEL_ENV !== production
PAYOUT_DRY_RUN=true
PAYOUTS_ENABLED=false
NEXT_PUBLIC_APP_URL no es HTTPS público
```

## Proveedores

### Opción 1 — Proveedor de dispersión empresarial

Ideal para:

- Pagar a Nequi.
- Pagar cuentas bancarias.
- Guardar comprobantes.
- Consultar estado.
- Recibir webhooks.

Ejemplos de tipos de proveedor:

- Cobre u otro proveedor B2B de pagos.
- Banco con API empresarial.
- Proveedor de pagos masivos.

### Opción 2 — Mercado Pago marketplace split

Mercado Pago permite integrar checkout marketplace usando OAuth de cada vendedor y parámetros como `marketplace_fee` en Checkout Pro. Eso reparte montos entre vendedor y marketplace.

Pero esta opción no es igual a “retener hasta entrega y pagar después”. Para pagar después de terminar ruta, KargaX necesita controlar liberación por su lado o usar una solución tipo escrow/retención si el proveedor la soporta contractualmente.

### Opción 3 — Manual fallback

Siempre debe existir.

Si proveedor falla:

- Admin puede ver payout failed.
- Admin paga por banco/Nequi externo.
- Admin sube comprobante.
- KargaX marca paid_manual.

## Qué NO pedir al usuario ni guardar

No pedir:

- contraseña de Nequi,
- contraseña bancaria,
- códigos OTP,
- claves dinámicas,
- tokens personales no oficiales,
- capturas de contraseñas.

Sí pedir:

- tipo de cuenta,
- banco,
- número de cuenta/celular,
- titular,
- documento,
- autorización de pago/terminos.

## Validación de destino

Antes de payout:

```text
Nequi: número celular colombiano 10 dígitos empezando por 3
Banco: banco no vacío, tipo cuenta, número cuenta >= 6 dígitos
Titular: nombre completo
Documento: tipo y número
```

## Cifrado / PII

Datos de cuenta y documento son sensibles.

Recomendado:

- Guardar últimos 4 dígitos en texto.
- Guardar datos completos cifrados si es necesario.
- No devolver documento completo al frontend después de guardado.
- No loggear accountNumber completo.
- No meter datos bancarios completos en admin_notifications sin máscara.

## Logs seguros

Nunca loggear:

```text
account_number completo
document_number completo
api_key
secret
provider raw request con credenciales
```

Sí loggear:

```text
payout_attempt_id
status
provider_transfer_id
amount
last4
request_id
```

## Rotación de claves

Crear runbook:

1. Crear nueva key en proveedor.
2. Poner nueva key en Vercel env.
3. Deploy.
4. Confirmar payouts dry-run.
5. Desactivar key antigua.
6. Registrar cambio en `critical_operations`.
