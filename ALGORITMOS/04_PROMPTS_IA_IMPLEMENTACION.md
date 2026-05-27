# 04 - Prompts IA para implementar ALGORITMOS en KargaX

Este documento es el equivalente de `WALLET/10_CODEX_PROMPTS.md`, pero para la nueva carpeta `ALGORITMOS/`.

Objetivo: darle a Codex, Cursor, ChatGPT con GitHub o cualquier dev IA un set de prompts seguros, accionables y conectados al repo real para implementar algoritmos inteligentes en KargaX sin romper wallet, billing, RLS, flota privada, marketplace ni datos multiempresa.

---

## Prompt 0 - auditoría obligatoria antes de tocar código

```text
Actúa como CTO founding engineer + arquitecto SaaS B2B logístico de KargaX.

Lee primero:
- AGENTS.md
- README.md
- ALGORITMOS/00_CONTEXTO_KARGAX.md
- ALGORITMOS/01_MAPA_DE_ALGORITMOS.md
- ALGORITMOS/02_PRIORIZACION_CTO.md
- ALGORITMOS/03_IMPLEMENTACION_TECNICA.md
- SPTRINTS/07_MARKETPLACE_TRIP_EXECUTION.md
- SPTRINTS/08_WAREHOUSE_OS.md
- SPTRINTS/09_WALLET_SETTLEMENTS.md
- SPTRINTS/16_PRIVATE_FLEET_B2B.md
- SPTRINTS/20_WALLET_SETTLEMENTS_AND_AUTOMATIC_PAYOUTS.md
- SPTRINTS/22_PRIVATE_FLEET_FINANCE_AND_ROLES.md
- SPTRINTS/23_WMS_DISPATCH_TO_TRIP_AUTOMATION.md
- SPTRINTS/30_LIVE_TRIP_TRACKING_PWA.md
- SPTRINTS/32_BUSINESS_ROLES_AND_INTELLIGENCE_DASHBOARD.md
- COMMERCIAL/README.md
- COMMERCIAL/01_ANALISIS_KARGAX.md
- COMMERCIAL/02_PRICING_RETENCION_Y_DEPENDENCIA_POR_VALOR.md
- COMMERCIAL/03_ECOSISTEMA_TRANSPORTE_LOGISTICA.md

No modifiques código todavía.

Haz una auditoría técnica para implementar los algoritmos P0 de KargaX:
1. Identifica archivos reales que tocan ofertas/viajes, tracking, evidencia, bodegas, flota privada, wallet, billing y reportes.
2. Identifica tablas reales usadas por esos módulos.
3. Identifica roles y capacidades que deben controlar acceso a algoritmos.
4. Identifica qué datos ya existen para calcular scores sin nueva migración.
5. Identifica qué datos faltan y requieren migración nueva.
6. Marca riesgos altos en wallet/liquidaciones, billing, Mercado Pago, RLS y multiempresa.
7. Propón un plan por commits pequeños.

Restricciones críticas:
- No inventes tablas, columnas ni endpoints existentes.
- Si algo falta, propone migración en supabase/migrations/.
- No edites migraciones antiguas.
- No mezcles wallet marketplace con liquidaciones privadas.
- No cambies saldos ni pagos para algoritmos P0.
- No expongas evidencia entre empresas.
- Mantén copy de producto en español operativo.

Entrega:
- Diagnóstico.
- Mapa de archivos leídos.
- Riesgos.
- Plan de implementación por commits.
- Comandos de prueba.
```

---

## Prompt 1 - crear estructura base de algoritmos sin tocar negocio sensible

