# 03 - E2E Marketplace, Viaje, Wallet y Retiro

> Esta es la prueba mas importante de dinero. Si pasa, KargaX puede cobrar un viaje, cerrar entrega y pagar al camionero.

## E2E-05: Oferta marketplace completa hasta wallet

### Que vas a probar

- Publicar oferta.
- Subir foto.
- Manifiesto.
- Postulacion.
- Aceptacion.
- Pago.
- Webhook/simulacion.
- PIN/POD.
- Settlement 8/92.
- Wallet.

### Necesitas

- Empresa owner.
- Camionero independiente.
- Imagen JPG/PNG menor a 2 MB.
- Si se puede, oferta de `2,000,000 COP` para revisar 8%.

### Pasos

1. Login como empresa.
2. Abre `/ofertas/publicar`.
3. Crea oferta marketplace.
4. Agrega manifiesto con 3 o 4 items.
5. Sube una imagen.
6. Publica la oferta.
7. Guarda `offerId`.
8. Login como camionero.
9. Abre `/ofertas`.
10. Postulate a la oferta.
11. Login como empresa.
12. Acepta al camionero.
13. Paga o simula el pago permitido.
14. Confirma que la empresa sigue logueada despues del pago.
15. Login como camionero.
16. Abre `/viaje/[offerId]`.
17. Haz cargue con evidencia.
18. Si hay items rechazados, marca rechazo con razon.
19. Haz entrega/POD con evidencia.
20. Abre `/billetera`.

### Tiene que pasar esto

- [ ] Imagen sube y se ve.
- [ ] Oferta queda publicada.
- [ ] Camionero se postula una sola vez.
- [ ] Empresa acepta al camionero correcto.
- [ ] Pago crea referencia e idempotencia.
- [ ] Empresa no pierde sesion post-pago.
- [ ] Cargue y entrega no dejan saltar pasos.
- [ ] Items rechazados no aparecen como cargados normales.
- [ ] Wallet del camionero recibe neto correcto.
- [ ] Tarjeta principal de `/billetera` es negra mate, muestra titular, cuenta KX, saldo disponible, en transito, total ganado y total retirado.
- [ ] Si valor fue `2,000,000`, comision esperada es `160,000` y neto `1,840,000`.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| offerId | |
| paymentId / requestId | |
| Valor bruto | |
| Comision KargaX | |
| Neto camionero | |
| Screenshot / evidencia | |

---

## E2E-06: Retiro seguro del camionero

### Que vas a probar

- Metodo de retiro.
- Saldo disponible.
- Payout manual/automatico.
- Idempotencia.
- Admin resolve.

### Necesitas

- Camionero con saldo disponible.
- Admin plataforma.
- Metodo Nequi o banco de prueba.

### Pasos

1. Login como camionero.
2. Abre `/billetera`.
3. Anota saldo disponible antes.
4. Confirma que la tarjeta negra mate muestra nombre del titular y monto sin cortar texto en mobile.
5. Agrega metodo Nequi o cuenta bancaria.
6. Solicita retiro menor o igual al saldo disponible.
7. Intenta repetir rapido la misma solicitud.
8. Anota saldo despues.
9. Login como admin.
10. Abre cola de payouts/retiros.
11. Revisa provider, estado e idempotency key.
12. Si esta en revision manual, resuelvelo con evidencia.

### Tiene que pasar esto

- [ ] No deja retirar mas del saldo disponible.
- [ ] Retiro crea payout attempt.
- [ ] Si automatic payouts esta apagado, queda `manual_review` o provider `manual`.
- [ ] Solicitud duplicada no paga dos veces.
- [ ] Saldo no queda negativo.
- [ ] Admin puede resolver con evidencia.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| Saldo antes | |
| Monto retiro | |
| Saldo despues | |
| payoutId / requestId | |
| Screenshot / evidencia | |




1. MIRA PARA POSTUALR OFERTAS EN MOVIL O NO SE APARECE LOS BOTONES VER DETALLES Y VER RQUISITOS NORMAL BRO, PERO EN ESTAS PANTALLAS VER DETALLES ESTA EN BLANCO TODO NO DEJA VER DETALLES OSEA ESE TEXTO POR EM¿NCIAM DEL BOTON, SOLO UCNAOD LOPRESIONO O DEJO MI DEDO AHI SI SE PONE NGER Y SI DEJA LEER VER DETALLES PORFA ANALIZA HERMNO Y SOLCUIONA ESO Y LO MISMO EN CNACELAR CUANDO YA LE HUNDI REQUISITOS SALE EN BALNCO EL BTON DE CANCEALR ESTA EN BLANCO Y CUANDO PONGO EL DEDO SE PONE NGERO DEJALSO EN NEGRO





