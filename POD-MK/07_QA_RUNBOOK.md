# 07 — QA Runbook POD-MK

## Pruebas automáticas

Desde `frontend/`:

```bash
npm run lint
npm run typecheck
npm run build
npm run check
```

Si el release está cerca:

```bash
npm run check:release
npm run smoke:release
npm run visual:qa
```

## QA manual por rol

### Business con rutas marketplace

1. Iniciar sesión como empresa.
2. Abrir `/pod-marketplace`.
3. Validar título: `Evidencia digital Marketplace`.
4. Validar que salen rutas públicas con evidencia.
5. Entrar a una ruta.
6. Validar secciones:
   - Resumen operativo.
   - Manifiesto de ruta pública.
   - Evidencia fotográfica del POD.
   - Cadena de custodia marketplace.
7. Validar fotos, cantidades, rechazos y notas.

### Business con rutas privadas

1. Tener al menos una ruta privada con evidencia.
2. Abrir `/pod-marketplace`.
3. Validar que la ruta privada NO aparece.
4. Intentar `/pod-marketplace/[privateOfferId]`.
5. Resultado esperado:
   - error `PRIVATE_FLEET_ROUTE_NOT_ALLOWED`, o
   - mensaje: `Esta evidencia pertenece a una ruta privada. Revísala desde Flota privada.`

### Admin

1. Abrir `/pod-marketplace`.
2. Validar si admin debe ver todas o solo bajo filtros internos.
3. Confirmar que privadas no aparecen.

### Trucker marketplace

1. Aceptar una oferta pública.
2. Ir a `/viaje/[offerId]/carga`.
3. Registrar GPS, manifiesto, fotos y PIN.
4. Ir a `/viaje/[offerId]/entrega`.
5. Registrar entrega, fotos, novedades y PIN.
6. Validar que empresa ve evidencia en `/pod-marketplace/[offerId]`.

### Trucker privado

1. Abrir `/viajes-asignados`.
2. Confirmar que ese flujo sigue intacto.
3. No debe aparecer acceso a `/pod-marketplace` como evidencia privada.

## QA de redirects

```txt
/inspecciones              -> /pod-marketplace
/inspecciones/[offerId]    -> /pod-marketplace/[offerId]
```

Validar:

1. No hay 404.
2. No hay loop de redirects.
3. Links viejos enviados por usuarios siguen funcionando.

## QA de Mis Ofertas

Archivo afectado:

```txt
frontend/src/app/ofertas/mis-ofertas/page.tsx
```

Validar:

| Estado | Botón Evidencia |
|---|---:|
| `draft` | No |
| `active` | No |
| `reserved` | Sí |
| `in_progress` | Sí |
| `completed` | Sí |
| `cancelled` | No por defecto |
| `expired` | No |

## QA de no mezcla privada

Buscar en archivos nuevos:

```bash
grep -R "trip_signature_evidences\|business/fleet/signatures\|private_fleet_assignment_status\|payroll" frontend/src/app/pod-marketplace frontend/src/lib/pod-marketplace
```

Resultado esperado: vacío.

Buscar filtro marketplace:

```bash
grep -R "is_private_fleet" frontend/src/lib/pod-marketplace
```

Resultado esperado: aparece en `api.ts` lista y detalle.

## QA de performance

Con una empresa que tenga 50+ rutas:

1. Abrir `/pod-marketplace`.
2. La lista debe cargar en menos de 2 segundos en conexión normal.
3. Galería no debe bloquear render inicial.
4. Fotos deben usar lazy loading.

## Criterios de aceptación

- [ ] `npm run lint` pasa.
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` pasa.
- [ ] `/pod-marketplace` existe.
- [ ] `/inspecciones` redirige.
- [ ] Menú dice `Evidencia Digital MK`.
- [ ] Rutas privadas no salen.
- [ ] Detalle privado se bloquea.
- [ ] No se toca wallet/Mercado Pago.
- [ ] No se toca endpoint de firmas privadas.
- [ ] Mis Ofertas tiene CTA de evidencia para rutas operativas.
