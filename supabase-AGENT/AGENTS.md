# supabase/AGENTS.md — Reglas para base de datos y migraciones

Estas reglas aplican dentro de `supabase/`.

## Fuente de verdad

`supabase/migrations/` es la historia oficial de la base de datos. No editar migraciones antiguas ya aplicadas. Crear siempre una migracion nueva para cambios de schema, datos seed, billing plans, RLS, funciones o indices.

## Reglas

- No borrar columnas o tablas sin plan de migracion y rollback.
- No debilitar RLS para "arreglar rapido".
- No exponer datos cross-company.
- No mezclar datos de empresas/usuarios sin filtros por business/company/owner.
- Los cambios de billing deben ser idempotentes cuando sea posible.
- Los seeds de planes deben usar upsert por `code`.
- Wallet/liquidaciones deben mantener auditoria y trazabilidad.

## Migraciones de pricing recomendadas

Cuando cambies planes:

1. Crear nueva migracion timestamped.
2. Upsert en `billing_plans` por `code`.
3. Actualizar precio COP, limites, tagline, soporte y `is_public`.
4. Verificar que `action_state`, checkout y plan actual no se rompan.
5. Documentar en `COMMERCIAL/` el cambio comercial.

## Checklist de seguridad

Antes de entregar migracion:

- ¿Respeta RLS?
- ¿Es idempotente?
- ¿Evita datos duplicados?
- ¿Tiene rollback conceptual?
- ¿No toca secretos?
- ¿No rompe planes activos?
