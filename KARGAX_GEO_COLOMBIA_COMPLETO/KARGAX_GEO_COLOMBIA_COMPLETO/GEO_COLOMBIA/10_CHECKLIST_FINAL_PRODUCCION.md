# 10 · Checklist final producción

## Datos

- [ ] `geo_departments` tiene 33 activos.
- [ ] `geo_municipalities` tiene conteo oficial esperado o >= 1100 según versión consultada.
- [ ] 0 duplicados por DIVIPOLA.
- [ ] 0 municipios huérfanos.
- [ ] `geo_seed_versions` tiene checksum y conteos.
- [ ] Staging y producción coinciden por `diff:geo`.

## Frontend

- [ ] Onboarding empresa usa departamento → municipio dependiente.
- [ ] Crear bodega usa `LocationSelector`.
- [ ] Crear oferta usa selector separado para origen y destino.
- [ ] Si no hay barrio/vereda, permite input manual.
- [ ] No aparece municipio de otro departamento.
- [ ] Edición legacy no borra dirección previa.

## Backend

- [ ] `/api/geo/departments` responde 200.
- [ ] `/api/geo/municipalities?departmentId=` responde solo municipios de ese departamento.
- [ ] `/api/geo/local-zones?municipalityId=` responde zonas o arreglo vacío.
- [ ] `/api/geo/validate` rechaza mismatch.
- [ ] `/api/onboarding/complete` guarda legacy + IDs si columnas existen.
- [ ] `/api/offers` guarda legacy + IDs sin tocar allocations.
- [ ] `/api/warehouses` guarda legacy + IDs.

## Seguridad

- [ ] RLS permite lectura de catálogos.
- [ ] RLS no permite escritura de departamentos/municipios a usuarios normales.
- [ ] Zona manual queda `needs_review=true`.
- [ ] No se cambió wallet/billing/Mercado Pago.
- [ ] No se cambió RLS de `cargo_offers` o `warehouses` salvo catálogos nuevos.

## Deploy

- [ ] Backup producción listo.
- [ ] Migración dry-run revisado.
- [ ] Seed dry-run revisado.
- [ ] `verify:geo` OK.
- [ ] `diff:geo` OK.
- [ ] Rollback documentado.
