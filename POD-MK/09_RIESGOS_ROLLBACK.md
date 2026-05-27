# 09 — Riesgos y rollback

## Riesgos altos

### 1. RLS / multiempresa

Riesgo: una empresa podría ver evidencia de otra si el filtro o RLS está mal.

Mitigación:

- Filtrar por `business_id`.
- Mantener RLS existente.
- Considerar RPC con checks explícitos si hay duda.
- QA con dos empresas diferentes.

### 2. Mezcla privada vs marketplace

Riesgo: rutas privadas aparecen en POD-MK.

Mitigación:

- `.neq('is_private_fleet', true)` en lista y detalle.
- Error específico `PRIVATE_FLEET_ROUTE_NOT_ALLOWED`.
- QA con ruta privada real.

### 3. Wallet / liquidaciones

Riesgo: tocar cierre POD podría disparar pagos o afectar liquidación.

Mitigación:

- Este proyecto solo cambia lectura/reporting.
- No modificar RPCs de pago.
- No modificar Mercado Pago.
- No modificar wallet.

### 4. Links viejos

Riesgo: usuarios con links `/inspecciones/[offerId]` quedan en 404.

Mitigación:

- Redirect legacy a `/pod-marketplace/[offerId]`.

### 5. i18n incompleto

Riesgo: menú muestra `nav.podMarketplace` si falta traducción.

Mitigación:

- Actualizar `es-CO`, `en`, `pt-BR`.
- Mantener fallbackLabel en DashboardLayout.

## Riesgos medios

### 1. TypeScript por renombres

Mitigación:

- Primero copiar módulo y usar aliases.
- Luego renombrar gradualmente.
- Correr `npm run typecheck`.

### 2. Performance galería

Mitigación:

- Mantener `loading="lazy"`.
- Limitar lista a 50 inicialmente.
- Agregar paginación después si hace falta.

### 3. Rutas sin transportador asignado

Mitigación:

- Mostrar `Conductor` como fallback.
- No romper si `assigned_trucker_id` es null.

## Rollback rápido

Si algo falla en producción:

1. Cambiar sidebar de vuelta a `/inspecciones`.
2. Mantener `/pod-marketplace` sin enlace público mientras se corrige.
3. Revertir CTA en `Mis Ofertas`.
4. Dejar redirects solo si no rompen.
5. No tocar base de datos si solo se hicieron cambios frontend.

## Rollback de migración opcional

Si se agregaron índices, no hace falta rollback funcional. Pero si se requiere:

```sql
drop index if exists public.idx_cargo_offers_pod_marketplace_business_status_created;
drop index if exists public.idx_picking_events_offer_created_at;
drop index if exists public.idx_offer_applications_offer_trucker_status;
```

## Señales de alerta en QA

- Una ruta privada aparece en `/pod-marketplace`.
- El detalle muestra firma privada.
- El botón de evidencia aparece en rutas draft/active sin operación.
- El menú sigue diciendo “Inspecciones”.
- `npm run typecheck` falla por tipos `Inspection*` mezclados.
- El build falla por rutas dinámicas legacy.
- Una empresa puede abrir oferta de otra empresa.
