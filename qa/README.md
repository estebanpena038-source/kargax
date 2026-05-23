# KargaX QA E2E - Suite Corta Para Piloto

> Objetivo: probar TODO el producto con pocas pruebas grandes.  
> Cada prueba E2E cubre muchos sprints al mismo tiempo, para no hacer 96 pruebas pequenas.

## La idea facil

Piensa en KargaX como una carrera de relevos:

1. La empresa entra y prepara la operacion.
2. Publica o despacha carga.
3. El camionero hace el viaje.
4. Se entrega con evidencia.
5. La plata llega a wallet.
6. El admin ve salud, pagos, errores y riesgos.

Si esas carreras completas pasan, KargaX esta listo para un piloto real controlado.

## Ambiente

- URL: `https://kargax-staging.vercel.app`
- Navegador: Chrome actualizado.
- Mobile: Android Chrome y, si se puede, iPhone Safari.
- Antes de empezar: abrir DevTools con `F12` y mirar la pestana `Console`.

## Evidencia obligatoria

En cada prueba guarda:

- quien probo: empresa, camionero, admin, etc.
- fecha y hora
- screenshot o video corto
- requestId si aparece
- IDs importantes: offerId, paymentId, wallet transaction, payout, dispatch, warehouse
- resultado: `PASS`, `FAIL` o `BLOCKED`

## Orden de ejecucion

| Orden | Archivo | Que cubre | Resultado esperado |
|---:|---|---|---|
| 1 | [01-preflight-automatico.md](./01-preflight-automatico.md) | comandos, build, release, smoke, health | la base tecnica esta sana |
| 2 | [02-e2e-auth-roles-permisos.md](./02-e2e-auth-roles-permisos.md) | registro, login, MFA, invitaciones, roles, links publicos | usuarios entran y ven solo lo suyo |
| 3 | [03-e2e-marketplace-dinero.md](./03-e2e-marketplace-dinero.md) | oferta, postulacion, pago, viaje, POD, wallet, retiro | el flujo marketplace cobra y paga bien |
| 4 | [04-e2e-wms-flota-privada.md](./04/04-e2e-wms-flota-privada.md) | bodega, stock, despacho, flota privada con/sin bodega, nomina, wallet, reportes | operacion privada funciona completa |
| 5 | [05-e2e-admin-ceo-pricing-reportes.md](./05-e2e-admin-ceo-pricing-reportes.md) | admin, CEO tower, pricing, paywalls, reportes, PDF | admin puede operar y vender piloto |
| 6 | [06-e2e-mobile-tracking-retencion.md](./06-e2e-mobile-tracking-retencion.md) | mobile, GPS, offline, score, notificaciones, landing | experiencia mobile y retencion listas |
| 7 | [07-e2e-seguridad-negativos.md](./07-e2e-seguridad-negativos.md) | ataques, acceso cruzado, lending pausado, secrets, rate limit | no hay fallas criticas de seguridad |

**Total: 7 documentos, 14 pruebas E2E grandes.**

## Regla de oro

- Si algo tiene dinero, revisa saldo antes y despues.
- Si algo tiene permisos, prueba un usuario permitido y uno bloqueado.
- Si algo envia link por email/WhatsApp, el link NO puede decir `localhost`.
- Si algo falla, no sigas como si nada: marca `FAIL` y toma screenshot.

## Go / No-Go

| Resultado | Decision |
|---|---|
| 14/14 PASS | Listo para piloto real controlado |
| 1 FAIL critico | No lanzar piloto todavia |
| BLOCKED por falta de datos | Preparar datos y repetir |
| FAIL de dinero, permisos, auth, storage o wallet | Bloqueante total |

## Bloqueantes que paran todo

- Link productivo abre `localhost`.
- Usuario de una empresa ve datos de otra.
- Camionero puede retirar mas plata de la disponible.
- Pago se duplica.
- Wallet no cuadra.
- Storage de fotos falla.
- Admin no puede diagnosticar pagos/retiros.
- Lending/adelantos aparecen activos con `lending_enabled=false`.
- Mobile no permite completar viaje con evidencia.

## Cobertura de sprints

| Sprints | Donde se prueban |
|---|---|
| 01 repo, 02 release, 15 confiabilidad, 26 infra | `01-preflight-automatico.md`, `07-e2e-seguridad-negativos.md` |
| 03 perimetro financiero, 05 API contracts, 06 pagos | `03-e2e-marketplace-dinero.md`, `07-e2e-seguridad-negativos.md` |
| 04 identity/security, 11 holding, 32 roles | `02-e2e-auth-roles-permisos.md`, `07-e2e-seguridad-negativos.md` |
| 07 marketplace, 09 wallet, 18 bugs piloto, 19 auth/storage, 20 payouts | `03-e2e-marketplace-dinero.md` |
| 08 WMS, 16 flota privada, 22 finanzas flota, 23 WMS a viaje | `04/04-e2e-wms-flota-privada.md` |
| 10 lending legacy, 21 lending pausado | `07-e2e-seguridad-negativos.md` |
| 12 admin, 24 CEO tower, 27 pricing, 29 inteligencia/PDF | `05-e2e-admin-ceo-pricing-reportes.md` |
| 13 GTM, 14 regionalizacion, 17 estrategia final, 28 QA master | Todos los E2E, especialmente README + 01 + 05 |
| 25 retencion, 30 tracking PWA, 31 home comercial | `01-preflight-automatico.md`, `06-e2e-mobile-tracking-retencion.md` |

## Como saber que ya esta listo

KargaX queda listo para probar con usuarios reales de piloto cuando:

- `01-preflight-automatico.md` pasa sin FAIL.
- Los E2E de dinero (`03`) y flota/WMS/nomina privada (`04`) pasan completos.
- Seguridad negativa (`07`) pasa sin fugas de datos.
- Los 14 E2E tienen evidencia guardada.

Eso no significa "nunca habra bugs"; significa que ya paso el filtro serio para empezar piloto controlado con monitoreo.
