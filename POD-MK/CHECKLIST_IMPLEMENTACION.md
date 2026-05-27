# Checklist implementación POD-MK

## Crear

- [ ] `frontend/src/lib/pod-marketplace/index.ts`
- [ ] `frontend/src/lib/pod-marketplace/types.ts`
- [ ] `frontend/src/lib/pod-marketplace/api.ts`
- [ ] `frontend/src/app/pod-marketplace/page.tsx`
- [ ] `frontend/src/app/pod-marketplace/[offerId]/page.tsx`
- [ ] `frontend/src/app/pod-marketplace/[offerId]/components.tsx`

## Modificar

- [ ] `frontend/src/app/inspecciones/page.tsx` -> redirect
- [ ] `frontend/src/app/inspecciones/[offerId]/page.tsx` -> redirect
- [ ] `frontend/src/components/layouts/DashboardLayout.tsx` -> nav `Evidencia Digital MK`
- [ ] `frontend/public/locales/es-CO/common.json` -> nav key
- [ ] `frontend/public/locales/en/common.json` -> nav key
- [ ] `frontend/public/locales/pt-BR/common.json` -> nav key
- [ ] `frontend/src/app/ofertas/mis-ofertas/page.tsx` -> CTA evidencia

## No tocar

- [ ] `frontend/src/app/api/business/fleet/signatures/route.ts`
- [ ] `frontend/src/components/trips/TripSignatureCapture.tsx`
- [ ] `frontend/src/lib/private-fleet/**`
- [ ] `frontend/src/app/dashboard/flota/page.tsx`
- [ ] Wallet/billing/Mercado Pago

## Validar

- [ ] Filtro `neq('is_private_fleet', true)` en lista
- [ ] Filtro `neq('is_private_fleet', true)` en detalle
- [ ] Error `PRIVATE_FLEET_ROUTE_NOT_ALLOWED`
- [ ] Redirects legacy
- [ ] QA con ruta privada
- [ ] QA con ruta marketplace
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run check`
