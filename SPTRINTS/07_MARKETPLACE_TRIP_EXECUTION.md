# 07 - Marketplace Trip Execution

## Objetivo

Convertir el flujo logistico principal en un journey confiable de punta a punta:

`offer -> apply -> assign -> pay -> pickup -> in transit -> delivery -> settlement`

## Estado actual

- existen ofertas, postulaciones, pago y pantallas de viaje
- existen PINs, inspecciones y notificaciones
- faltan reglas mas fuertes de transicion y evidencia uniforme

## Alcance

- reglas de negocio por estado
- evidencia de pickup y entrega
- GPS y fotos cuando aplique
- PIN verification
- errores legibles por actor

## Backlog de ejecucion

1. Definir maquina de estados oficial por viaje.
2. Restringir transiciones invalidas.
3. Unificar captura de pruebas:
   - fotos
   - timestamps
   - actor
   - geolocalizacion si aplica
4. Asegurar que pago exitoso dispare efectos correctos:
   - reserva
   - citas
   - PIN
   - notificaciones
5. Hacer visibles bloqueos y causas al trucker y al business.
6. Definir cierre del viaje y handoff a settlement/wallet.

## Entregables

- state machine de viaje
- journey E2E operable
- evidencia persistida y recuperable
- errores operativos claros

## Definition of Done

- no se puede avanzar de estado sin prerequisitos
- todas las evidencias quedan asociadas al viaje
- negocio y trucker entienden donde esta el viaje y por que

## QA

- publicar oferta
- postular
- aceptar
- pagar
- iniciar pickup
- validar PIN
- cargar evidencia
- entregar
- cerrar viaje

## Riesgos

- que el UI permita saltarse estados
- que evidencia critica quede fuera del ledger operativo
- que el settlement no se dispare o se dispare dos veces
