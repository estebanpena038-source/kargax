# 00 · Resumen ejecutivo

## Decisión CTO

KargaX debe mover Colombia de listas hardcodeadas a catálogos geográficos normalizados en Supabase. La jerarquía correcta para operación logística en Colombia queda:

**Departamento → Ciudad o municipio → Barrio, localidad, vereda o sector opcional → Dirección exacta → Referencia para el conductor**

La implementación propuesta no borra datos existentes. Mantiene campos legacy de texto (`department`, `city`, `address`, `origin_department`, `origin_city`, etc.) y agrega IDs oficiales gradualmente.

## Problema encontrado

1. `frontend/src/constants/colombia.ts` declara departamentos y solo ciudades principales, no todos los municipios.
2. `frontend/src/constants/countries/data-co.ts` reutiliza ese subconjunto como catálogo multi-país, por lo que bodegas también quedan incompletas.
3. Onboarding, ofertas, bodegas y API de ofertas guardan ubicación como texto libre o códigos internos no oficiales.
4. No existe soporte centralizado para barrio/localidad/vereda/sector con fallback manual revisable.
5. No hay scripts `seed:geo`, `verify:geo`, `diff:geo`, `validate:geo` ni versionado de seed geográfico.

## Solución entregada

- Migración Supabase `041_geo_colombia_catalogs.sql`.
- Tablas globales públicas de lectura: `geo_departments`, `geo_municipalities`, `geo_local_zones`, `geo_aliases`, `geo_seed_versions`.
- Seeds idempotentes desde fuente oficial configurable: `scripts/geo/seed-geo-colombia.mjs`.
- Verificación, diff, validación y exportación.
- APIs Next.js para catálogos geográficos.
- Componente reutilizable `LocationSelector`.
- Patches de integración para onboarding, bodegas y ofertas.
- Plan de staging, producción, QA, rollback y riesgos.

## Estado de entrega

Este ZIP es una implementación lista para aplicar en una rama. No se aplicó directamente al repo remoto ni a producción. Tampoco se ejecutó contra Supabase real porque requiere credenciales `SUPABASE_SERVICE_ROLE_KEY` y entorno staging/producción.

## Recomendación CEO/CTO

Implementar primero en staging con solo departamentos/municipios oficiales. Activar zonas internas de forma progresiva: centros poblados/corregimientos desde DANE/Geoportal cuando el dataset oficial esté verificado y barrios/localidades/comunas solo por fuente municipal oficial.
