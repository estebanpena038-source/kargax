# CERRADO - SPRINT 18

# 18 - Pilot Blocker Bugs

## Estado

- artifact status: `completed`
- cerrado el: `2026-05-19`
- prioridad: maxima
- fuente: `TRABAJOIA.md` semana 1 + `ideas-finales.md` bugs finales
- owner: CTO / Founding Engineer

## Implementacion iniciada 2026-05-19

- `offer-photos` ya no debe depender de creacion manual en Dashboard: la migracion `005_offer_photos.sql` crea bucket, limites de archivo, MIME permitidos y politicas Storage.
- Publicar oferta ya no debe depender de campos globales invisibles de peso/cantidad: el manifiesto es la fuente canonica para peso, cantidad y volumen derivado.
- La ruta API y el bridge Supabase mantienen fallback minimo para cargas legacy, pero priorizan `manifestItems`.
- Flota privada conserva el valor legacy `expense_advance` en DB cuando ya existe contrato, pero el copy operativo debe decir `gastos del viaje` o `viaticos empresa`.
- Lending queda pausado por `feature_flags.lending_enabled=false`; `/api/advances` bloquea nuevas solicitudes y wallet oculta el modulo visible mientras el flag este apagado.

## Proposito

Cerrar los bugs que bloquean pilotos. Ninguna feature de retencion compensa una app que pierde sesiones, manda links a localhost, rompe fotos, calcula mal dinero o destruye el estado del manifiesto.

## Orden de ataque

1. Dinero y settlement.
2. Auth, sesiones y links publicos.
3. Storage y carga de imagenes.
4. Manifiesto, cargue, rechazos y entrega.
5. UI/UX de flujos criticos.

## Bug 1 - Settlement marketplace y comision

### Problema

El camionero puede ver saldo completo sin comision o montos inconsistentes. La empresa puede ver montos que no cuadran con lo pagado.

### Regla de negocio

- Empresa paga `total_amount`.
- KargaX cobra comision segun snapshot de settlement.
- Camionero recibe `net_amount = total_amount - platform_fee`.
- Para piloto base marketplace usar `8%` si no existe tasa configurada.
- Flota privada no cobra comision marketplace por defecto; se monetiza por plan SaaS.

### Cambios tecnicos

- Revisar `frontend/src/app/billetera/page.tsx`.
- Revisar `frontend/src/app/viaje/[offerId]/entrega/page.tsx`.
- Revisar `frontend/src/app/api/payments/*`.
- Revisar `supabase/migrations/034_freight_payment_settlement_resilience.sql`.
- Asegurar snapshot con `commission_rate`, `platform_fee`, `net_amount`, `gross_amount`, `settlement_source`.
- Evitar calculos solo en frontend.

### QA

- Viaje de `2,000,000 COP`.
- Comision `8% = 160,000`.
- Camionero recibe `1,840,000`.
- Empresa ve `-2,000,000`.
- KargaX ve ingreso `160,000`.
- Ledger tiene before/after y referencia a offer/payment.

## Bug 2 - Cierre de sesion post-pago

### Problema

Al terminar pago y presionar volver, se pierde la sesion.

### Cambios tecnicos

- Revisar `frontend/src/app/pagar/[offerId]/page.tsx`.
- Revisar `frontend/src/app/pago/exitoso`, `pago/fallido`, `pago/pendiente`.
- Botones de retorno deben usar router client-side.
- No usar `window.location` salvo salida a provider externo.
- No limpiar store/auth al navegar desde resultado de pago.

### QA

- Login empresa.
- Publicar oferta.
- Pagar o simular pago.
- Volver a dashboard.
- La sesion sigue activa.

## Bug 3 - Links `localhost` en emails e invitaciones

### Problema

Reset password, invitaciones de equipo, holding y flota privada pueden abrir `localhost`.

### Cambios tecnicos

- Revisar `frontend/src/lib/platform/public-app-url.ts`.
- Revisar `frontend/src/lib/server/runtime-env.ts`.
- Revisar `frontend/src/lib/server/team-invitations.ts`.
- Revisar `frontend/src/app/api/business/team/route.ts`.
- Revisar `frontend/src/app/api/business/fleet/route.ts`.
- Revisar `frontend/src/app/api/holding/members/route.ts`.
- En entorno productivo estricto, rechazar cualquier URL local.
- Supabase Auth debe tener Site URL publica y redirect allowlist publica.

### QA

- Buscar `localhost` en `frontend/src`, excepto helpers que bloquean o permiten solo dev.
- Reset password abre `https://kargax-staging.vercel.app` o dominio real.
- Invitacion equipo abre dominio real.
- Invitacion holding abre dominio real.
- Invitacion flota privada abre dominio real.

## Bug 4 - Bucket `offer-photos` no existe

### Problema

Al publicar imagen de carga aparece `Bucket not found`.

### Cambios tecnicos

- Crear migracion Storage real para `offer-photos`.
- No dejarlo como comentario manual en `005_offer_photos.sql`.
- Politicas en `storage.objects` para upload autenticado y lectura segun regla de negocio.
- Manejo de error en `frontend/src/app/ofertas/publicar/page.tsx`.
- El selector de imagen no debe hacer submit del formulario.
- Preview local o URL publica despues del upload.