```text
Implementa la estructura base de algoritmos P0 para KargaX.

Lee primero:
- ALGORITMOS/03_IMPLEMENTACION_TECNICA.md
- frontend/src/lib/business-roles.ts
- frontend/src/lib/server/warehouses.ts
- frontend/src/lib/server/trip-tracking.ts
- frontend/src/app/api/offers/route.ts

Objetivo:
Crear una capa pura, testeable y explicable en frontend/src/algorithms/ para calcular scores y recomendaciones sin mutar datos financieros ni cambiar estados de viajes.

Crear estos archivos:
- frontend/src/algorithms/shared/types.ts
- frontend/src/algorithms/shared/scoring.ts
- frontend/src/algorithms/shared/date.ts
- frontend/src/algorithms/lastmile/deliveryRisk.ts
- frontend/src/algorithms/lastmile/nextBestAction.ts
- frontend/src/algorithms/lastmile/stateRules.ts
- frontend/src/algorithms/evidence/evidenceQuality.ts
- frontend/src/algorithms/reports/executiveAlerts.ts

Reglas:
- Las funciones deben ser puras.
- No llamar Supabase desde estos archivos.
- No usar IA externa ni APIs pagas.
- No tocar wallet, transactions, payments, payout_attempts ni Mercado Pago.
- No crear estados automáticos todavía; solo sugerencias y scores.
- Cada score debe devolver explicación humana en español.
- Cada resultado debe incluir riskLevel: low | medium | high | critical.

Criterio de éxito:
- TypeScript compila.
- Los algoritmos reciben DTOs normalizados y devuelven outputs determinísticos.
- No hay dependencia circular con components ni app routes.

Entrega:
- Diff completo.
- Resumen de archivos creados.
- Ejemplos de input/output.
- Comandos ejecutados.
```

---

## Prompt 2 - algoritmo P0: riesgo de entrega fallida + alertas tempranas Last Mile

```text
Implementa el algoritmo P0 de riesgo de entrega fallida y alertas tempranas.

Contexto:
KargaX ya maneja ofertas/viajes, flota privada, marketplace, tracking PWA, evidencia, PIN/POD, manifest_items, fechas de pickup/delivery y roles empresariales. El algoritmo no debe cambiar estados ni pagos; solo calcular riesgo y explicar la causa.

Archivos a revisar antes:
- frontend/src/app/api/offers/route.ts
- frontend/src/lib/server/trip-tracking.ts
- frontend/src/lib/warehouses/types.ts
- frontend/src/app/api/trips/[offerId]/tracking/route.ts si existe
- frontend/src/app/api/trips/[offerId]/tracking/start/route.ts si existe
- frontend/src/app/api/trips/[offerId]/tracking/ping/route.ts si existe
- frontend/src/app/api/trips/[offerId]/tracking/stop/route.ts si existe
- supabase/migrations/045_live_trip_tracking.sql o migración equivalente

Implementa:
- frontend/src/algorithms/lastmile/deliveryRisk.ts
- función calculateDeliveryFailureRisk(input)
- función detectDelaySignals(input)

Señales mínimas:
- delivery window vencida o cercana.
- sin tracking reciente.
- baja precisión GPS.
- viaje asignado sin aceptación.
- destino sin coordenadas válidas.
- evidencia obligatoria pendiente.
- incidentes/novedades críticas.
- manifest con rechazados/faltantes.
- flota privada con comprobante pendiente, solo como señal documental, no financiera.

Output obligatorio:
- score 0-100.
- riskLevel low/medium/high/critical.
- reasons[] en español.
- recommendedActions[] en español.
- blockingForClosure boolean, solo si falta evidencia crítica.

Restricciones:
- No mutar cargo_offers.
- No disparar pagos/liquidaciones.
- No enviar notificaciones todavía.
- No crear columnas si se puede calcular desde datos existentes.

Pruebas:
- Viaje sin retraso => low.
- Viaje vencido sin tracking => high/critical.
- Viaje con POD completo => baja riesgo.
- Viaje con novedad crítica => high.
- Private fleet sin comprobante no bloquea entrega, solo marca alerta documental.
```

---

## Prompt 3 - algoritmo P0: próxima mejor acción para operador

