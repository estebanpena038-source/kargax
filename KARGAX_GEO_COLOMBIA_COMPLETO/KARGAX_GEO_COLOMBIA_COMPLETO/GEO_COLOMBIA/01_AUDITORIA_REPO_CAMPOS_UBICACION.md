# 01 · Auditoría repo · Campos de ubicación

## Alcance auditado

Se revisaron coincidencias de: departamento, ciudad, municipio, barrio, localidad, vereda, dirección/address, location, origen/origin, destino/destination, bodega/warehouse, ruta/route, viaje/trip, envío/shipment, pickup y delivery.

## Tabla de hallazgos principales

| Archivo | Bloque aproximado | Función afectada | Campo usa | Hardcodeado | DB | Incompleto | Riesgo | Acción recomendada |
|---|---:|---|---|---|---|---|---|---|
| `frontend/src/constants/colombia.ts` | 38-72 | Catálogo Colombia | Departamentos | Sí | No | Departamentos completos, municipios no | Medio | Mantener solo helpers legacy; fuente real debe ser DB |
| `frontend/src/constants/colombia.ts` | 75-146 | Catálogo Colombia | `MAJOR_CITIES` | Sí | No | Solo ciudades principales | Alto UX/operación | Reemplazar por `geo_municipalities` |
| `frontend/src/constants/colombia.ts` | 161-209 | Helpers | `getCitiesByDepartment` | Sí | No | Depende de `MAJOR_CITIES` | Alto | Migrar a API `/api/geo/municipalities` |
| `frontend/src/constants/countries/data-co.ts` | 3-13 | Multi-país | CO subdivisions/cities | Sí indirecto | No | Reusa subset incompleto | Alto | Para CO usar DB; dejar constants solo fallback |
| `frontend/src/app/onboarding/page.tsx` | 21-24 | Registro empresa | Importa constants | Sí | No | Ciudad incompleta | Alto onboarding | Reemplazar por `LocationSelector` |
| `frontend/src/app/onboarding/page.tsx` | 30-38 | Registro empresa | `address`, `department`, `city` | No | API posterior | No zona interna | Medio | Agregar IDs + legacy text |
| `frontend/src/app/onboarding/page.tsx` | 124-132 | Registro empresa | City options | Sí | No | Solo `MAJOR_CITIES` | Alto | API DB dependiente por departamento |
| `frontend/src/app/onboarding/page.tsx` | 241-260 | Form ubicación | Select departamento/ciudad | Sí | No | Sin barrio/vereda | Alto | Usar `LocationSelector` |
| `frontend/src/app/api/onboarding/complete/route.ts` | 7-16 | API onboarding | `department`, `city`, `address` | No | Sí | Texto legacy | Medio | Guardar IDs nuevos y fallback legacy |
| `frontend/src/app/ofertas/publicar/page.tsx` | 44-52 | Publicar oferta | Importa constants | Sí | No | Municipios incompletos | Alto | Reemplazar por selector DB |
| `frontend/src/app/ofertas/publicar/page.tsx` | 88-106 | Ruta oferta | Origen/destino | No | API posterior | Sin IDs/zona interna | Alto | Agregar IDs + zona manual opcional |
| `frontend/src/app/ofertas/publicar/page.tsx` | 192-205 | Validación ruta | Dep/ciudad/dirección | No | No | No valida relación oficial | Alto | Validar `departmentId` + `municipalityId` |
| `frontend/src/app/api/offers/route.ts` | 12 | API ofertas | Importa constants | Sí | No | Normaliza solo major cities | Alto | Resolver con DB/RPC sin romper legacy |
| `frontend/src/app/api/offers/route.ts` | 65-77 | Payload oferta | Origen/destino texto | No | Sí | Sin IDs oficiales | Alto | Insertar IDs nuevos cuando existan |
| `frontend/src/app/api/offers/route.ts` | 242-273 | Normalización | Departamento/ciudad | Sí | No | Fallback a token | Medio | Mantener fallback legacy + agregar DB validation |
| `frontend/src/app/api/offers/route.ts` | 146-244 | Insert payload | `cargo_offers` | No | Sí | Text columns | Alto | Migración no destructiva con FKs opcionales |
| `supabase/migrations/002_cargo_offers.sql` | 67-75 | Modelo ofertas | `origin_*`, `destination_*` | No | Sí | Texto, sin FK | Alto | Agregar columnas geo IDs sin borrar texto |
| `supabase/migrations/002_cargo_offers.sql` | 148-178 | RLS ofertas | RLS por usuario/empresa | No | Sí | Sensible | Alto RLS | No cambiar políticas de negocio |
| `frontend/src/app/bodegas/page.tsx` | 55-67 | Form bodegas | `department`, `city`, `address` | No | API posterior | Sin zona interna | Alto | Usar `LocationSelector` |
| `frontend/src/app/bodegas/page.tsx` | 165-181 | Form bodegas | Select subdivision/city | Sí indirecto | No | CO incompleto | Alto | API DB para Colombia |
| `frontend/src/app/bodegas/page.tsx` | 210-226 | GPS bodega | address/city/department | Texto | No | Depende de ciudad correcta | Alto operativo | Mantener GPS, alimentar nombres oficiales |
| `frontend/src/app/api/warehouses/route.ts` | 236-251 | API bodegas | `department`, `city`, `address` | No | Sí | Texto legacy | Alto | Agregar IDs opcionales |
| `frontend/src/app/api/warehouses/route.ts` | 253-267 | Validación bodegas | Requiere texto + coordenadas | No | Sí | No valida relación depto/municipio | Alto | Validar geo IDs sin bloquear legacy |
| `frontend/src/lib/warehouses/localization.ts` | 209-225 | Bodega options | `getSubdivisions/getCities` | Sí | No | CO hereda `MAJOR_CITIES` | Alto | Para CO usar API `geo_*` |

## Conclusión de auditoría

La deuda no está en una sola pantalla. El problema nace en el catálogo hardcodeado y se propaga a onboarding, ofertas, bodegas y normalización API. El cambio correcto es centralizar en DB y mantener legacy text para no romper edición ni datos productivos.
