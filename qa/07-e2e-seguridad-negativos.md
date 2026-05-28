# 07 - E2E Seguridad y Pruebas Negativas

> Esta prueba intenta romper cosas importantes. Si algo de aqui falla, NO se lanza piloto.

## E2E-13: Seguridad de acceso y datos

### Que vas a probar

- APIs privadas.
- Empresa A/B.
- XSS basico.
- Roles sin permiso.
- Admin protegido.
- Storage.

### Necesitas

- Empresa A.
- Empresa B.
- Camionero.
- Usuario sin sesion.
- Admin.

### Pasos

1. Sin login, abre una API privada como `/api/warehouses`.
2. Confirma 401/403.
3. Login como Empresa A.
4. Copia URL de una bodega/oferta/reporte de Empresa A.
5. Login como Empresa B.
6. Intenta abrir esa URL.
7. Crea una oferta o texto con `<script>alert('hack')</script>` si el campo lo permite.
8. Revisa listado y detalle.
9. Login como camionero.
10. Intenta abrir `/admin`.
11. Intenta ver datos de otra empresa.

### Tiene que pasar esto

- [x] API privada sin login no devuelve datos.
- [x] Empresa B no ve datos de Empresa A.
- [ ] Script se ve como texto, no se ejecuta.
- [ ] Camionero no entra a admin.
- [x] Errores son claros, no stack traces.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PARTIAL |
| Fecha y hora | 2026-05-28 |
| Empresa A | URL bodega A: `/bodegas/5e05ec02-696d-4229-8be3-7e752c55906e/evidencia-digital` |
| Empresa B | Misma URL respondio `Warehouse not found or access denied` |
| Payload XSS probado | |
| Screenshots | |

Notas:

- API privada sin login probada con `/api/warehouses`: 401 `Authentication required`.
- Falta cerrar XSS, camionero contra `/admin` y storage antes de marcar E2E-13 como PASS total.

---

## E2E-14: Bloqueantes financieros y de produccion

### Que vas a probar

- Lending pausado.
- No secrets.
- Rate limit.
- Links sin localhost.
- Retiro no supera saldo.
- Doble click no duplica pago/retiro.

### Necesitas

- Camionero.
- Empresa.
- Admin si aplica.

### Pasos

1. Busca en UI publica: `adelanto`, `credito`, `prestamo`, `pago expres`.
2. Abre wallet camionero y confirma que no hay solicitud de adelanto activa.
3. Intenta llamar API de advances si existe.
4. Debe responder `FEATURE_DISABLED` o bloqueo claro.
5. Solicita reset password y revisa link.
6. Genera invitacion de equipo/flota y revisa link.
7. Intenta varios logins fallidos hasta ver rate limit si aplica.
8. En retiro, intenta monto mayor al disponible.
9. En pago/retiro, intenta doble click o repetir accion.

### Tiene que pasar esto

- [x] Lending no aparece activo.
- [x] Advances API no crea solicitud nueva.
- [x] Links no tienen `localhost`.
- [x] Rate limit no rompe la app y responde claro.
- [x] No permite retirar mas del disponible.
- [ ] No duplica pago ni retiro.
- [x] No aparecen secretos en respuestas o logs visibles.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PARTIAL - fix desplegado, pendiente retest manual |
| Fecha y hora | 2026-05-28 |
| Links revisados | Reset password con redirect a `https://kargax-staging.vercel.app/auth/reset-password`; sin `localhost` |
| Rate limit probado | SI - primer 429 en intento 25 contra `/api/auth/session` |
| Doble click probado | NO - backend y UI endurecidos con idempotencia; falta repetir con camionero AAL2 real |
| Screenshots | |

Notas:

- Lending/adelantos no aparece activo en UI publica: validado manualmente por QA.
- API `/api/advances` con camionero QA autenticado devolvio 403: `Los adelantos KargaX estan pausados durante Acceso Operativo.` Conteo antes/despues en `fuel_advances`: 0 -> 0 para el usuario temporal.
- Reset password tenia bug real: permitia quedar con la sesion anterior despues de actualizar password. Se corrigio para exigir enlace de recuperacion valido y cerrar sesion global al guardar la nueva contrasena.
- Pendiente retest reset password: abrir el link del correo, cambiar contrasena, confirmar que la contrasena vieja ya no entra y la nueva si entra.
- Pendiente retest doble click/reintento: con camionero real que tenga AAL2, enviar dos veces el mismo retiro y confirmar una sola transaccion activa `withdrawal` y un solo `payout_attempt` por `idempotency_key`.
- Secret scan en respuestas visibles PASS: `/api/warehouses`, `/api/jobs/payouts/process`, `/api/health` y `/api/advances` no expusieron secretos ni stack traces.
