# Priorización CTO

## Decisión CTO

La primera capa de inteligencia de KargaX debe vender control operativo real, no prometer IA futurista. La recomendación es implementar en 30 días un **Intelligence OS determinístico, trazable y explicable** sobre Last Mile, evidencia digital y reportes ejecutivos.

No se debe empezar por ML pesado, optimización VRP completa, scoring financiero automático ni payouts inteligentes. La plataforma ya tiene módulos delicados —wallet, billing, RLS, Mercado Pago, flota privada y multiempresa— y la prioridad es sumar inteligencia sin romper confianza.

Decisión concreta:

1. P0: algoritmos visibles en demo y útiles en operación diaria.
2. P1: algoritmos que retienen porque el cliente vuelve todos los días.
3. P2: algoritmos avanzados cuando haya historial suficiente, QA estable y guardrails financieros.

## Algoritmos P0

Máximo 5 para implementar primero.

### 1. Recomendación de próxima mejor acción para operador

**Por qué primero:** convierte `/dashboard/inteligencia`, viajes y despacho en una torre de control. El usuario no solo ve datos: sabe qué hacer ahora.

**Módulos conectados:** Last Mile, roles, evidencia, tracking, WMS.

**MVP:** motor de reglas server-side que devuelve `action_label`, `action_reason`, `action_href`, `severity`, `source_id`.

**Archivos base:**

- `frontend/src/lib/server/warehouses.ts`
- `frontend/src/lib/business-roles.ts`
- `frontend/src/lib/server/trip-tracking.ts`
- `frontend/src/lib/warehouses/types.ts`
- `frontend/src/app/dashboard/inteligencia`

**Demo esperada:** “Estas son las 7 entregas que necesitan atención y esta es la acción recomendada para cada una”.

### 2. Score de riesgo de entrega fallida + alertas tempranas de retrasos

**Por qué primero:** es altamente vendible para Last Mile y se puede calcular con datos existentes: ventana, estado, tracking, evidencia, incidentes.

**MVP:** `delivery_intelligence_scores` con score 0-100, nivel `low/medium/high/critical`, razones y acción.

**Archivos base:**

- `frontend/src/app/api/offers/route.ts`
- `frontend/src/lib/server/trip-tracking.ts`
- `frontend/src/lib/warehouses/types.ts`
- `frontend/src/app/api/trips/[offerId]/tracking/**`

**Demo esperada:** “Esta entrega está en riesgo alto porque no tiene ping hace 22 min y el ETA supera la ventana”.

### 3. Validación inteligente de evidencia POD / Score de calidad de evidencia

**Por qué primero:** evidencia es el wedge comercial. Si KargaX vende entrega probada, debe medir si la prueba es completa.

**MVP:** `evidence_quality_checks` por `offer_id`, con status `ready/needs_review/blocked`, score y faltantes: firma, foto, receptor, manifest, tracking destino.

**Archivos base:**

- `frontend/src/lib/warehouses/types.ts`
- `supabase/migrations/035_private_fleet_b2b.sql`
- rutas de carga/entrega/POD

**Demo esperada:** “Este POD está listo para soporte; este otro no porque falta firma y el tracking no llegó al destino”.

### 4. KPIs inteligentes + alertas ejecutivas

**Por qué primero:** vende a owner/gerencia. KargaX deja de ser operación y se vuelve control ejecutivo.

**MVP:** `executive_alerts` calculado desde Last Mile, evidencia, WMS, billing y wallet guardrails. Render por rol en `/dashboard/inteligencia`.

**Archivos base:**

- `frontend/src/app/dashboard/inteligencia`
- `frontend/src/app/api/reports/business-monthly`
- `frontend/src/app/api/admin/overview`
- `frontend/src/lib/business-roles.ts`

**Demo esperada:** “Hoy tienes 3 entregas en riesgo, 2 POD incompletos, 1 despacho bloqueado y 80% de uso del plan”.

### 5. Motor de reglas para estados de entrega

**Por qué primero:** todos los algoritmos dependen de estados confiables. SPTRINTS ya marcó que faltan reglas más fuertes de transición.

**MVP:** no reconstruir todo: crear `frontend/src/algorithms/lastmile/stateRules.ts` y usarlo primero para validar recomendaciones y evidencias; después migrar transiciones críticas.

**Archivos base:**

- `frontend/src/app/api/offers/route.ts`
- rutas de viaje/carga/entrega
- `frontend/src/lib/warehouses/types.ts`

**Demo esperada:** “No puedes cerrar entrega sin POD válido; el sistema te dice qué falta”.

## Algoritmos P1

Estos hacen que el cliente use KargaX todos los días.

1. **Priorización inteligente de entregas:** tablero diario para dispatcher/ops.
2. **Control de cumplimiento SLA:** dentro de cada viaje y reporte semanal.
3. **Detección de novedades críticas:** daño, faltante, seguridad, documentación y pago.
4. **Detección de rutas ineficientes:** sobrecostos y desviaciones sin novedad.
5. **Score de confiabilidad del conductor:** aprovechar `trucker_scores` y eventos reales.
6. **Agrupación de pedidos por zona:** conectar WMS y Last Mile.
7. **Priorización de despacho en bodegas:** que la bodega trabaje por riesgo/SLA, no por memoria.
8. **Control de uso por cliente:** 70/90/100% del plan con upsell correcto.
9. **Score de cliente en riesgo de churn:** 7 días sin viajes, no activación, piloto por vencer.
10. **Recomendación de upsell:** plan recomendado con razones reales.
11. **Ranking de ofertas / matching marketplace:** mejora liquidez sin tocar dinero.
12. **Detección de duplicidad de publicaciones:** reduce ruido y soporte.

