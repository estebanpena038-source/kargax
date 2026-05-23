# CERRADO - Sprint 30: Tracking GPS En Vivo PWA

## Objetivo

Agregar tracking robusto desde movil usando PWA foreground, con cola local offline y APIs seguras por rol.

## Implementado

- Tablas nuevas en migracion `045`:
  - `trip_tracking_sessions`.
  - `trip_location_pings`.
- APIs:
  - `POST /api/trips/[offerId]/tracking/start`.
  - `POST /api/trips/[offerId]/tracking/ping`.
  - `POST /api/trips/[offerId]/tracking/stop`.
  - `GET /api/trips/[offerId]/tracking`.
- Helper server `trip-tracking.ts` para permisos, normalizacion e insercion idempotente.
- Componente `LiveTripTracker`.
- Integracion en:
  - `/viaje/[offerId]`.
  - `/viaje/[offerId]/carga`.
  - `/viaje/[offerId]/entrega`.

## Comportamiento

- Usa `navigator.geolocation.watchPosition`.
- Envia ping cada 30 segundos o 250 metros.
- Guarda cola local si no hay internet.
- Reintenta al volver online.
- Muestra permiso, precision, ultima sincronizacion, cola local y link a Google Maps.
- No promete background GPS: PWA foreground solamente.

## Seguridad

- Solo conductor asignado o conductor privado puede enviar ubicacion.
- Empresa propietaria, admin y conductor pueden leer tracking.
- No se aceptan pings si el viaje no esta asignado o en progreso.
- RLS habilitado en tablas de tracking.

## QA

- Chrome Android: permiso concedido, denegado y precision baja.
- Safari iPhone: permiso concedido, denegado y reconexion.
- Cortar internet, generar pings y reconectar.
- Usuario no autorizado debe recibir 403.
- Validar `last_ping_at`, lat/lng y pings ordenados.
