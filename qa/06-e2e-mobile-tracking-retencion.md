# 06 - E2E Mobile, Tracking y Retencion

> Esta prueba confirma que el camionero puede trabajar desde celular y que KargaX ayuda a retener usuarios.

## E2E-11: Tracking GPS PWA con offline

### Que vas a probar

- Mobile.
- GPS foreground.
- Permiso concedido/denegado.
- Cola offline.
- Reconexion.
- Permisos de lectura.

### Necesitas

- Viaje asignado al camionero.
- Celular Android Chrome.
- Si se puede, iPhone Safari.
- Empresa propietaria del viaje.

### Pasos

1. En celular, login como camionero asignado.
2. Abre `/viaje/[offerId]`.
3. Inicia tracking.
4. Acepta permiso GPS.
5. Espera primer ping.
6. Corta internet.
7. Espera que la cola local suba.
8. Reconecta internet.
9. Confirma que la cola se envia.
10. Login como empresa.
11. Abre tracking del viaje.
12. Login como otro camionero.
13. Intenta ver/enviar tracking de ese viaje.

### Tiene que pasar esto

- [ ] Tracking inicia en foreground.
- [ ] UI muestra ultima sincronizacion.
- [ ] Offline guarda cola.
- [ ] Online envia cola.
- [ ] Empresa propietaria puede leer.
- [ ] Otro camionero recibe 403 o bloqueo.
- [ ] La UI no promete GPS en background.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| Dispositivo | |
| offerId | |
| Ultimo ping | |
| Screenshot / video | |

---

## E2E-12: Score, notificaciones y landing camionero

### Que vas a probar

- Score camionero.
- Badge.
- Notificaciones no duplicadas.
- Notificaciones leidas.
- Landing camioneros.
- Copy sin lending.

### Necesitas

- Camionero con viajes o datos semilla.
- Empresa con postulaciones.

### Pasos

1. Login como camionero.
2. Abre perfil o dashboard.
3. Revisa score/tier.
4. Login como empresa.
5. Abre postulaciones y busca badge del camionero.
6. Dispara evento de notificacion: postulacion aceptada, pago liquidado o ruta privada.
7. Revisa notificaciones.
8. Marca una como leida.
9. Refresca.
10. Abre `/para-camioneros` en mobile y desktop.

### Tiene que pasar esto

- [ ] Score se basa en viajes reales, no en lending.
- [ ] Badge aparece en postulaciones.
- [ ] Notificacion no se duplica por el mismo evento.
- [ ] Leida queda leida.
- [ ] Landing mobile se ve bien.
- [ ] No dice adelantos, credito, prestamo ni pago expres.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| Camionero | |
| Score/tier | |
| Notificacion probada | |
| Screenshots | |

