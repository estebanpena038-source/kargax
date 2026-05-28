# Implementación de Last Mile explicado claro

## Diagnóstico

Last Mile ya existe en KargaX, pero está presentado como **Control de margen** y no como una explicación operativa clara para el usuario. El problema real es de UX/copy: una empresa puede tener 26 viajes y no entender por qué no ve análisis si todavía no se recalculó el periodo.

## Decisión CTO

Implementar una capa explicativa segura, sin tocar lógica crítica:

1. Mostrar qué hace Last Mile.
2. Mostrar cuántos viajes existen en el mes.
3. Mostrar cuántos ya fueron analizados.
4. Explicar que “recalcular” crea snapshots/análisis.
5. Aclarar que no toca wallet, pagos, liquidaciones ni marketplace.

## Archivos a editar

### `frontend/src/components/last-mile/LastMileDashboard.tsx`

Inserta `LastMileExplainer` después del hero y antes de KPIs.

### `frontend/src/components/last-mile/LastMileEmptyState.tsx`

Cambia copy técnico “snapshots” por copy operativo “análisis de margen”.

### `frontend/src/components/layouts/SIDEBAR/navigation.tsx`

Aclara que Control de margen es Last Mile: costo, margen, evidencia y proveedores por ruta.

## Archivos nuevos

### `frontend/src/components/last-mile/LastMileExplainer.tsx`

Responsabilidad: explicar Last Mile de forma simple y accionable.

### `frontend/src/lib/last-mile/copy.ts`

Responsabilidad: centralizar copy y estados de progreso.

## Base de datos

No requiere cambios de base de datos.

No se inventan tablas, columnas ni endpoints.

## Seguridad

No toca:

- wallet;
- billing;
- Mercado Pago;
- RLS;
- contratos server-side;
- recompute server-side;
- políticas multiempresa.

## QA manual recomendado

1. Entrar a `/dashboard/control-margen`.
2. Probar empresa con viajes y 0 análisis.
3. Validar que se entienda el mensaje “viajes listos para analizar”.
4. Presionar “Recalcular viajes del mes”.
5. Confirmar que el dashboard actualiza KPIs.
6. Confirmar que no se modifican wallet/pagos/liquidaciones.
7. Probar viewer/readOnly.
8. Probar empresa sin viajes.
9. Probar plan sin acceso Last Mile.

## Comandos

```bash
npm run lint
npm run typecheck
npm run build
npm run check
```