```text
Implementa el algoritmo P0 Next Best Action para operador/despachador.

Objetivo:
Que KargaX diga al operador qué hacer ahora: llamar conductor, pedir POD, validar PIN, resolver novedad, crear soporte, revisar ruta atrasada o descargar reporte.

Archivos a revisar:
- frontend/src/lib/business-roles.ts
- frontend/src/lib/server/warehouses.ts
- frontend/src/lib/warehouses/types.ts
- frontend/src/app/dashboard/inteligencia/page.tsx si existe
- frontend/src/components/layouts/DashboardLayout.tsx

Crear/editar:
- frontend/src/algorithms/lastmile/nextBestAction.ts
- frontend/src/app/api/algorithms/lastmile/overview/route.ts
- frontend/src/components/algorithms/NextBestActionPanel.tsx

Reglas:
- El algoritmo debe respetar rol/capability.
- Un finance_accountant no recibe acciones de despacho operativo.
- Un dispatcher no ve montos financieros.
- Un warehouse_operator solo ve acciones de bodega/evidencia si aplica.
- Un owner/admin ve todo.

Tipos de acción:
- validate_pickup_pin
- request_live_tracking
- contact_driver
- collect_missing_pod
- resolve_incident
- review_delayed_route
- verify_manifest_difference
- download_support
- review_billing_limit

Output:
- id
- priority: P0 | P1 | P2
- title
- description
- actionLabel
- href
- roleVisibility
- reason
- createdFromSignals

Restricciones:
- No cambiar estados automáticamente.
- No exponer dinero a roles sin canViewFinance.
- No mezclar marketplace y flota privada en el mismo mensaje si el tipo de operación es diferente.

QA:
- Owner ve acciones operativas y ejecutivas.
- Dispatcher ve acciones de ruta, no contabilidad.
- Finance ve acciones de reporte/liquidación, no asignación de conductor.
- Viewer solo ve resumen sin acciones sensibles.
```

---

## Prompt 4 - algoritmo P0: validación inteligente de evidencia POD

```text
Implementa validación inteligente de evidencia POD/PIN/foto/firma para KargaX.

Objetivo:
Calcular si una entrega tiene evidencia suficiente para cerrar operación y soportar reclamos, sin usar visión artificial todavía.

Archivos a revisar:
- frontend/src/lib/warehouses/types.ts
- frontend/src/app/api/warehouses/[id]/digital-evidence/route.ts si existe
- frontend/src/app/viaje/[offerId]/entrega/page.tsx si existe
- frontend/src/app/viaje/[offerId]/carga/page.tsx si existe
- supabase/migrations/035_private_fleet_b2b.sql
- supabase/migrations/045_live_trip_tracking.sql o equivalente

Crear:
- frontend/src/algorithms/evidence/evidenceQuality.ts
- frontend/src/app/api/algorithms/evidence/[offerId]/validate/route.ts
- frontend/src/components/algorithms/EvidenceQualityBadge.tsx

Reglas de score:
- Firma delivery_pod presente.
- PIN entrega verificado.
- Foto en destino presente.
- Timestamp presente.
- Actor/conductor asociado.
- Tracking reciente cerca del destino si hay coordenadas.
- Manifest sin faltantes no justificados.
- Rechazos preservados con razón.
- No marcar como válido si falta evidencia crítica.

Output:
- score 0-100.
- status: complete | incomplete | suspicious | blocked.
- missingRequirements[].
- warnings[].
- canCloseOperationally boolean.
- canReleaseMarketplaceSettlementSuggestion boolean, solo sugerencia, no pago automático.

Restricciones RIESGO ALTO:
- No liberar wallet.
- No crear payout.
- No cambiar payment_status.
- No mezclar evidencia privada y marketplace.
- No permitir que una empresa vea evidencia de otra.

QA:
- Entrega con firma + foto + PIN => complete.
- Entrega sin firma => incomplete.
- Entrega con rechazo sin razón => suspicious.
- Marketplace y privado devuelven context separados.
```

---

## Prompt 5 - API agregadora P0 /api/algorithms/lastmile/overview

```text
Crea el endpoint server-side para alimentar dashboard inteligente Last Mile.

Endpoint:
- GET /api/algorithms/lastmile/overview

Debe leer datos reales de Supabase y pasar DTOs normalizados a los algoritmos puros.

Archivos a revisar:
- frontend/src/lib/server/route-auth.ts
- frontend/src/lib/server/warehouses.ts
- frontend/src/lib/business-roles.ts
- frontend/src/app/api/reports/business-monthly/route.ts
- frontend/src/app/api/admin/overview/route.ts si existe

Debe devolver:
- generatedAt
- role
- capabilities
- summary
- deliveryRisks[]
- nextBestActions[]
- evidenceWarnings[]
- executiveAlerts[]

Seguridad:
- Business solo ve su business_id.
- Trucker solo ve sus rutas si se decide soportarlo; si no, 403.
- Admin puede ver agregado si ya hay requireAdminRoute.
- Roles sin canViewIntelligence reciben 403 o payload limitado.
- No devolver montos si role no tiene canViewFinance.

Restricciones:
- No llamar RPC financiera.
- No modificar cargo_offers.
- No tocar wallet ni billing.
- No usar service role para saltarse filtros sin filtrar manualmente por business_id.

QA:
- Business owner ve sus rutas.
- Business de otra empresa no ve datos.
- Dispatcher no ve montos.
- Finance no recibe acciones de despacho no autorizadas.
- Sin datos devuelve arrays vacíos y summary seguro.
```

