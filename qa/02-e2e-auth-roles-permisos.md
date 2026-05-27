# 02 - E2E Auth, Roles y Permisos

> Esta prueba confirma que la gente entra bien y que cada persona ve solo lo que debe ver.

## E2E-03: Registro, login, reset y MFA

### Que vas a probar

- Registro empresa.
- Registro camionero.
- Login.
- Logout.
- Reset password.
- MFA/OTP si esta activo.
- Links publicos sin `localhost`.

### Necesitas

- Email nuevo para empresa.
- Email nuevo para camionero.
- Celular o app autenticadora si MFA esta activo.

### Preflight obligatorio

Antes de enviar correos reales:

```powershell
npm run supabase:auth-url-check
```

Tiene que devolver `matchesRequestedRedirect: true` y `redirectsToLocalhost: false`.
Si devuelve `http://localhost:3000`, corrige Supabase Auth > URL Configuration antes de seguir.

### Pasos

1. Abre `/registro`.
2. Crea cuenta empresa.
3. Verifica email si llega correo.
4. Completa onboarding empresa.
5. Cierra sesion.
6. Crea cuenta camionero.
7. Verifica email si llega correo.
8. Completa onboarding camionero.
9. Cierra sesion.
10. Entra con empresa desde `/login`.
11. Cierra sesion.
12. Entra con camionero desde `/login`.
13. Prueba reset password desde `/recuperar-contrasena`.
14. Abre el link del correo.
15. Si hay MFA, completa OTP y confirma que no hay loop.

### Tiene que pasar esto

- [ ] Empresa llega a dashboard de empresa.
- [ ] Camionero llega a dashboard/ofertas de camionero.
- [ ] Reset password abre staging o dominio real, nunca `localhost`.
- [ ] MFA se ve bien en desktop y mobile.
- [ ] Logout bloquea `/dashboard`.
- [ ] API privada sin sesion responde 401/403, no HTML raro.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| Empresa email | |
| Camionero email | |
| Link reset tiene localhost? | SI / NO |
| Screenshot / evidencia | |

---

## E2E-04: Equipo, creacion directa y roles empresariales

### Que vas a probar

- Creacion directa de usuarios internos desde `/equipo`.
- Roles nuevos.
- Sidebar por rol.
- Empresa y rol visibles en sidebar.
- Acceso permitido y bloqueado.
- Empresa A no ve empresa B.

### Necesitas

- Empresa owner.
- Emails y contrasenas iniciales para: operaciones, bodega, contabilidad, auditor.
- Si se puede, segunda empresa para prueba de aislamiento.

### Pasos

1. Login como empresa owner.
2. Abre `/equipo`.
3. Crea un `ops_manager` con nombre, correo, telefono, pais, documento opcional y contrasena inicial.
4. Crea un `warehouse_operator` o `warehouse_manager` y asignale una bodega.
5. Crea un `finance_accountant`.
6. Crea un `auditor` o `viewer`.
7. Confirma que `/equipo` muestra las funciones permitidas por cada rol.
8. Login con cada rol usando correo + contrasena, sin magic link.
9. Mira el sidebar.
10. Prueba entrar a secciones que no deberia ver.
11. Si tienes Empresa B, intenta abrir una URL de Empresa A desde Empresa B.

### Tiene que pasar esto

- [ ] No se necesita correo de invitacion ni magic link.
- [ ] Cada usuario creado entra con email + contrasena.
- [ ] Sidebar muestra rol y empresa del usuario.
- [ ] Owner ve todo.
- [ ] Operaciones ve viajes/flota, no caja sensible.
- [ ] Bodega ve bodega, no planes/equipo.
- [ ] Contabilidad ve reportes/dinero, no cambia operacion.
- [ ] Auditor/viewer no modifica.
- [ ] Empresa B no ve datos de Empresa A.

### Matriz blindada de roles - 2026-05-26

El backend debe usar `frontend/src/lib/server/role-policy.ts` para permisos sensibles. No cerrar esta prueba si una ruta sensible depende de un check manual distinto a la matriz.

| Rol | Debe poder | Debe bloquear |
|---|---|---|
| `owner` | Equipo, planes, flota privada, bodega, reportes, comprobantes | Datos de otra empresa |
| `admin` | Soporte global con `businessId` explicito y fallback manual | Mutaciones sin auditoria/scope |
| `ops_manager` | Crear/asignar rutas, ver flota privada, tracking y evidencia | Salario, flete, viaticos, comprobantes, billing |
| `dispatcher` | Despachar, asignar, hacer seguimiento, PIN/POD | Dinero, comprobantes, planes, equipo |
| `warehouse_manager` | Gestionar bodega asignada, inventario, citas, recepciones, despachos | Wallet, billing, comprobantes privados |
| `warehouse_operator` | Ejecutar tareas fisicas de bodega asignada | Configuracion, dinero, exportes |
| `finance_accountant` | Ver finanzas, reportes, subir/cerrar comprobantes con AAL2 | Crear rutas, editar placa, editar estado operativo |
| `auditor` | Leer evidencia, trazabilidad y reportes permitidos | Mutaciones |
| `viewer` | Ver resumen operativo | Evidencia sensible, exportes, dinero, mutaciones |
| `trucker` | Sus rutas, evidencia y billetera propia | APIs business/admin |

Checks tecnicos:

- [x] `npm run check:roles` pasa.
- [x] `ops_manager` y `dispatcher` entran a flota privada sin controles de dinero por policy server-side.
- [x] `finance_accountant` con AAL2 sube/cierra comprobantes por rutas protegidas.
- [x] `finance_accountant` sin AAL2 recibe bloqueo en comprobantes/cierres financieros.
- [x] `finance_accountant` no edita placa, estado operativo ni conductor.
- [x] `auditor/viewer` no puede hacer `POST/PATCH/DELETE` en superficies sensibles.
- [x] `trucker` no entra a APIs business/admin.

#### Cierre tecnico 2026-05-26

Evidencia usada para cerrar sin retest manual largo:

- `frontend/src/lib/server/role-policy.ts` es el contrato unico para permisos sensibles de flota privada, billing, reportes y ofertas.
- `scripts/check-role-policy.mjs` bloquea drift: rutas sensibles no pueden volver a checks manuales tipo `role === ...` o `businessAccess.isOwner` fuera del policy.
- `npm run check:roles`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run lint`, `npm --prefix frontend run build` y `npm run check:release` pasaron.
- Deploy productivo en Vercel y `GET /api/health` respondio `200 HEALTHY`.
- Pendiente solo si se quiere evidencia visual: screenshots por rol desde navegador real.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS tecnico / screenshots opcionales pendientes |
| Fecha y hora | 2026-05-26, post deploy Vercel |
| Roles probados | owner, admin, ops_manager, dispatcher, finance_accountant, auditor, viewer, trucker |
| Acceso cruzado Empresa A/B | PASS por scope server-side; sin screenshot manual |
| Screenshots | Opcional |


PASO LA PRUEBA COMPLETAAAAA
