# 08 · Rollback y recuperación

## Rollback recomendado

1. Revertir deploy frontend/API.
2. Mantener tablas `geo_*` en DB: no afectan operación legacy.
3. Si el problema es seed, desactivar `is_active` de filas problemáticas o restaurar backup del catálogo.
4. Solo ejecutar rollback destructivo si hay backup y ventana aprobada.

## Comandos de seguridad

Exportar antes de producción:

```bash
cd frontend
SUPABASE_URL="https://<prod>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<prod-service-role>" npm run export:geo
```

Verificar antes de rollback:

```sql
select count(*) from public.geo_departments;
select count(*) from public.geo_municipalities;
select count(*) from public.geo_local_zones;
select count(*) from public.cargo_offers where origin_department_id is not null or destination_department_id is not null;
select count(*) from public.warehouses where department_id is not null or municipality_id is not null;
```

## Rollback DB

Archivo incluido:

- `supabase/migrations/041_geo_colombia_catalogs_ROLLBACK.sql`

Está comentado por seguridad. Requiere decisión manual porque puede destruir catálogo y columnas nuevas.
