# 03 · Datos actuales vs datos faltantes

## Datos actuales encontrados

- Departamentos: existen en frontend con códigos internos de 3 letras y código DANE de departamento.
- Municipios/ciudades: existe solo `MAJOR_CITIES`, aproximado a 50 ciudades principales.
- Bodegas: usan país/subdivisión/ciudad desde constants multi-país, pero Colombia hereda el subset incompleto.
- Ofertas/viajes: origen y destino se guardan como texto (`origin_department`, `origin_city`, `origin_address`, etc.).
- Onboarding empresa: guarda `department`, `city`, `address` como texto.
- Zona interna: no existe modelo centralizado para barrio/localidad/vereda/sector.

## Faltantes

| Categoría | Estado actual | Necesario |
|---|---|---|
| Departamentos | 33 hardcodeados en frontend | DB global + seed versionado |
| Municipios oficiales | Subset `MAJOR_CITIES` | Todos los municipios/distritos/áreas oficiales DIVIPOLA |
| Centros poblados | No centralizado | Cargar si fuente DANE/Geoportal verificada |
| Barrios | No centralizado | Solo fuente municipal oficial + input manual |
| Relación depto/municipio | Parcial en hardcode | FK real `municipality.department_id` |
| Relación municipio/zona | No existe | FK real `local_zone.municipality_id` |
| Validación API | Texto libre/fallback | `geo_validate_location` + fallback legacy |
| Seeds | No existen | `seed:geo`, `verify:geo`, `diff:geo`, `validate:geo`, `export:geo` |
| Staging/producción | No documentado | Plan seguro con rollback |

## Departamentos faltantes

No faltan departamentos en el hardcode principal, pero están en frontend y no en DB. La deuda no es de conteo de departamentos, sino de arquitectura, fuente de verdad y municipios incompletos.

## Municipios faltantes

Faltan todos los municipios que no estén en `MAJOR_CITIES`. Con el estado actual, KargaX no puede crear rutas o bodegas en la mayoría de municipios del país usando select dependiente.

## Duplicados / dispersión

`frontend/src/constants/countries/data-co.ts` no duplica a mano, pero puentea hacia `frontend/src/constants/colombia.ts`; por tanto el subset incompleto se reutiliza en varios módulos.
