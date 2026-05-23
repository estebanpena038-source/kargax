# CERRADO - SPRINT 17

# 17 - Final Product Strategy

## Estado

- artifact status: `completed`
- cerrado el: `2026-05-19`
- source inputs: `SPTRINTS/ideas-finales.md` + `TRABAJOIA.md`
- owner: CEO / Founder + CTO / Product Lead
- objetivo de salida: decidir que se construye para pilotos y que se pausa

## Implementacion iniciada 2026-05-19

- Se empezo por bloqueadores de piloto, no por features nuevas: Storage, manifiesto, copy financiero y compatibilidad de API.
- La regla de producto aplicada en codigo es: WMS/manifiesto primero, marketplace/flota despues, wallet/liquidacion al cierre.
- Lending sigue pausado visual y operativamente; cualquier campo legacy debe tratarse como compatibilidad interna, no promesa de producto.
- Flags base de piloto: `lending_enabled=false`, `pilot_generous_limits=true`, `automatic_payouts_enabled=false`.

## Proposito

Convertir las ideas finales en una estrategia fria de producto. KargaX no debe ser solo una bolsa de cargas. Debe ser el sistema operativo diario de empresas, bodegas, flotas, camioneros y finanzas logisticas.

La secuencia que crea dependencia real es:

`bodega/inventario -> despacho -> viaje -> PIN/POD -> wallet/retiro -> reporte contable -> tablero CEO`

Si una funcion no fortalece esa secuencia, no entra al piloto salvo que cierre un bug critico.

## Decisiones finales

- Mercado inicial: Colombia.
- Producto inicial vendible: Logistics OS + pagos + wallet + flota privada + WMS + control tower.
- Lending/adelantos de KargaX se pausan visual y operativamente hasta tener capital, partner, cobranza y compliance listos.
- Viaticos de flota privada si quedan porque no son credito: son dinero de la empresa para gastos del viaje.
- Retiros automaticos son parte del piloto, pero con adaptadores, idempotencia, estados y kill switch.
- Free publico queda controlado; cuentas piloto tienen limites altos por 60 a 90 dias con fecha de expiracion.
- Clerk no se implementa ahora. Supabase Auth sigue como base porque ya sostiene Auth, MFA, RLS, session bridge e invitaciones.

## Funciones que vuelven KargaX dificil de abandonar

### Para empresa generadora de carga

- Publicar cargas publicas con pago, PIN, evidencia, postulaciones y liquidacion.
- Gestionar flota privada para rutas propias sin salir de KargaX.
- Invitar equipo interno con roles reales: owner, finanzas, operaciones, bodega, auditoria y lectura.
- Controlar costos por ruta, conductor, cliente, bodega y periodo.
- Exportar reportes contables de viajes, pagos, comisiones, retiros y gastos.
- Ver trazabilidad por requestId, viaje, despacho, payment, wallet transaction y POD.

### Para operador de bodega

- Recibir mercancia con SKU, ubicacion, lote y evidencia.
- Crear despacho desde stock real.
- Elegir si el despacho queda solo como movimiento WMS o si crea viaje.
- Vincular despacho a PIN de salida, manifiesto y viaje.
- Reportar rechazados en origen con evidencia para que no reaparezcan como cargados.

### Para camionero independiente

- Ver ofertas disponibles, postularse, aceptar ruta y ejecutar viaje.
- Ver pago neto despues de comision antes de aceptar.
- Recibir saldo en wallet cuando el viaje queda cerrado con evidencia.
- Registrar metodo de retiro Nequi o cuenta bancaria.
- Solicitar/revisar retiro con estado claro.
- Construir reputacion por puntualidad, cumplimiento y baja novedad.

### Para conductor de flota privada

- Recibir ruta directa de su empresa.
- Entender si la ruta tiene pago por viaje, solo gastos, ambos o ningun pago por viaje.
- Confirmar cargue, ruta, novedades, POD y cierre.
- Recibir viaticos empresa cuando el modo lo permita.
- No confundir viaticos con credito KargaX.

