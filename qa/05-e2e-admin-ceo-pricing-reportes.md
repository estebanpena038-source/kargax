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

- [ ] Free bloquea bien.
- [ ] Paywall no dice solo "actualiza"; debe explicar el limite.
- [ ] Piloto tiene fecha de vencimiento.
- [ ] Dashboard muestra datos reales.
- [ ] Finance ve dinero.
- [ ] Operativo no ve dinero sensible.
- [ ] PDF tiene periodo, empresa y montos correctos.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| Plan probado | |
| Paywall probado | |
| PDF exportado | SI / NO |
| Screenshot / evidencia | |

