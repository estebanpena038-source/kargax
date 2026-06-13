# Patches de integración

Estos patches son intencionalmente no destructivos: mantienen los campos legacy `department`, `city`, `address` y agregan IDs oficiales cuando las migraciones ya existen.

Orden recomendado:

1. Aplicar `frontend_package_json_geo_scripts.patch`.
2. Agregar los archivos nuevos de `frontend/src/lib/geo`, `frontend/src/app/api/geo` y `frontend/src/components/location`.
3. Aplicar integración por flujo:
   - `onboarding_locationselector.patch` + `api_onboarding_geo_columns.patch`.
   - `warehouses_locationselector.patch` + `api_warehouses_geo_columns.patch`.
   - `offers_publish_geo_locationselector.patch` + `api_offers_geo_columns.patch`.
4. Ajustar manualmente imports no usados que queden por el tamaño de las pantallas actuales.
5. Correr `npm run typecheck`, `npm run lint`, `npm run build`.

No tocar `trip_financial_allocations`, wallet, billing o Mercado Pago en esta entrega.
