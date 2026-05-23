# CERRADO - Sprint 32: Roles Empresariales + Dashboard Inteligente Por Rol

## Objetivo

Cerrar el modelo de permisos de empresas para que KargaX funcione como un sistema operativo logistico real: cada usuario ve y ejecuta solo lo que le corresponde. Se evita mezclar operacion, despacho, bodega, contabilidad y auditoria en un rol generico.

## Roles Cerrados

### Propietario
- Control total de empresa.
- Invita y suspende usuarios.
- Administra planes, equipo, bodegas, flota privada, marketplace, reportes y PDF.
- Ve finanzas completas: fletes, fee KargaX, netos, gastos, pagos privados y retiros.

### Jefe de operaciones
- Planea y supervisa viajes.
- Publica ofertas marketplace.
- Administra flota privada operativa.
- Ve tracking, evidencia, postulaciones, inspecciones, rutas y conductores.
- No administra equipo, planes ni caja.

### Despachador
- Ejecuta despacho diario.
- Publica/asigna/monitorea viajes segun flujo operativo.
- Revisa tracking, PIN/POD, novedades y evidencia.
- No ve reportes contables ni cambia planes/equipo.

### Jefe de bodega
- Administra bodegas, muelles, citas, inventario, recepciones, picking, despachos e incidentes.
- Puede exportar datos operativos de bodega.
- No maneja caja, planes ni usuarios globales.

### Operario de bodega
- Ejecuta tareas fisicas: recepcion, picking, cargue, despacho, evidencia e incidentes.
- No ve caja, equipo, planes ni reportes financieros.

### Contabilidad
- Ve reporte mensual, comisiones, pagos privados, gastos del viaje, retiros y PDF.
- No modifica viajes, bodega, equipo ni flota.
- Acceso enfocado en cierre contable y conciliacion.

### Auditor
- Lee operaciones, evidencia, trazabilidad y exportes.
- No modifica datos.
- Puede revisar finanzas y soporte documental.

### Visualizador
- Consulta resumenes operativos.
- No modifica datos ni exporta informacion sensible.

## Implementacion

- Nueva matriz central: `frontend/src/lib/business-roles.ts`.
- API de equipo acepta roles granulares y mantiene compatibilidad con `manager` y `operator`.
- Sidebar filtra navegacion por rol:
  - planes solo propietario/admin.
  - equipo solo propietario/admin.
  - marketplace/flota/inspecciones solo roles operativos.
  - bodega solo roles con permisos de bodega.
  - inteligencia solo roles autorizados.
- Dashboard `/dashboard/inteligencia` ahora:
  - separa Marketplace y Flota privada.
  - muestra rutas con nombres reales de ciudad/departamento.
  - muestra conductor por nombre cuando existe.
  - oculta montos a roles operativos.
  - habilita PDF solo a contabilidad, auditor, owner y admin.
  - cambia preguntas, tabs y datos segun rol.
- API `/api/reports/business-monthly`:
  - limita payouts a conductores asociados a viajes de la empresa.
  - oculta fletes, fee, netos, gastos y retiros si el rol no tiene finanzas.

## DB

Nueva migracion:

- `supabase/migrations/046_business_role_presets.sql`

Incluye:
- constraint ampliado en `business_team_members.role`.
- constraint ampliado en `warehouse_members.role`.
- feature flag `advanced_business_roles_enabled`.

## QA

- `npm --prefix frontend run typecheck` debe pasar.
- Crear invitaciones con roles nuevos.
- Asignar bodegas a cada rol.
- Confirmar que un rol operativo no ve PDF ni dinero.
- Confirmar que contabilidad ve dashboard contable sin permisos de operacion.
- Confirmar que jefe de bodega entra a bodega y no a planes/equipo.
- Confirmar que owner/admin ve todo.

## Estado

Cerrado a nivel codigo. Antes de subir a produccion, aplicar la migracion `046_business_role_presets.sql` en Supabase para que la DB acepte los nuevos roles.