---

## Prompt 6 - migración opcional para snapshots de algoritmos

```text
Crea una migración opcional para guardar snapshots de algoritmos sin afectar operación crítica.

Archivo sugerido:
- supabase/migrations/YYYYMMDD_algorithms_intelligence_os.sql

Crear tablas solo si no existen:
- algorithm_score_snapshots
- algorithm_alerts
- algorithm_feedback_events

Campos mínimos algorithm_score_snapshots:
- id uuid primary key
- business_id uuid not null
- offer_id uuid null
- module text not null
- algorithm_key text not null
- score numeric null
- risk_level text null
- output jsonb not null default '{}'
- computed_at timestamptz not null default now()
- created_by uuid null

Campos mínimos algorithm_alerts:
- id uuid primary key
- business_id uuid not null
- offer_id uuid null
- alert_type text not null
- severity text not null
- title text not null
- description text null
- status text not null default 'open'
- metadata jsonb not null default '{}'
- created_at timestamptz not null default now()
- resolved_at timestamptz null
- resolved_by uuid null

Campos mínimos algorithm_feedback_events:
- id uuid primary key
- business_id uuid not null
- user_id uuid null
- algorithm_key text not null
- entity_type text not null
- entity_id uuid null
- feedback text not null
- metadata jsonb not null default '{}'
- created_at timestamptz not null default now()

RLS:
- Business owner/admin/authorized role ve solo su business_id.
- Admin global puede ver todo si existe función is_admin_user.
- No permitir inserts desde cliente si no hay policy segura; preferir server route.

Restricciones:
- No tocar payments, transactions, payout_attempts, billing_plans ni business_plan_subscriptions.
- No editar migraciones antiguas.
- No bloquear operación si estas tablas no existen; el producto debe degradar a cálculo on-demand.

QA:
- Migración corre limpia.
- RLS no filtra mal business_id.
- Insert server-side crea snapshot.
- Usuario de otra empresa no puede leer snapshot.
```

---

## Prompt 7 - UI ejecutiva para demo B2B

```text
Implementa UI premium para mostrar algoritmos P0 en dashboard/inteligencia.

Objetivo comercial:
Que en una demo B2B el cliente vea que KargaX no solo guarda datos: prioriza entregas, detecta riesgos, valida evidencia y recomienda acciones.

Archivos a revisar:
- frontend/src/app/dashboard/inteligencia/page.tsx
- frontend/src/components/enterprise/EnterpriseLuxury.tsx
- frontend/src/components/layouts/DashboardLayout.tsx
- frontend/src/lib/business-roles.ts

Crear componentes:
- frontend/src/components/algorithms/ExecutiveAlertsPanel.tsx
- frontend/src/components/algorithms/DeliveryRiskBadge.tsx
- frontend/src/components/algorithms/EvidenceQualityBadge.tsx
- frontend/src/components/algorithms/NextBestActionPanel.tsx

Copy en español:
- “Riesgo de entrega”
- “Evidencia incompleta”
- “Siguiente mejor acción”
- “Alerta operativa”
- “Listo para soporte”
- “Requiere revisión”

UX:
- Diseño sobrio premium estilo KargaX.
- No saturar al usuario.
- Mostrar máximo 5 acciones principales.
- Explicar por qué se recomienda cada acción.
- Estados vacíos elegantes.
- Loading y error state.

Restricciones:
- No mostrar saldos/montos a roles operativos.
- No mezclar marketplace y privado sin etiqueta visible.
- No prometer optimización automática si solo hay recomendación.

QA:
- Mobile responsive.
- Owner/admin ve panel completo.
- Dispatcher ve operaciones.
- Finance ve alertas contables/reportes.
- Viewer ve resumen limitado.
```

