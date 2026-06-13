# Scripts GEO Colombia

Ejecutar desde `frontend/` después de instalar dependencias:

```bash
cd frontend
npm install
SUPABASE_URL="https://..." SUPABASE_SERVICE_ROLE_KEY="..." npm run seed:geo
SUPABASE_URL="https://..." SUPABASE_SERVICE_ROLE_KEY="..." npm run verify:geo
SUPABASE_URL="https://..." SUPABASE_SERVICE_ROLE_KEY="..." npm run diff:geo
```

Los scripts son idempotentes: usan `upsert` por código DIVIPOLA y no duplican departamentos ni municipios si se ejecutan varias veces.

Variables útiles:

- `GEO_DIVIPOLA_URL`: URL JSON oficial si cambia la API de Datos Abiertos.
- `GEO_SOURCE_VERSION`: etiqueta de versión del seed.
- `GEO_EXPECTED_MUNICIPALITIES`: conteo exacto esperado cuando se congela una versión oficial.
- `GEO_EXPORT_OUT`, `GEO_DIFF_OUT`: rutas de salida para reportes.

No ejecutar en producción sin haber corrido primero `seed:geo -- --dry-run`, `verify:geo` y `diff:geo` en staging.
