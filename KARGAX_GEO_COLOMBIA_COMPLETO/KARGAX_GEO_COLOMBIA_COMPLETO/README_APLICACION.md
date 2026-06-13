# KARGAX GEO Colombia Completo

Entrega técnica para cobertura nacional de Colombia en KargaX.

## Contenido

- `GEO_COLOMBIA/`: investigación, auditoría, riesgos, QA, staging, producción y rollback.
- `supabase/migrations/041_geo_colombia_catalogs.sql`: migración no destructiva.
- `scripts/geo/`: seed, verify, diff, validate y export.
- `frontend/src/lib/geo/`: tipos, API client y helpers server.
- `frontend/src/app/api/geo/`: endpoints de catálogos.
- `frontend/src/components/location/LocationSelector.tsx`: selector reutilizable.
- `PATCHES/`: cambios propuestos para integrar en pantallas existentes.
- `seeds/geo/official-source-manifest.json`: manifiesto de fuentes.

## Orden de aplicación

```bash
git checkout -b feat/geo-colombia-catalogs
cp -R KARGAX_GEO_COLOMBIA_COMPLETO/* .

git apply PATCHES/frontend_package_json_geo_scripts.patch
git apply PATCHES/onboarding_locationselector.patch
git apply PATCHES/api_onboarding_geo_columns.patch
git apply PATCHES/warehouses_locationselector.patch
git apply PATCHES/api_warehouses_geo_columns.patch
git apply PATCHES/offers_publish_geo_locationselector.patch
git apply PATCHES/api_offers_geo_columns.patch
```

Luego revisar imports, resolver drift de patches, correr typecheck/build y migrar staging.

## Principio de seguridad

No borra datos. No toca wallet, billing, Mercado Pago ni liquidaciones. Mantiene campos legacy y agrega IDs oficiales como adopción gradual.
