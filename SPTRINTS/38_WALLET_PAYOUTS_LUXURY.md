# CERRADO - Sprint 38: Wallet + Payouts Luxury

## Estado

- artifact status: `completed`
- prioridad: maxima para confianza del camionero
- rutas: `/billetera`

## Implementado

- `/billetera` fue redisenada como caja fuerte operativa monocromatica:
  - hero negro mate con saldo disponible gigante en `font-money`.
  - etiqueta `Operativo` visible sin lenguaje bancario.
  - saldo en transito, total ganado y total retirado dentro del panel principal.
  - CTA `Solicitar retiro` dentro del balance principal.
  - minimo de retiro visible antes de abrir el modal.
- Se agrego aviso financiero sobrio:
  - `Saldo operativo, no deposito bancario`.
  - copy de validacion, conciliacion y controles de seguridad.
- Se construyo resumen privado monocromatico:
  - ganancias por fletes.
  - gastos del viaje.
  - custodia pendiente.
  - operativo liberado.
- Se consolidaron metricas sin duplicacion visual:
  - movimientos recientes.
  - retiros pendientes.
  - viajes completados.
  - total retirado.
- Se agrego timeline de payout:
  - solicitado.
  - en revision.
  - aprobado.
  - pagado.
  - rechazado/devuelto.
- Se rehizo el bloque de metodo de retiro:
  - si existe metodo, muestra banco/metodo y ultimos 4 digitos.
  - si no existe, muestra Nequi, ahorros y corriente como opciones monocromas.
  - no expone cuenta completa ni documento completo en UI.
- Se rehizo el ledger/historial:
  - descripcion.
  - fuente humana.
  - referencia corta.
  - estado textual.
  - monto en `font-money`.
  - narrativa humana por tipo de movimiento.
  - ingreso/salida no depende de color.
- Se rehizo el modal de retiro completo:
  - paso 1: monto, saldo disponible, minimo visible y validacion de saldo.
  - paso 2: metodo, seleccionado por borde negro.
  - paso 3: datos, banco/celular/cuenta/titular/documento/guardar metodo/nota de validacion.
  - paso 4: confirmacion con KX monocromo y mensaje de aprobacion administrativa.
- Se mantuvo `validateWithdrawalDetails` y el contrato de `/api/wallet/withdraw`.
- Se mantuvo lending pausado:
  - `Pago expres no disponible en piloto`.
  - explica feature flag, compliance, capital/partner, disputa y auditoria.
  - no reactiva adelantos visualmente si `lendingPaused`.

## Objetivo

La billetera debe sentirse como una caja fuerte digital: sobria, adictiva por claridad, transparente en estados y elegante en cada movimiento. El camionero debe decir: `me da paz ver mi plata aqui`.

## Vista principal

- Balance:
  - panel negro mate.
  - saldo disponible gigante con mono font.
  - saldo en transito y total ganado debajo.
  - CTA `Solicitar retiro`.
  - etiqueta `Operativo`, no `bancario`, para evitar confusion legal.
- Aviso:
  - `Saldo operativo, no deposito bancario`.
  - explicar validacion, conciliacion y controles de seguridad.
- Resumen privado:
  - ganancias por fletes.
  - gastos del viaje.
  - custodia/pendientes.
  - todo monocromo.
- Metricas:
  - movimientos recientes.
  - retiros pendientes.
  - viajes.
  - retirado.

## Historial

- Timeline:
  - solicitado
  - en revision
  - aprobado
  - pagado
  - rechazado/devuelto
- Cada movimiento:
  - descripcion.
  - fuente.
  - referencia corta.
  - estado.
  - monto mono.
  - narrativa humana.
- QA:
  - montos positivos/negativos no dependen de color.
  - referencia visible sin exponer datos sensibles.

## Metodo de retiro

- Si existe metodo:
  - banco/metodo.
  - ultimos 4 digitos.
  - icono monocromo.
- Si no existe:
  - Nequi, ahorros, corriente como opciones monocromas.
  - texto: `Configura tu metodo al solicitar tu primer retiro`.
- QA:
  - no guardar datos sensibles en UI.

## Modal retiro

- Paso 1: monto.
  - saldo disponible arriba.
  - input grande.
  - minimo visible.
- Paso 2: metodo.
  - Nequi, ahorros, corriente.
  - seleccionado por borde negro.
- Paso 3: datos.
  - banco si aplica.
  - cuenta/celular.
  - titular.
  - documento.
  - checkbox guardar metodo.
  - nota de validacion.
- Paso 4: enviado.
  - KX o check monocromo.
  - mensaje: `Solicitud registrada y pendiente de aprobacion administrativa`.
- QA:
  - validacion `validateWithdrawalDetails` intacta.
  - `/api/wallet/withdraw` intacto.
  - no permitir monto menor a 50000.
  - no permitir saldo negativo.

## Advances pausados

- Mantener visible solo como bloque informativo si `lendingPaused`.
- Copy:
  - `Pago expres no disponible en piloto`.
  - explicar feature flag, compliance y capital/partner.
- QA:
  - no reactivar lending visual.

## Definition of Done

- Billetera completa monocroma. OK
- Retiro se entiende sin manual. OK
- Estados financieros conservan trazabilidad. OK
- Montos positivos/negativos no dependen de color. OK
- Referencias visibles sin exponer datos sensibles. OK
- Lending no se reactiva visualmente durante piloto. OK
- El usuario siente confianza, no ansiedad. OK

## QA ejecutado

- `npm run typecheck` en `frontend`: OK.
- `npx eslint src/app/billetera/page.tsx` en `frontend`: OK.
- Busqueda focalizada de colores heredados en `src/app/billetera/page.tsx`: OK, sin `green`, `blue`, `emerald`, `amber`, `orange`, `violet`, `purple`, `red` ni `#E6007E`.
- No se ejecuto `build` final por instruccion expresa del owner; se hara build general aparte.