### Para CEO / Founder KargaX

- Ver salud de la plataforma en una pantalla.
- Saber cuantos usuarios, viajes, pagos, retiros, planes, incidentes y errores existen.
- Detectar donde se rompe el piloto: auth, pagos, WMS, wallet, flota, soporte o infraestructura.
- Medir adopcion de cuentas piloto y conversion a plan pago.

## Que se acepta de `TRABAJOIA.md`

- Bugs de semana 1: aceptados como Sprint 18.
- Score/reputacion: aceptado, pero sin usar adelantos como metrica principal.
- Niveles y comision dinamica: aceptado solo si settlement base ya es correcto.
- Notificaciones inteligentes: aceptadas, sin prometer adelantos.
- Dashboard inteligencia: aceptado como control tower y analitica, separado por audiencia.
- PDF contable: aceptado porque ayuda al contador y aumenta retencion.
- Landing camioneros: aceptada solo despues de que pagos, retiro y bugs esten cerrados.
- Referidos: aceptados como growth loop posterior a estabilidad; no bloquean piloto y no sustituyen ventas directas B2B.

## Que se cambia

- Pago expres queda pausado si KargaX debe fondearlo. Solo puede existir como liberacion acelerada de fondos ya pagados por empresa y cubiertos por reglas de disputa.
- Adelantos de combustible quedan ocultos. No se venden como beneficio hasta reabrir lending.
- Comision dinamica no puede romper la contabilidad: toda tasa aplicada debe quedar en snapshot de settlement.
- Notificaciones no deben decir "tienes adelanto disponible"; deben hablar de cargas, pagos, reputacion, reportes y actividad.
- Dashboard de inteligencia empresarial se divide: primero CEO KargaX para operar pilotos; despues dashboard empresa cliente con costos, rutas y PDF.

## Que se descarta para piloto

- Migracion inmediata a Clerk.
- Expansiones PE/EC.
- Lending con dinero de KargaX.
- Promesas de pago automatico si Wompi/Nequi no estan certificados en sandbox/produccion.
- Crear ofertas automaticamente desde WMS sin confirmacion explicita del usuario.
- Programas de referidos antes de tener pagos, retiros y rutas funcionando de punta a punta.

## Roles canonicos a soportar

| Rol | Quien es | Permisos base |
|---|---|---|
| `business_owner` | dueno/admin empresa | todo el negocio, planes, equipo, pagos, flota, bodegas |
| `finance_accountant` | contador/finanzas | pagos, wallet empresa, retiros, reportes, conciliacion |
| `ops_manager` | jefe operaciones | ofertas, viajes, flota, WMS, incidencias |
| `warehouse_operator` | operario bodega | recepciones, inventario, despachos, PIN salida |
| `auditor` | control interno | lectura, evidencias, reportes, logs |
| `trucker_independent` | camionero marketplace | ofertas, viaje, wallet, retiros, reputacion |
| `private_fleet_driver` | conductor de empresa | rutas asignadas, checklists, viaticos empresa si aplica |
| `platform_admin` | KargaX | soporte, incidentes, payouts, reconciliacion, control tower |

## Plan de ejecucion

1. Cerrar bugs criticos y produccion.
2. Pausar lending visible.
3. Endurecer wallet, settlement y retiros.
4. Completar flota privada con roles y modos de compensacion.
5. Conectar WMS despacho a viaje/oferta.
6. Crear control tower CEO KargaX.
7. Agregar retencion: score, notificaciones, PDF, limites y paywalls.
8. Ejecutar QA navegador completo antes de pilotos.

## Definition of Done

- Cada decision de `ideas-finales.md` aparece en un sprint posterior o queda descartada aqui.
- Ningun sprint promete lending activo para piloto.
- El flujo principal puede explicarse en una demo de 15 minutos sin hojas externas.
- El equipo de desarrollo puede tomar los sprints 18-28 sin decidir estrategia.
