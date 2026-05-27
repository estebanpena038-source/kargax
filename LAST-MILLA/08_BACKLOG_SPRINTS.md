# 08 — Backlog por sprints

## Sprint 0 — Preparación

### Objetivo

Dejar listo el dominio sin tocar dinero.

### Tareas

- Revisar carpeta `LAST-MILLA/`.
- Copiar SQL draft a migración real.
- Ajustar nombres si el repo usa otra convención.
- Ejecutar migration en local/staging.
- Confirmar `billing_plans.feature_matrix`.

### Done

- Tablas creadas.
- RLS activo.
- Enterprise flag activo.
- No se rompe build.

## Sprint 1 — Contratos base

### Objetivo

Permitir crear proveedores, rutas y contratos.

### Tareas

- Crear tipos TS.
- Crear service access/feature gate.
- Crear endpoints carriers/lanes/contracts.
- Crear UI tab Contratos.
- Auditar cambios.

### Done

- Owner crea contrato.
- Contrato genera event.
- Contract list respeta business scope.
- Roles no autorizados bloqueados.

## Sprint 2 — Sync de observaciones

### Objetivo

Convertir viajes existentes en snapshots de costo.

### Tareas

- Implementar `syncLastMileObservations`.
- Resolver carrier.
- Resolver lane.
- Resolver contrato activo.
- Calcular costos.
- Guardar observation idempotente.
- Crear `analysis_run`.

### Done

- Sync del mes procesa viajes.
- Repetir sync no duplica.
- Wallet no cambia.

## Sprint 3 — Scorecards y recomendaciones

### Objetivo

Generar decisiones accionables.

### Tareas

- Agrupar observations por carrier.
- Calcular score.
- Crear score snapshot.
- Crear recomendaciones con dedupe.
- UI Proveedores/Renegociaciones.

### Done

- Proveedor con sobrecosto genera alerta.
- Recomendación se puede reconocer/cerrar.
- No hay duplicados.

## Sprint 4 — Dashboard ejecutivo

### Objetivo

Mostrar control de margen como producto vendible.

### Tareas

- KPIs.
- Top rutas.
- Top proveedores.
- Alertas críticas.
- Export básico.
- Empty states.
- Paywall.

### Done

- CEO/owner entiende fuga estimada.
- CTA claro: crear contrato / sync / renegociar.

## Sprint 5 — Comercial + Enterprise

### Objetivo

Convertir módulo en upgrade/revenue.

### Tareas

- Actualizar planes.
- Actualizar COMMERCIAL.
- Crear demo script.
- Crear checklist piloto enterprise.
- Crear KPI de activación.

### Done

- Pitch listo.
- Plan Enterprise muestra feature.
- Demo con 3 rutas y 3 proveedores.

## Sprint 6 — Automatización controlada

### Objetivo

Pasar de sync manual a job.

### Tareas

- Crear ruta internal job protegida con `INTERNAL_API_KEY`.
- Recalcular al cierre de viaje o diariamente.
- Notificar alertas críticas.

### Done

- Job idempotente.
- No bloquea pagos.
- No rompe operaciones.

## No implementar todavía

- IA que auto-renegocia.
- Cambios automáticos de tarifa.
- Payouts basados en score.
- Penalizaciones automáticas al conductor.
- Wallet balance por fuga estimada.
