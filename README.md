# KargaX

KargaX vive en `C:\kargax2`. La aplicacion principal es [`frontend`](</C:/kargax2/frontend>) y la historia oficial de base de datos vive en [`supabase/migrations`](</C:/kargax2/supabase/migrations>).

## Estructura oficial

```text
C:\kargax2
|-- README.md
|-- SPTRINTS\
|-- frontend\
|-- supabase\
`-- legacy\
```

## Fuente de verdad

- app principal: `frontend`
- roadmap y auditoria: `SPTRINTS`
- migraciones y SQL: `supabase/migrations`
- legado: `legacy`

## Comandos principales

Ejecuta estos comandos desde la raiz [`C:\kargax2`](</C:/kargax2>):

```bash
npm install
npm run repo:audit
npm run dev
npm run build
npm run lint
npm run check
npm run check:release
```

## Reglas de release

- `NEXT_PUBLIC_APP_URL` debe usar dominio publico HTTPS en produccion
- `MERCADOPAGO_WEBHOOK_SECRET` no debe aparecer en markdown, commits ni screenshots
- `INTERNAL_API_KEY` es obligatoria para flujos server-to-server sensibles
- la billetera se trata como ledger operativo, no como deposito bancario comercializado

## Estado actual

- `frontend` compila con `next build`
- la raiz ya opera como entrypoint con `package.json` y `repo:audit`
- la consolidacion git raiz + repo anidado sigue pendiente como deuda historica controlada
- `SPTRINTS` contiene el roadmap oficial de ejecucion
