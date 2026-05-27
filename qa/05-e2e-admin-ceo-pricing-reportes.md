# 05 - E2E Admin, CEO, Pricing y Reportes

> Esta prueba dice si el equipo puede operar el piloto, cobrar planes y explicar resultados.

## E2E-09: Admin y CEO control tower

### Que vas a probar

- Admin protegido.
- CEO tower.
- Health.
- Incidentes.
- Payouts.
- Pagos.
- Reconcile.
- Datos no sensibles.

### Necesitas

- Platform admin.
- Empresa normal.
- Camionero normal.
- Al menos un pago/retiro/viaje creado en pruebas anteriores.

### Pasos

1. Login como platform admin.
2. Abre `/admin` o `/admin/ceo`.
3. Revisa usuarios, viajes, WMS, flota, dinero, retiros y planes.
4. Revisa health/readiness.
5. Busca un pago o retiro de prueba.
6. Haz reconcile o revisa estado si aplica.
7. Guarda requestId.
8. Cierra sesion.
9. Login como empresa normal.
10. Intenta abrir `/admin`.
11. Login como camionero.
12. Intenta abrir `/admin`.

### Tiene que pasar esto

- [ ] Admin ve tablero.
- [ ] Empresa normal no entra.
- [ ] Camionero no entra.
- [ ] Metricas tienen fuente o periodo.
- [ ] Admin puede diagnosticar pagos/retiros.
- [ ] No se ven tokens, documentos completos ni cuentas sin mascara.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| Admin usado | |
| requestId | |
| Screenshots | |

---

## E2E-10: Pricing, paywalls y reportes

### Que vas a probar

- Free bloquea limites.
- Piloto generoso.
- Paywall claro.
- Dashboard inteligencia.
- PDF contable.
- Roles financieros.

### Necesitas

- Empresa Free o con limites.
- Empresa piloto si existe.
- Usuario finance/accounting.
- Viajes con datos.

### Pasos

1. Login como empresa Free.
2. Intenta crear mas recursos de los permitidos: bodega, usuario o conductor privado.
3. Lee el paywall.
4. Confirma que dice limite actual y plan recomendado.
5. Si hay empresa piloto, confirma que permite limites altos y muestra vencimiento.
6. Abre `/dashboard/inteligencia`.
7. Revisa marketplace, flota, rutas y conductores.
8. Login como finance/accountant.
9. Confirma que ve dinero/reportes.
10. Login como rol operativo.
11. Confirma que no ve montos sensibles.
12. Exporta PDF o reporte si existe.

### Tiene que pasar esto

- [x] Free bloquea bien por guards server-side cuando el plan tiene tope.
- [x] Paywall no dice solo "actualiza"; explica limite actual y plan recomendado.
- [x] Piloto/Enterprise permite limites altos o ilimitados segun configuracion.
- [ ] Dashboard muestra datos reales.
- [ ] Finance ve dinero.
- [ ] Operativo no ve dinero sensible.
- [ ] PDF tiene periodo, empresa y montos correctos.

### Cierre tecnico de limites - 2026-05-26

Verificado por codigo, build y DB:

| Recurso | Implementacion | Estado |
|---|---|---|
| Bodegas activas | `enforceWarehouseCreateLimit` / `enforceWarehouseActivationLimit` | PASS |
| Usuarios internos | `enforceBusinessTeamSeatLimit` | PASS |
| Viajes mensuales | `enforceMonthlyTripLimit` | PASS |
| Conductores privados | `enforcePrivateFleetDriverLimit` | PASS |

TASYUAYSAU esta en plan `enterprise` activo. Uso observado: 2 bodegas, 4 usuarios internos, 25 viajes del mes y 1 conductor privado. Como Enterprise tiene limites `null`, no se espera bloqueo para esa empresa; el bloqueo aplica a Free/Growth/Scale cuando superan su tope.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS tecnico para limites / pendiente visual para reportes y PDF |
| Fecha y hora | 2026-05-26, post deploy Vercel |
| Plan probado | Enterprise TASYUAYSAU + matriz de planes en DB |
| Paywall probado | Guard server-side `PLAN_LIMIT_REACHED`; screenshot opcional |
| PDF exportado | SI / NO |
| Screenshot / evidencia | |
