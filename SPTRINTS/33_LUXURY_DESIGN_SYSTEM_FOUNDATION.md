# CERRADO - Sprint 33: Luxury Design System Foundation

## Estado

- artifact status: `completed`
- prioridad: maxima para identidad y coherencia visual
- owner: Frontend + Founder Design
- regla de marca: solo blanco y negro mate; ningun verde, naranja, azul, violeta o champagne como identidad visual

## Objetivo

Convertir KargaX en una experiencia premium monocromatica: minimalismo extremo, espacio amplio, jerarquia clara, interacciones con peso y logo propio de estatus. Este sprint aplica la filosofia de `DESING.md` a KargaX: no se diseña para llenar pantalla, se diseña para dar calma, control y poder.

## Implementado

- Se agrego marca `KX`:
  - `frontend/public/kargax-mark.svg`
  - `frontend/public/kargax-logo.svg`
  - `frontend/src/components/brand/KargaxLogo.tsx`
- Se actualizo `frontend/src/app/layout.tsx`:
  - fuente display `Cormorant Garamond`
  - metadata con assets KargaX
  - favicon/manifest apuntando al monograma KX
  - fondo global usando tokens
- Se actualizo `frontend/public/site.webmanifest`:
  - tema negro mate
  - iconos KX
- Se agrego capa monocromatica global en `globals.css`:
  - tokens blanco/negro mate
  - paneles luxury
  - clamp visual para neutralizar clases heredadas verdes/naranjas/azules/violetas/rojas
  - `font-display` y `font-money`
- Se rediseñaron componentes compartidos sin romper props:
  - `Button`
  - `Card`
  - `Badge`
  - `Input`
  - `Select`
  - `Dialog`
  - `Tabs`
  - `Progress`
  - `EmptyState`
  - `Sheet`
  - `Toast`
  - `StatsCard`
- Se actualizo `DashboardLayout`:
  - logo KX en desktop/mobile/drawer
  - sidebar blanco mate
  - item activo negro
  - estados de carga monocromos
  - header privado con blur suave y borde discreto

## Principios de diseño obligatorios

- La pantalla debe respirar: padding generoso, filas limpias, nada apretado.
- El negro se usa para autoridad; el blanco se usa para paz.
- La UI no debe gritar estatus; debe sentirse inevitablemente cara.
- Si un boton no es esencial, se elimina o baja de jerarquia.
- Si un flujo requiere explicacion visual larga, la UI esta fallando.
- El color ya no comunica marca: la marca comunica por precision, espacio, tipografia, ritmo y logo.
- Estados semanticos se comunican con texto, icono, peso, borde y posicion; no por arcoiris.

## Tipografias

- `Inter`: UI, labels, formularios, tablas, navegacion.
- `Cormorant Garamond`: marca, momentos premium, headlines selectivos.
- `JetBrains Mono`: dinero, saldos, IDs, referencias, montos, contadores operativos.

## QA

- La app debe compilar sin romper imports existentes.
- Ningun componente base debe exigir cambios en las vistas que ya lo usan.
- El logo KX debe verse bien en:
  - sidebar expandido
  - sidebar colapsado
  - mobile header
  - manifest/icon
- Las vistas antiguas con clases `green/orange/blue/violet` deben verse monocromas por clamp global.
- No usar assets ni UI copiada de Apple; solo inspiracion de minimalismo, calma y precision.

## Definition of Done

- KargaX tiene identidad visual propia.
- El sistema base ya no depende del verde/naranja anterior.
- El FE puede seguir evolucionando vista por vista usando los sprints 34-44.
