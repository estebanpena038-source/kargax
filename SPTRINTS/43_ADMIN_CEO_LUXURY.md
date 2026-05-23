# Sprint 43: Admin + CEO Luxury

## Estado

- artifact status: `implemented`
- prioridad: alta para operacion interna
- rutas: `/admin`, `/admin/ceo`

## Objetivo

Crear una torre de control interna que se sienta como poder absoluto con calma: incidentes, pagos, soporte, readiness, tesoreria y CEO overview deben estar ordenados por prioridad real.

## `/admin`

- Layout:
  - header `Operaciones KargaX`.
  - launch readiness arriba.
  - dominios: pagos, wallet, trips, soporte, bodegas.
  - incidentes y runbooks.
  - admin actions abajo.
- Reglas:
  - no usar color para salud; usar label `OK`, `Atencion`, `Bloqueado`.
  - riesgos criticos arriba.
  - tablas con densidad controlada.
- QA:
  - admin-only access intacto.
  - acciones admin no cambian payload.

## `/admin/ceo`

- Layout:
  - vista CEO KargaX como tablero ejecutivo.
  - KPIs: GMV, fee, viajes, payouts, incidentes, aprobaciones.
  - balance de dinero con mono font.
  - lista de riesgos con decision sugerida.
- Microcopy:
  - directo y ejecutivo.
  - nada de marketing interno.
- QA:
  - `/api/admin/ceo-overview` intacto.
  - loading/error monocromo.
  - mobile conserva prioridad.

## Definition of Done

- Admin y CEO pueden decidir rapido.
- La UI da poder sin ansiedad.
- Riesgo operativo no se esconde por estetica.

## Implementacion

- `/admin` reordenado con launch readiness arriba, riesgos criticos visibles, dominios pagos/wallet/trips/soporte/bodegas, incidentes/runbooks y acciones admin al final.
- `/admin/ceo` convertido en tablero ejecutivo con KPIs de GMV, fee, viajes, payouts, incidentes y aprobaciones.
- `/api/admin/ceo-overview` se conserva y suma lectura aditiva de aprobaciones pendientes, criticas, vencidas y due soon.
- QA local ejecutado sin build: `npm run typecheck` y ESLint dirigido sobre archivos del sprint 43.
