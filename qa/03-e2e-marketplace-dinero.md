# 03 - E2E Marketplace, Viaje, Wallet y Payout

> Esta es la prueba mas importante de dinero marketplace. Si pasa, KargaX puede cobrar un viaje, cerrar entrega, liberar saldo marketplace y crear payout operativo sin mezclar flota privada.

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
- Wallet marketplace.
- Payout operativo o fallback manual.

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
21. Confirma que el saldo aparece en el carril `Marketplace freelancer`, no en `Flota privada`.
22. Si el camionero tiene metodo default y `automatic_payouts_enabled=true`, confirma que existe `payout_attempt`.

### Tiene que pasar esto

- [ ] Imagen sube y se ve.
- [ ] Oferta queda publicada.
- [ ] Camionero se postula una sola vez.
- [ ] Empresa acepta al camionero correcto.
- [ ] Pago crea referencia e idempotencia.
- [ ] Empresa no pierde sesion post-pago.
- [ ] Cargue y entrega no dejan saltar pasos.
- [ ] Items rechazados no aparecen como cargados normales.
- [ ] Wallet marketplace del camionero recibe neto correcto como `trip_deposit`.
- [ ] `transactions.money_rail = marketplace_freelancer`.
- [ ] `transactions.payout_eligible = true`.
- [ ] Tarjeta principal de `/billetera` es negra mate, muestra titular, cuenta KX y `Marketplace retirable` sin cortar texto en mobile.
- [ ] `/billetera` muestra secciones separadas: `Marketplace freelancer` y `Flota privada`.
- [ ] Flota privada no suma ni altera el saldo marketplace de esta prueba.
- [ ] Si hay payout automatico, `payout_attempt.provider` es `cobre` y queda `queued|processing|paid|failed|manual_review` segun ambiente.
- [ ] Si automatic payouts esta apagado, no se llama proveedor real y el saldo marketplace queda disponible para retiro manual.
- [ ] Si valor fue `2,000,000`, comision esperada es `160,000` y neto `1,840,000`.

### Validacion DB

```sql
select id,
       type,
       status,
       amount,
       money_rail,
       payout_eligible,
       locked_for_payout,
       external_proof_only,
       payout_attempt_id,
       metadata
from public.transactions
where offer_id = '<offerId>'
order by created_at desc;

select id,
       provider,
       method,
       amount_cop,
       status,
       idempotency_key,
       provider_transfer_id,
       receipt_url,
       destination_snapshot,
       provider_payload
from public.payout_attempts
where offer_id = '<offerId>'
order by created_at desc;
```

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
| marketplaceWallet.availableCop antes/despues | |
| transactionId trip_deposit | |
| payoutAttemptId si aplica | |
| Screenshot / evidencia | |

---

## E2E-06: Retiro seguro marketplace del camionero

### Que vas a probar

- Metodo de retiro.
- Saldo marketplace retirable.
- Payout manual/automatico por cola.
- Idempotencia.
- Admin resolve.
- No retirar liquidaciones privadas.

### Necesitas

- Camionero con `marketplaceWallet.availableCop >= 50.000`.
- Admin plataforma.
- Metodo Nequi o banco de prueba.

### Pasos

1. Login como camionero.
2. Abre `/billetera`.
3. Anota `Marketplace retirable` antes.
4. Confirma que la tarjeta negra mate muestra nombre del titular y monto sin cortar texto en mobile.
5. Agrega metodo Nequi o cuenta bancaria.
6. Solicita retiro menor o igual al saldo marketplace retirable.
7. Intenta repetir rapido la misma solicitud.
8. Anota saldo marketplace despues.
9. Login como admin.
10. Abre cola de payouts/retiros.
11. Revisa provider, metodo, estado, idempotency key y destino enmascarado.
12. Si esta en revision manual, resuelvelo con evidencia o marca retry.
13. Confirma que liquidaciones privadas externas no pueden retirarse desde este flujo.

### Tiene que pasar esto

- [ ] No deja retirar mas del saldo marketplace retirable.
- [ ] Retiro crea `transactions.type = withdrawal` con `money_rail = marketplace_freelancer`.
- [ ] Retiro crea `payout_attempt` con `destination_snapshot` para provider y `provider_payload` enmascarado.
- [ ] Si automatic payouts esta apagado, queda `manual_review` o provider `manual`.
- [ ] Si automatic payouts esta prendido, provider esperado es `cobre` y status inicial `queued`.
- [ ] Solicitud duplicada no paga dos veces.
- [ ] Saldo no queda negativo.
- [ ] Admin puede resolver con evidencia.
- [ ] `privateFleetLedger` no aumenta `marketplaceWallet.availableCop`.

### Validacion DB

```sql
select id,
       type,
       status,
       amount,
       money_rail,
       locked_for_payout,
       payout_attempt_id,
       metadata
from public.transactions
where wallet_id = '<walletId>'
  and type = 'withdrawal'
order by created_at desc
limit 10;

select id,
       provider,
       method,
       amount_cop,
       status,
       idempotency_key,
       destination_snapshot,
       provider_payload,
       provider_response,
       failure_reason
from public.payout_attempts
where user_id = '<truckerUserId>'
order by created_at desc
limit 10;
```

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| Marketplace retirable antes | |
| Monto retiro | |
| Marketplace retirable despues | |
| payoutId / requestId | |
| Screenshot / evidencia | |




1. MIRA PARA POSTUALR OFERTAS EN MOVIL O NO SE APARECE LOS BOTONES VER DETALLES Y VER RQUISITOS NORMAL BRO, PERO EN ESTAS PANTALLAS VER DETALLES ESTA EN BLANCO TODO NO DEJA VER DETALLES OSEA ESE TEXTO POR EM¿NCIAM DEL BOTON, SOLO UCNAOD LOPRESIONO O DEJO MI DEDO AHI SI SE PONE NGER Y SI DEJA LEER VER DETALLES PORFA ANALIZA HERMNO Y SOLCUIONA ESO Y LO MISMO EN CNACELAR CUANDO YA LE HUNDI REQUISITOS SALE EN BALNCO EL BTON DE CANCEALR ESTA EN BLANCO Y CUANDO PONGO EL DEDO SE PONE NGERO DEJALSO EN NEGRO




