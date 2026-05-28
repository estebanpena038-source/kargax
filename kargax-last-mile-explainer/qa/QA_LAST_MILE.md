# QA — Last Mile explicado claro

## Unit QA visual

- [ ] La card “Last Mile convierte viajes en decisiones” aparece arriba de KPIs.
- [ ] Se muestran badges: Last Mile, mes, estado, solo lectura si aplica.
- [ ] Se muestran contadores “Viajes del mes” y “Analizados”.
- [ ] El copy no menciona wallet como algo que se modifica.
- [ ] El botón principal dice “Recalcular viajes del mes” cuando hay viajes sin analizar.

## Casos principales

### Empresa con 26 viajes y 0 analizados

Resultado esperado:

- [ ] Título: “26 viajes listos para analizar”.
- [ ] CTA: “Recalcular viajes del mes”.
- [ ] Nota: no toca wallet/pagos/liquidaciones/marketplace.

### Empresa con 26 viajes y 10 analizados

Resultado esperado:

- [ ] Título: “10 de 26 viajes analizados”.
- [ ] CTA: “Actualizar análisis”.

### Empresa con 26 viajes y 26 analizados

Resultado esperado:

- [ ] Título: “Last Mile actualizado”.
- [ ] CTA secundario: “Recalcular si cambió algo”.

### Empresa sin viajes

Resultado esperado:

- [ ] Título: “Aún no hay viajes para analizar”.
- [ ] CTA deshabilitado.

## Roles

- [ ] Owner puede recalcular si el plan lo permite.
- [ ] Manager puede recalcular si el plan lo permite.
- [ ] Finance puede recalcular si el server lo permite.
- [ ] Viewer ve explicación pero no recalcula.
- [ ] Trucker no accede a Control de margen.

## Seguridad

- [ ] No se envía `businessId` libre desde UI nueva.
- [ ] No se crea endpoint nuevo.
- [ ] No se crea migración.
- [ ] No se toca wallet.
- [ ] No se toca billing.
- [ ] No se toca Mercado Pago.
- [ ] No se toca RLS.

## Regresión

```bash
npm run lint
npm run typecheck
npm run build
npm run check
```