## Algoritmos P2

Estos requieren más datos, QA y guardrails.

1. **Optimización avanzada de rutas:** VRP/OR-Tools o proveedor externo.
2. **Predicción de ETA avanzada:** modelo por histórico, hora y zona.
3. **Predicción de precio sugerido marketplace:** requiere histórico suficiente y control de sesgos.
4. **Score de riesgo financiero por operación:** RIESGO ALTO, solo read-only al inicio.
5. **Detección avanzada de evidencias repetidas con perceptual hash:** requiere pipeline de imágenes y privacidad.
6. **Ranking de rutas por rentabilidad:** RIESGO ALTO por mezcla de marketplace/privado/roles financieros.
7. **Predicción de congestión operativa de bodega:** requiere capacidad real por muelle/turno.
8. **Mantenimiento preventivo:** requiere modelo de vehículos/mantenimientos más completo.
9. **Dynamic commission por reputación:** solo cuando settlement esté completamente auditado y snapshots de fee sean inmutables.
10. **Auto-reasignación de conductor:** no antes de state machine, permisos y notificaciones robustas.

## Qué NO implementar todavía

1. **Payouts automáticos “inteligentes”.** La wallet es RIESGO ALTO. El algoritmo puede alertar, no pagar.
2. **Crédito, adelantos o lending visibles.** SPTRINTS indica lending pausado por capital, compliance y partner.
3. **Cambio automático de plan o cobro automático por predicción.** Billing es RIESGO ALTO.
4. **Optimización de rutas con promesa de tráfico real.** Primero ETA heurístico y alertas.
5. **IA visual externa para fotos/firma.** Primero hash, metadata, checklist y privacidad.
6. **Scores punitivos de conductor/cliente sin explicación.** Deben ser explicables, auditables y con historial suficiente.
7. **Automatizaciones cross-company.** Cada snapshot debe tener `business_id` y RLS.

## Riesgos de implementar demasiado rápido

- Romper confianza financiera por mezclar wallet marketplace y pagos privados.
- Exponer evidencia/fotos/firmas a roles sin permiso.
- Crear scores que parecen exactos pero se basan en datos incompletos.
- Saturar al usuario con alertas sin dedupe.
- Añadir ML antes de tener state machine y evidencia confiable.
- Romper checkout, plan limits o Mercado Pago por tocar billing sin QA.
- Convertir KargaX en “dashboard bonito” sin acciones operativas.

## Roadmap recomendado de 30 días

### Semana 1 — Base de arquitectura

- Crear `frontend/src/algorithms/shared` y tipos comunes.
- Crear migración `supabase/migrations/YYYYMMDD_algorithms_intelligence_os.sql` con tablas de snapshots y RLS.
- Implementar `stateRules.ts` read-only para validar estados y prerequisitos.
- Crear tests unitarios para scoring determinístico.

### Semana 2 — Last Mile P0

- Implementar score de riesgo de entrega fallida.
- Implementar alertas tempranas de retraso.
- Implementar próxima mejor acción para operador.
- Crear endpoint `/api/algorithms/lastmile/overview`.

### Semana 3 — Evidencia P0

- Implementar `evidenceQuality.ts`.
- Crear endpoint `/api/algorithms/evidence/validate`.
- Mostrar badge de evidencia en viaje, dashboard y soporte.
- QA con POD completo, incompleto, firma faltante y tracking lejos.

### Semana 4 — Dashboard ejecutivo

- Crear `ExecutiveAlertsPanel` en `/dashboard/inteligencia`.
- Unificar alertas de Last Mile, evidencia, WMS y billing usage.
- Agregar copy por rol: owner/ops/dispatcher/warehouse/finance/auditor.
- Ejecutar `npm run repo:audit`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `npm run check:release`.

## Roadmap recomendado de 90 días

### Días 31-45 — Retención operacional

- Priorización inteligente de entregas.
- Control SLA por etapa.
- Detección de novedades críticas.
- Priorización de despacho en bodega.
- Notificaciones accionables con dedupe.

### Días 46-60 — Marketplace y flota privada

- Matching marketplace read-only.
- Ranking de ofertas para trucker.
- Score conductor por empresa y global.
- Detección de vehículos subutilizados.
- Recomendación de consolidación de carga.

### Días 61-75 — Billing y reportes

- Churn score.
- Upsell score.
- Inconsistencias uso vs cobro.
- Reporte ejecutivo semanal con alertas y evidencia.
- Ranking básico de rutas por eficiencia operativa, no dinero.

### Días 76-90 — Avanzados controlados

- ETA heurístico mejorado con histórico.
- Route inefficiency con pings filtrados.
- Conciliación financiera read-only.
- Detección de duplicados financieros.
- Preparar datasets para ML futuro sin activar decisiones automáticas.
