# 07 · Riesgos RLS + multiempresa

## Riesgo alto

| Área | Riesgo | Mitigación |
|---|---|---|
| RLS | Exponer datos privados si catálogos se mezclan con tenants | Catálogos `geo_*` son globales, sin `business_id` ni datos privados |
| Multiempresa | Bodegas/ofertas pertenecen a empresas | No se modifican políticas existentes de `cargo_offers` ni `warehouses` |
| Billing/planes | Crear bodegas/ofertas llama límites de plan | No se toca lógica de plan limits; solo ubicación |
| Wallet/liquidaciones | API offers crea allocations para flota privada | No se cambia `trip_financial_allocations`; marcar como zona prohibida para esta entrega |
| Producción | Migración sobre tablas activas | Solo `ADD COLUMN IF NOT EXISTS`; no destructive changes |
| Legacy | Datos texto históricos | Mantener campos legacy y mapear gradualmente |
| Input manual | Basura/SQL injection | Sanitizar texto, limitar longitud, usar Supabase parameterized API |

## Políticas RLS propuestas

- `geo_departments`: SELECT a anon/authenticated si `is_active=true`.
- `geo_municipalities`: SELECT a anon/authenticated si `is_active=true`.
- `geo_local_zones`: SELECT a anon/authenticated si `is_active=true`.
- `geo_local_zones`: INSERT authenticated solo para user input pendiente de revisión.
- Escritura oficial por service role/admin interno.

## No mezclar tenants

Los catálogos geográficos no deben tener `business_id`. Los datos manuales de barrio/vereda se guardan con `created_by` solo para trazabilidad, no para filtrar catálogo oficial.
