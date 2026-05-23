# Sprint 42: Enterprise + Revenue Luxury

## Estado

- artifact status: `planned`
- prioridad: alta
- rutas: `/equipo`, `/dashboard/flota`, `/dashboard/inteligencia`, `/corporativo`, `/planes`

## Objetivo

Hacer que KargaX se sienta enterprise: control de equipo, flota privada, inteligencia y facturacion con aura de sistema serio, caro y confiable.

## `/equipo`

- Layout:
  - hero sobrio con plan/rol.
  - miembros en tabla/card.
  - invitacion por email.
  - permisos por bodega.
- QA:
  - roles business intactos.
  - invitation accept intacto.

## `/dashboard/flota`

- Layout:
  - flota como asset empresarial.
  - conductor, estado, compensacion, ultima actividad.
  - acciones aceptar/confirmar oferta.
- QA:
  - private fleet APIs intactas.

## `/dashboard/inteligencia`

- Layout:
  - resumen mensual.
  - fee KargaX, viajes, wallet, top rutas.
  - export PDF como accion premium.
- QA:
  - PDF sigue generando.
  - numeros usan mono font.

## `/corporativo`

- Layout:
  - holding/empresas.
  - aprobaciones.
  - politicas financieras.
  - vista por negocio.
- QA:
  - permisos holding intactos.
  - aprobaciones no se pierden.

## `/planes`

- Layout:
  - plan actual arriba.
  - uso de limites.
  - planes como comparacion sobria.
  - checkout claro.
- QA:
  - Mercado Pago checkout intacto.
  - pilot active/expired visible.
  - paywall events intactos.

## Definition of Done

- Enterprise se siente exclusivo, no decorativo.
- Cada numero financiero es legible y confiable.
- No se cambia modelo de billing ni roles.
