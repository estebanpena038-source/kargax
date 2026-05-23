# Sprint 44: Visual QA Release Gate

## Estado

- artifact status: `planned`
- prioridad: obligatoria antes de release visual
- owner: QA + Frontend

## Objetivo

Certificar que el rediseño blanco/negro mate realmente cumple `DESING.md`: lujo, calma, claridad, jerarquia, espacio, simetria y cero ansiedad. Este sprint no agrega features; cierra calidad visual.

## Rutas obligatorias

- Public/auth:
  - `/`
  - `/para-camioneros`
  - `/soporte`
  - `/terminos`
  - `/privacidad`
  - `/ayuda`
  - `/login`
  - `/registro`
  - `/recuperar-contrasena`
  - `/verificar-email`
  - `/auth/reset-password`
  - `/auth/mfa/setup`
  - `/auth/mfa/verify`
  - `/auth/invite/accept`
- Private:
  - `/dashboard`
  - `/perfil`
  - `/configuracion`
  - `/notificaciones`
  - `/mensajes`
  - `/onboarding`
- Marketplace/payments:
  - `/ofertas`
  - `/ofertas/[id]`
  - `/ofertas/publicar`
  - `/ofertas/editar/[id]`
  - `/ofertas/mis-ofertas`
  - `/postulaciones`
  - `/postulaciones-recibidas`
  - `/ofertas-aceptadas`
  - `/pagar/[offerId]`
  - `/pago/exitoso`
  - `/pago/fallido`
  - `/pago/pendiente`
- Wallet/trips:
  - `/billetera`
  - `/viaje/[offerId]`
  - `/viaje/[offerId]/carga`
  - `/viaje/[offerId]/entrega`
  - `/inspecciones`
  - `/inspecciones/[offerId]`
- Warehouse/enterprise/admin:
  - `/bodegas`
  - `/bodegas/[id]`
  - `/bodegas/[id]/analitica`
  - `/bodegas/[id]/citas`
  - `/bodegas/[id]/muelles`
  - `/bodegas/[id]/inventario`
  - `/bodegas/[id]/recepciones`
  - `/bodegas/[id]/picking`
  - `/bodegas/[id]/despachos`
  - `/bodegas/[id]/incidentes`
  - `/equipo`
  - `/dashboard/flota`
  - `/dashboard/inteligencia`
  - `/corporativo`
  - `/planes`
  - `/admin`
  - `/admin/ceo`

## Checklist por vista

- Logo KX visible donde corresponde.
- Solo blanco/negro mate y grises neutros.
- No hay verde/naranja/azul/violeta/champagne visible.
- Texto no se corta en botones.
- No hay cards dentro de cards salvo modales/items repetidos.
- Accion primaria unica por bloque.
- Mobile 390px:
  - sin overflow horizontal.
  - botones tocables.
  - inputs no se salen.
- Responsive matrix obligatoria:
  - mobile: 360, 375, 390, 414.
  - tablet: 768, 820, 1024 landscape.
  - laptop/desktop: 1366, 1440, 1536, 1920.
  - sin zoom manual para leer o accionar.
  - grids densos bajan a 1-2 columnas antes de apretarse.
  - tablas viven dentro de scroll local, nunca empujan el body.
- Desktop 1440px:
  - contenido no queda perdido.
  - jerarquia clara.
- Estados:
  - loading
  - empty
  - error
  - success
  - permission denied
- Accesibilidad:
  - focus visible.
  - contraste suficiente.
  - labels en formularios.

## Comandos

- `npm run typecheck`
- `npm run build`
- `npm run dev`

## Browser QA

- Capturar desktop y mobile de:
  - `/`
  - `/login`
  - `/registro`
  - `/dashboard`
  - `/ofertas`
  - `/billetera`
  - `/bodegas`
  - `/planes`
  - `/admin/ceo`
- Verificar visualmente:
  - no pantalla en blanco.
  - no solapes.
  - no colores heredados.
  - logo correcto.

## Definition of Done

- Build limpio.
- Screenshots aprobados.
- Sin regresiones de flujo critico.
- El fundador puede abrir cualquier vista y decir: `se siente diferente, me da paz usarlo, me hace mas rapido`.