---

## Prompt 8 - tests QA de algoritmos P0

```text
Crea pruebas mínimas para los algoritmos P0.

Objetivo:
Evitar que futuros cambios rompan scoring, evidencia, roles o recomendaciones.

Revisa si el repo usa test runner. Si no hay test runner, crea al menos fixtures y un script simple o documenta pruebas manuales en ALGORITMOS.

Casos mínimos:
1. calculateDeliveryFailureRisk con viaje a tiempo => low.
2. calculateDeliveryFailureRisk con entrega vencida y sin tracking => critical.
3. validateEvidenceQuality con firma + foto + PIN => complete.
4. validateEvidenceQuality sin firma => incomplete.
5. nextBestAction para dispatcher no incluye dinero.
6. nextBestAction para finance no incluye reasignar conductor.
7. executiveAlerts no muestra montos si canViewFinance=false.
8. Marketplace y flota privada se etiquetan distinto.

Comandos esperados:
- npm --prefix frontend run typecheck
- npm --prefix frontend run lint
- npm --prefix frontend run build
- npm run check:release

Entrega:
- Archivos de test o runbook QA.
- Resultado esperado por caso.
- Riesgos no cubiertos.
```

---

## Prompt 9 - hardening de seguridad/RLS antes de release

```text
Audita seguridad antes de liberar ALGORITMOS P0.

Revisa:
- endpoints /api/algorithms/*
- frontend/src/algorithms/*
- componentes UI de algoritmos
- roles en frontend/src/lib/business-roles.ts
- server access en frontend/src/lib/server/warehouses.ts
- migración de snapshots si existe

Checklist:
1. Ningún business puede leer datos de otro business.
2. Trucker no ve rutas de otros conductores.
3. Dispatcher no ve montos financieros.
4. Finance no puede cambiar estados operativos desde algoritmos.
5. Algoritmos no liberan wallet ni crean payout.
6. Algoritmos no cambian billing ni plan subscription.
7. Alerts/snapshots respetan business_id.
8. No se loggean documentos, teléfonos completos, cuentas bancarias ni tokens.
9. Si falta una tabla, el sistema degrada seguro.
10. No hay promesas de IA predictiva si el cálculo es reglas heurísticas.

Entrega:
- Blockers.
- Riesgos medios.
- Recomendaciones.
- Decisión: release / no release.
```

---

## Prompt 10 - PR final lista para merge

```text
Revisa esta implementación de ALGORITMOS P0 como CTO KargaX.

Prioridad de revisión:
1. Seguridad multiempresa y RLS.
2. No tocar wallet/billing/pagos.
3. Roles y visibilidad de dinero.
4. Exactitud de rutas/archivos.
5. Calidad de TypeScript.
6. UX operativa en español.
7. Valor para demo B2B.
8. Deuda técnica aceptable.

Entrega:
- Resumen de qué implementa.
- Archivos modificados.
- Blockers.
- Cambios requeridos.
- Pruebas faltantes.
- Riesgos de producción.
- Decisión: merge / changes requested.
```

---

# Orden recomendado de uso

1. Ejecutar Prompt 0.
2. Ejecutar Prompt 1.
3. Ejecutar Prompt 2.
4. Ejecutar Prompt 3.
5. Ejecutar Prompt 4.
6. Ejecutar Prompt 5.
7. Solo si quieres histórico, ejecutar Prompt 6.
8. Ejecutar Prompt 7.
9. Ejecutar Prompt 8.
10. Ejecutar Prompt 9 antes de release.
11. Ejecutar Prompt 10 para revisión final.

# Decisión CTO

Para KargaX, estos prompts deben implementar primero algoritmos explicables, no modelos black-box. El orden correcto es:

1. Riesgo de entrega.
2. Próxima mejor acción.
3. Calidad de evidencia.
4. Alertas ejecutivas.
5. Snapshots opcionales.

No implementar todavía optimización avanzada de rutas, predicción ML de ETA ni scoring financiero automático hasta tener dataset real, QA, RLS fuerte y eventos históricos confiables.
