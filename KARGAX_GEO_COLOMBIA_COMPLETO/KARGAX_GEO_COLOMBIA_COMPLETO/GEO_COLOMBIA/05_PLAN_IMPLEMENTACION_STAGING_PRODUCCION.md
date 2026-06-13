# 05 · Plan implementación staging + producción

## Staging

1. Crear rama:

```bash
git checkout -b feat/geo-colombia-catalogs
```

2. Copiar archivos del ZIP al repo.
3. Aplicar patches en orden:

```bash
git apply PATCHES/frontend_package_json_geo_scripts.patch
git apply PATCHES/onboarding_locationselector.patch
git apply PATCHES/api_onboarding_geo_columns.patch
git apply PATCHES/warehouses_locationselector.patch
git apply PATCHES/api_warehouses_geo_columns.patch
git apply PATCHES/offers_publish_geo_locationselector.patch
git apply PATCHES/api_offers_geo_columns.patch
```

4. Migración en staging:

```bash
supabase link --project-ref <STAGING_PROJECT_REF>
supabase db push --dry-run
supabase db push
```

5. Seed staging:

```bash
cd frontend
npm install
SUPABASE_URL="https://<staging>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<staging-service-role>" npm run seed:geo -- --dry-run

SUPABASE_URL="https://<staging>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<staging-service-role>" npm run seed:geo

SUPABASE_URL="https://<staging>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<staging-service-role>" npm run verify:geo
```

6. Validación funcional staging:

- Crear empresa con departamento/municipio no incluido antes en `MAJOR_CITIES`.
- Crear bodega en municipio pequeño.
- Crear oferta con origen/destino de departamentos distintos.
- Confirmar que no aparece municipio de otro departamento.
- Escribir barrio/vereda manual cuando no aparezca.
- Editar entidad legacy y confirmar que no borra datos existentes.

## Producción

1. Congelar deploy actual y tomar backup Supabase.
2. Ejecutar migración con ventana controlada:

```bash
supabase link --project-ref <PROD_PROJECT_REF>
supabase db push --dry-run
supabase db push
```

3. Ejecutar seed con service role de producción:

```bash
cd frontend
SUPABASE_URL="https://<prod>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<prod-service-role>" npm run seed:geo -- --dry-run

SUPABASE_URL="https://<prod>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<prod-service-role>" npm run seed:geo

SUPABASE_URL="https://<prod>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<prod-service-role>" npm run verify:geo
```

4. Comparar staging vs producción:

```bash
SUPABASE_URL="https://<prod>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<prod-service-role>" npm run export:geo
SUPABASE_URL="https://<prod>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<prod-service-role>" npm run diff:geo
```

5. Deploy frontend/API.
6. Activar monitoreo de errores en `/api/geo/*`, `/api/offers`, `/api/warehouses`, `/api/onboarding/complete`.

## No hacer en producción

- No borrar columnas legacy.
- No reemplazar masivamente texto histórico sin reporte de mapping.
- No tocar wallet, billing, Mercado Pago ni liquidaciones.
- No bloquear creación por barrio ausente.
