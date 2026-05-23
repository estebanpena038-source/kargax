# 08 - Warehouse OS

## Objetivo

Volver la capa de bodega una wedge vendible por si sola y una fuente de data operativa util para enterprise y lending.

## Estado actual

- existen rutas y pantallas de bodegas
- existen docks, appointments, stock, receipts, dispatches, tasks e incidents
- existen limites por plan y permisos basicos

## Alcance

- bodegas y muelles
- citas
- recepciones
- inventario
- picking
- despachos
- incidentes
- analitica operativa

## Backlog de ejecucion

1. Normalizar formularios y errores de warehouse.
2. Revisar permisos por owner, manager, operator y auditor.
3. Completar lifecycle de citas.
4. Completar lifecycle de recepcion.
5. Completar lifecycle de picking y despacho.
6. Unificar eventos de stock y trazabilidad.
7. Agregar dashboards operativos utiles para evaluacion y cliente real.
8. Enlazar warehouse events con trip events cuando aplique.

## Entregables

- flujo real de bodega operable
- analitica minima por warehouse
- limites por plan funcionando
- asignacion de miembros a warehouse funcionando

## Definition of Done

- una empresa puede operar una bodega sin hoja paralela
- stock y movimientos son trazables
- roles ven solo lo que deben ver

## QA

- crear bodega
- crear dock
- programar cita
- registrar recepcion
- mover stock
- crear picking
- despachar
- reportar incidente

## Riesgos

- inventario sin trazabilidad de actor
- permisos demasiado amplios
- stock ajustado sin evidencia
