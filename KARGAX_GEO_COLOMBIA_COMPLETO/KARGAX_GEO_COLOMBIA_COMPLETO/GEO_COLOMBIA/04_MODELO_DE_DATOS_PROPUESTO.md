# 04 · Modelo de datos propuesto

## Tablas finales

### `geo_departments`

- `id uuid pk`
- `country_code text default 'CO'`
- `divipola_code text`
- `name text`
- `normalized_name text`
- `is_capital_district boolean`
- `is_active boolean`
- `created_at`, `updated_at`

### `geo_municipalities`

- `id uuid pk`
- `department_id uuid fk geo_departments`
- `country_code text default 'CO'`
- `divipola_code text`
- `name text`
- `normalized_name text`
- `type: municipio | distrito | area_no_municipalizada`
- `is_capital boolean`
- `is_active boolean`
- `created_at`, `updated_at`

### `geo_local_zones`

- `id uuid pk`
- `department_id uuid fk geo_departments`
- `municipality_id uuid fk geo_municipalities`
- `divipola_code text nullable`
- `name text`
- `normalized_name text`
- `zone_type`
- `source`
- `source_url`
- `confidence numeric`
- `is_user_submitted boolean`
- `needs_review boolean`
- `created_by uuid nullable`
- `is_active boolean`
- `created_at`, `updated_at`

### `geo_aliases`

Permite mapear legacy text y errores comunes: `Bogota`, `Bogotá DC`, `Cartagena de Indias`, etc.

### `geo_seed_versions`

Auditoría de fuente, checksum y conteos.

## Columnas legacy compatibles

Se agregan columnas opcionales sin borrar datos:

- `business_profiles.department_id`, `municipality_id`, `local_zone_id`, `*_legacy`, `address_reference`.
- `cargo_offers.origin_department_id`, `origin_municipality_id`, `origin_local_zone_id`, `origin_zone_name_legacy`, `origin_address_reference`.
- `cargo_offers.destination_*` equivalente.
- `warehouses.department_id`, `municipality_id`, `local_zone_id`, `local_zone_name_legacy`, `address_reference`.

## RLS

- Catálogos globales: lectura pública segura para `anon` y `authenticated`.
- Escritura de catálogos: service role/admin.
- Input manual de zona: `authenticated` puede insertar solo si `is_user_submitted=true`, `needs_review=true`, `source='user_input'`, `created_by=auth.uid()`.

## Validación

Función `geo_validate_location(department_id, municipality_id, local_zone_id)`:

- Rechaza municipio sin departamento.
- Rechaza municipio de otro departamento.
- Rechaza zona interna de otro municipio.
- Permite zona `NULL`.
