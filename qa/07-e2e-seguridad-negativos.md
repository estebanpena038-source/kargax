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

- [ ] API privada sin login no devuelve datos.
- [ ] Empresa B no ve datos de Empresa A.
- [ ] Script se ve como texto, no se ejecuta.
- [ ] Camionero no entra a admin.
- [ ] Errores son claros, no stack traces.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| Empresa A | |
| Empresa B | |
| Payload XSS probado | |
| Screenshots | |

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

- [ ] Lending no aparece activo.
- [ ] Advances API no crea solicitud nueva.
- [ ] Links no tienen `localhost`.
- [ ] Rate limit no rompe la app y responde claro.
- [ ] No permite retirar mas del disponible.
- [ ] No duplica pago ni retiro.
- [ ] No aparecen secretos en respuestas o logs visibles.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| Links revisados | |
| Rate limit probado | SI / NO |
| Doble click probado | SI / NO |
| Screenshots | |

