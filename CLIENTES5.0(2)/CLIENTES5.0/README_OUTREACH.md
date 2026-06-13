# Mini-programa de outreach CLIENTES5.0

Este paquete ya tiene mensajes por lead en `CLIENTES5.0_LEADS.json`.
El script `scripts/clientes5-outreach.mjs` permite:

- generar links de WhatsApp Web para envio manual;
- enviar correos con Resend API;
- enviar WhatsApp por Cloud API usando plantilla aprobada o texto libre si la conversacion ya esta habilitada;
- dejar log para no repetir contactos enviados.

## Regla importante

No guardes tokens en archivos del repo. Configuralos solo como variables de entorno.

WhatsApp Cloud API normalmente exige plantillas aprobadas para iniciar conversaciones de negocio. El modo `text` puede fallar si el contacto no tiene una ventana activa de 24 horas.

## Vista previa segura

Desde la raiz del repo:

```powershell
npm run clientes5:outreach -- --channel whatsapp-web --limit 10 --only-contactar-ya
```

Esto genera:

```text
CLIENTES5.0(2)/CLIENTES5.0/CLIENTES5.0_OUTREACH_QUEUE.csv
```

Abre los links `whatsapp_link` uno por uno.

## Enviar email con Resend

```powershell
$env:RESEND_API_KEY="re_xxx"
$env:EMAIL_FROM="KargaX <ventas@tudominio.com>"
$env:EMAIL_REPLY_TO="contactokargax@gmail.com"
npm run clientes5:outreach -- --channel email --limit 3 --only-contactar-ya --send
```

## Enviar WhatsApp con plantilla aprobada

```powershell
$env:WHATSAPP_TOKEN="EAAXXX"
$env:WHATSAPP_PHONE_NUMBER_ID="123456789"
$env:WHATSAPP_TEMPLATE_NAME="kargax_intro_operaciones"
$env:WHATSAPP_TEMPLATE_LANG="es_CO"
$env:WHATSAPP_TEMPLATE_VARS="empresa,dolor,persona"
npm run clientes5:outreach -- --channel whatsapp-cloud --limit 3 --only-contactar-ya --send
```

La plantilla debe tener la misma cantidad de variables que `WHATSAPP_TEMPLATE_VARS`.

## Enviar WhatsApp en modo texto

Usalo solo si ya existe ventana activa o permiso valido del contacto:

```powershell
$env:WHATSAPP_TOKEN="EAAXXX"
$env:WHATSAPP_PHONE_NUMBER_ID="123456789"
$env:WHATSAPP_MODE="text"
npm run clientes5:outreach -- --channel whatsapp-cloud --rank 1 --send
```

## Logs

El script escribe resultados en:

```text
CLIENTES5.0(2)/CLIENTES5.0/CLIENTES5.0_OUTREACH_LOG.jsonl
```

Si un contacto ya quedo con `status: "sent"`, no lo reenvia salvo que uses `--force`.