### QA

- Subir JPG/PNG de 2 MB.
- No recarga pagina.
- Preview visible.
- Oferta publicada contiene foto.
- Error de bucket se muestra con toast accionable, no crash.

## Bug 5 - Manifiesto y rechazos

### Problema

Items rechazados pueden volver a estado cargado/entregado.

### Regla canonica

- Item rechazado en cargue queda `rechazado_en_origen`.
- No cuenta como cargado.
- No debe exigirse como descargado normal.
- En entrega aparece como rechazado de origen con evidencia y razon.
- Item parcialmente cargado debe conservar cantidades: esperada, cargada, rechazada, entregada.

### Cambios tecnicos

- Revisar `frontend/src/components/picking/PickingChecklist.tsx`.
- Revisar `frontend/src/app/viaje/[offerId]/carga/page.tsx`.
- Revisar `frontend/src/app/viaje/[offerId]/entrega/page.tsx`.
- Revisar `supabase/migrations/037_manifest_item_ids_and_picking_idempotency.sql`.
- Revisar `supabase/migrations/040_picking_loading_rejections_and_private_fleet_guards.sql`.
- Persistir estado actual por item y no sobrescribir con defaults.

### QA

- Crear viaje con 4 items.
- Marcar 2 cargados y 2 rechazados en origen.
- Confirmar carga.
- Ir a descarga.
- Los 2 rechazados siguen rechazados y no aparecen como cargados.

## Bug 6 - Loop OTP / dashboard / onboarding

### Problema

Sesion expirada puede llevar a OTP, error QR y loop.

### Cambios tecnicos

- Si no hay sesion valida: redirect limpio a `/login`.
- OTP/MFA solo se abre para usuario autenticado que requiere step-up.
- Si onboarding ya esta completo, no redirigir a onboarding.
- Guard anti-loop con ruta actual y estado de sesion.

### QA

- Forzar expiracion de token.
- Dashboard redirige a login.
- No aparece error QR.
- No hay loop.

## Bug 7 - Unificar postulaciones

- Unificar `postulaciones` y `ofertas-aceptadas` en una experiencia canonica.
- Tabs: pendientes, aceptadas, terminadas, no seleccionadas.
- Mantener redirects o enlaces para no romper navegacion existente.

## Bug 8 - SKU selector en inspecciones

- Primera creacion permite SKU libre.
- Si SKU ya existe en bodega, sugerir selector.
- No forzar "Selecciona SKU existente" cuando no existe inventario previo.

## Bug 9 - Boton rechazar carga invisible

- Boton destructivo siempre visible.
- Fondo rojo, texto blanco, estado disabled claro.
- Confirmacion antes de accion irreversible.

## Bug 10 - Validacion descripcion carga

- Quitar alerta si descripcion cumple minimo.
- Validar con trim, no con longitud vieja en state stale.

## Bug 11 - Limpieza UI critica

- Quitar "Rutas optimizadas por IA" si no existe valor real.
- Quitar "Pago administrado por KargaX" del wizard si confunde.
- Quitar tarjetas guardadas Mercado Pago del checkout si no estan listas.
- Boton "Activar plan Enterprise" debe ser naranja o CTA consistente.
- En publicar carga, quitar campos globales redundantes `Peso (kg)`, `Largo (m)`, `Ancho (m)`, `Alto (m)`, `Cantidad` cuando el manifiesto ya captura items y calcula peso/volumen al final.
- Si por compatibilidad DB todavia se requieren `weight_kg` o dimensiones, calcularlos desde `manifestItems` y no pedirlos dos veces al usuario.

## Bug 12 - Timeline settlement en espanol

- Traducir timeline a espanol.
- No mezclar `Settlement Timeline` con copy final.
- Usar nombres: liquidacion iniciada, pago confirmado, fondos disponibles, retiro solicitado, retiro pagado.

## Bug 13 - Resumen de medidas desde manifiesto

### Problema

El wizard de publicar oferta puede pedir medidas globales y luego pedir manifiesto por item, duplicando trabajo y generando errores.

### Regla objetivo

- El usuario agrega items de manifiesto.
- Cada item puede tener peso/medidas opcionales.
- Al final se calcula resumen: unidades, peso total, volumen total y faltantes.
- La oferta guarda valores agregados para compatibilidad con busqueda/precio.
- El usuario no debe llenar `Peso/Largo/Ancho/Alto/Cantidad` global si ya lleno manifiesto.

### QA

- Crear oferta con 3 items.
- Completar medidas en 2 items y dejar 1 pendiente.
- Ver resumen final con peso/volumen parcial.
- Publicar sin campos globales duplicados.
- La oferta conserva `manifest_items` y valores agregados consistentes.

## Definition of Done

- Todos los bugs tienen evidencia de navegador.
- No hay links productivos a localhost.
- No hay `Bucket not found` en publicacion.
- Settlement marketplace cuadra con ledger.
- Manifiestos preservan rechazos.
- Auth no entra en loops.
- La demo piloto no requiere explicar "esto falla pero luego se arregla".
