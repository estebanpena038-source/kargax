# supabase/AGENTS.md â€” Reglas DB/RLS/migraciones para KargaX

## Fuente de verdad

`supabase/migrations/` es la historia oficial de base de datos. No editar migraciones antiguas.

## Reglas de migraciÃ³n

- Crear una migraciÃ³n nueva para schema/data change.
- Migraciones deben ser idempotentes cuando sea razonable.
- Mantener nombres claros: `YYYYMMDD_descripcion.sql`.
- Incluir rollback conceptual en la PR/respuesta.
- Validar RLS/multiempresa.
- No insertar secretos.

## Tablas sensibles

Alto riesgo:

- billing/plans/subscriptions/paywall events;
- wallet/transactions/payouts;
- profiles/business/team roles;
- offers/trips/POD/evidence;
- `last_mile_*`;
- storage/evidence buckets.

## LAST-MILLA

LAST-MILLA escribe Ãºnicamente tablas `last_mile_*`. No debe modificar balances, transactions, payouts, Mercado Pago ni webhooks de pago.

Si agregas o cambias Last-Mile:

1. Nueva migraciÃ³n en `supabase/migrations/`.
2. RLS por `business_id`.
3. Ãndices por `business_id`, periodo, carrier/lane/contract segÃºn consulta.
4. AuditorÃ­a `created_by`, `updated_by`, timestamps cuando aplique.
5. No mezclar datos entre empresas.
6. Seed/feature matrix de planes si cambia acceso.

## Checks

```bash
npm run supabase:inspect
npm run supabase:auth-url-check
npm run security:audit
npm run check:release
```

## Red flags

- MigraciÃ³n vieja editada.
- `rol de servicio de Supabase` expuesto.
- RLS deshabilitada sin justificaciÃ³n.
- `business_id` nullable sin razÃ³n.
- Tabla financiera tocada por Last-Mile.
- Paywall o plan limits desalineados con UI.
