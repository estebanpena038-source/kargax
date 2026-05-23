# 92 - Risk Register

## Estado

- artifact status: `completed`
- repo integration status: `completed`
- operational review status: `tracked inside this document`
- cierre: este archivo queda cerrado como registro vivo oficial de riesgos pre-launch

## Regla

Cada riesgo debe tener owner nominal, senal temprana, mitigacion, cadence de revision y criterio de bloqueo.

## Registro vivo

| Categoria | Riesgo | Owner | Early signal | Mitigation | Status | Review cadence | Blocker |
|---|---|---|---|---|---|---|---|
| Estrategico | foco demasiado ancho | CEO / Founder | roadmap vuelve a abrir mercados o productos antes de repeticion | mantener `CO` como unico mercado abierto y congelar expansion comercial sin evidencia | open | semanal | yes |
| Estrategico | vender vision sin producto estable | CEO / Founder | la narrativa comercial promete capacidades manuales o no operables | alinear landing, pricing y playbooks al producto que corre hoy | partial | semanal | yes |
| Tecnico | smoke/E2E sin evidencia ejecutada | CTO / Founding Engineer | `90_QA_MATRIX` sigue con filas `pendiente` | ejecutar `smoke:release` y adjuntar evidencia por journey | open | semanal | yes |
| Tecnico | staging sin conectividad valida a Supabase | CTO / Founding Engineer | `/api/health` devuelve `503` con `TypeError: fetch failed` | corregir `NEXT_PUBLIC_SUPABASE_URL` y credenciales o restaurar el proyecto Supabase antes del smoke final | open | diario | yes |
| Tecnico | backlog de lint warnings | CTO / Founding Engineer | `lint-report.json` con warnings en auth, payments, wallet, admin o holding | triage y cierre por dominio critico antes de launch financiero serio | partial | semanal | no |
| Tecnico | deuda de contratos API | CTO / Founding Engineer | respuestas sin envelope o sin `requestId` | mantener envelope oficial y revisar rutas legacy | partial | quincenal | no |
| Tecnico | UI parcialmente Colombia-first | Head of Ops | formularios o labels siguen asumiendo `CO` fuera de flags | lanzar solo `CO`, mantener `PE/EC` cerrados y corregir surfaces restantes | partial | quincenal | no |
| Financiero | settlement ambiguo | Finance Lead | diferencias entre payments, wallet y admin | conservar ledger canonico y revisar `trip_pending -> trip_deposit` por evidence | mitigated | semanal | yes |
| Financiero | treasury o caps mal aplicados | Finance Lead | adelantos aprobados fuera de policy | revisar panel de advances, exposure snapshot y treasury antes de cada window | mitigated | semanal | yes |
| Financiero | mora temprana no controlada | Finance Lead | crece `PAR7` o `PAR30` sin accion | seguimiento semanal de cohorts y cobranzas | partial | semanal | yes |
| Financiero | lending visible sin capital | Finance Lead | wallet, landing o notificaciones prometen adelantos | mantener `lending_enabled=false`, ocultar UI y copy segun sprint `21` | open | diario hasta piloto | yes |
| Financiero | payout duplicado o no conciliado | Finance Lead | retiro se reintenta sin idempotencia o provider no confirma estado | capa `payout_attempts`, idempotency key, webhook/status y fallback manual segun sprint `20` | open | diario hasta sandbox verde | yes |
| Financiero | provider payout no certificado | Finance Lead | Wompi/Nequi sin sandbox o contrato productivo | mantener `automatic_payouts_enabled=false` y operar fallback manual | open | semanal | yes |
| Financiero | partner/regulacion por pais no definida | CEO / Founder | `PE/EC` intentan abrir sin counterparties o counsel | dejar `PE/EC` en `not open` hasta partner y compliance cerrados | open | semanal | yes |
| Comercial | implementacion asistida demasiado costosa | Growth Lead | tiempo a primer valor crece o requiere fundador siempre | usar checklist, playbooks y support roster como proceso repetible | partial | semanal | no |
| Comercial | activaciones iniciales sin conversion a pago | CEO / Founder | muchas evaluaciones sin contrato o sin uso real | scorecard mensual y decision de foco por gate | open | semanal | yes |
| Operativo | soporte depende del fundador | Support Lead | casos criticos escalan solo por DM informal | usar `docs/ops/support-escalation.md` y `/admin` como cola canonica | partial | semanal | yes |
| Operativo | rollback no documentado | CTO / Founding Engineer | release cae y no existe decision tree | usar `docs/ops/release-rollback.md` y rehearsal previo | partial | semanal | yes |
| Operativo | admin sin observabilidad o sin runbooks | Support Lead | incidentes sin requestId o sin accion segura | mantener `operation_events`, `platform_incidents`, runbooks y replay seguro | mitigated | semanal | no |
| Operativo | WMS crea viajes erroneos | Head of Ops | despacho publica oferta o asigna conductor sin confirmacion | wizard `dispatch_trip_mode` y permisos por rol segun sprint `23` | open | semanal | yes |
| Operativo | rechazos de manifiesto se pierden | Head of Ops | item rechazado aparece cargado o entregado | estado `rechazado_en_origen` y QA de manifiesto segun sprint `18` | open | diario hasta cierre | yes |
| Expansion | rails y partners no abstraidos | CTO / Founding Engineer | proveedor `CO` se asume global | mantener adapters por pais y flags de visibilidad | mitigated | quincenal | no |

## Cierre

- revisar este documento cada semana hasta launch
- cualquier partner critico sin fallback abre riesgo rojo en `94`
- no convertir un riesgo `open` en `mitigated` sin evidencia
