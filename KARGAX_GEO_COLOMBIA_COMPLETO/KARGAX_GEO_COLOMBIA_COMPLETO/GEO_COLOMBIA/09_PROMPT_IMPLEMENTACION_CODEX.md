# 09 · Prompt implementación Codex

Aplica la entrega `KARGAX_GEO_COLOMBIA_COMPLETO` en el repo `estebanpena038-source/kargax`.

Objetivo: centralizar cobertura geográfica de Colombia con Supabase, seeds oficiales DANE/DIVIPOLA, APIs Next.js y componente `LocationSelector`, sin borrar legacy ni tocar wallet/billing.

Pasos:

1. Copia carpetas `supabase/`, `frontend/`, `scripts/`, `PATCHES/` al root del repo.
2. Aplica patches en orden descrito en `PATCHES/README.md`.
3. Si un patch no aplica por drift, conserva intención: mantener text legacy y agregar IDs `departmentId`, `municipalityId`, `localZoneId`.
4. Ejecuta:

```bash
cd frontend
npm install
npm run typecheck
npm run lint
npm run build
```

5. Corrige imports no usados.
6. No cambies `trip_financial_allocations`, Mercado Pago, wallet, billing o RLS de negocio.
7. Documenta cualquier ajuste manual en `GEO_COLOMBIA/11_REPORTE_PRUEBAS.md`.

Criterios de aceptación:

- `LocationSelector` compila.
- `/api/geo/departments`, `/api/geo/municipalities`, `/api/geo/local-zones`, `/api/geo/validate` compilan.
- Migración es no destructiva.
- Seeds son idempotentes.
- Onboarding, bodegas y ofertas siguen guardando legacy text.
