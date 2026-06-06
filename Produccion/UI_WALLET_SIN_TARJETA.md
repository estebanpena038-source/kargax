# Wallet sin tarjeta visual â€” especificaciÃ³n de UI

## Objetivo

Quitar la tarjeta tipo crÃ©dito/dÃ©bito de `/billetera` y reemplazarla por un panel de saldo operativo claro, seguro y coherente con el mensaje de KargaX:

> KargaX Wallet es un ledger operativo de marketplace, no una tarjeta, no una cuenta bancaria, no un depÃ³sito y no un producto de crÃ©dito.

## Archivo principal

```text
frontend/src/app/billetera/page.tsx
```

## Problema actual

La vista tiene una secciÃ³n superior con estÃ©tica de tarjeta premium:

- `aria-label="Tarjeta premium KargaX Wallet"`
- fondo negro tipo tarjeta,
- proporciÃ³n tipo tarjeta bancaria,
- chip visual,
- nÃºmero tipo tarjeta (`walletCardNumber`),
- â€œTitularâ€,
- â€œKX Verifiedâ€,
- Ã­cono `CreditCard` en mÃ©todo de retiro.

Aunque la lÃ³gica de fondo sÃ­ separa marketplace/private fleet y explica â€œno producto financieroâ€, el visual puede comunicar lo contrario.

## Principio de reemplazo

Cambiar de:

```text
Tarjeta premium / look bancario
```

a:

```text
Panel operativo / ledger / saldo para retiro
```

## Copy aprobado

### TÃ­tulo

```text
Saldo operativo KargaX
```

### SubtÃ­tulo

```text
Ledger marketplace para retiros verificados
```

### AclaraciÃ³n

```text
Este panel muestra saldo operativo de marketplace confirmado. No es una tarjeta, cuenta bancaria, depÃ³sito ni producto de crÃ©dito. Las liquidaciones privadas externas se registran como soporte y no aumentan el saldo disponible para retiro.
```

### CTA

```text
Solicitar retiro
```

## Layout nuevo

### Bloque principal

Tarjeta blanca normal de dashboard, no tarjeta bancaria.

```text
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Saldo operativo KargaX                                  â”‚
â”‚ Ledger marketplace para retiros verificados             â”‚
â”‚ Copy legal corto                                        â”‚
â”‚                                                         â”‚
â”‚ Disponible para retiro      $XXX.XXX                    â”‚
â”‚ [Solicitar retiro]                                      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### MÃ©tricas debajo

Cuatro tiles:

1. Disponible para retiro.
2. Pendiente marketplace.
3. En proceso de retiro.
4. Pagado este mes.

Cada tile debe tener:

- label corto,
- monto,
- descripciÃ³n humana,
- icono no bancario agresivo: `Wallet`, `ShieldCheck`, `Clock`, `BadgeCheck`, `Landmark` solo para destino bancario.

## Variables existentes que se deben reutilizar

No cambiar lÃ³gica. Reusar:

- `withdrawableMarketplaceBalance`
- `marketplaceWallet?.pendingReleaseCop`
- `marketplaceWallet?.payoutProcessingCop`
- `marketplaceWallet?.paidThisMonthCop`
- `canWithdraw`
- `openWithdrawModal`
- `MIN_WITHDRAWAL_AMOUNT`
- `formatCOP`
- `privateFleetLedger`
- `pendingWithdrawals`

## Elementos a eliminar o renombrar

| Elemento | AcciÃ³n |
|---|---|
| `aria-label="Tarjeta premium KargaX Wallet"` | Cambiar a `aria-label="Panel de saldo operativo KargaX Wallet"`. |
| Chip visual con grid | Eliminar. |
| Aspect ratio `aspect-[1.586/1]` | Eliminar. |
| NÃºmero tipo tarjeta | Eliminar si solo era decorativo. |
| `walletCardNumber` | Eliminar si queda sin uso. |
| Copy â€œTarjeta premiumâ€ | Eliminar. |
| `CreditCard` como icono principal | Reemplazar por `Wallet`, `ShieldCheck` o `Landmark` segÃºn contexto. |

## PseudocÃ³digo recomendado

```tsx
<motion.section
  initial={{ opacity: 0, y: 18 }}
  animate={{ opacity: 1, y: 0 }}
  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_48px_-38px_rgba(10,10,10,.55)]"
  aria-label="Panel de saldo operativo KargaX Wallet"
>
  <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
        Saldo operativo KargaX
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-950">
        Ledger marketplace para retiros verificados
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
        Este panel muestra saldo operativo de marketplace confirmado. No es una tarjeta,
        cuenta bancaria, deposito ni producto de credito. Las liquidaciones privadas externas
        se registran como soporte y no aumentan el saldo disponible para retiro.
      </p>
    </div>

    <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-4 text-white lg:min-w-72">
      <p className="text-xs uppercase tracking-[0.18em] text-white/50">
        Disponible para retiro
      </p>
      <p className="font-money mt-2 text-3xl font-semibold">
        {formatCOP(withdrawableMarketplaceBalance || 0)}
      </p>
      <Button
        onClick={openWithdrawModal}
        disabled={!canWithdraw}
        variant="secondary"
        className="mt-4 h-12 w-full"
      >
        <ArrowUpCircle className="h-4 w-4" />
        Solicitar retiro
      </Button>
    </div>
  </div>

  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <MetricTile
      label="Pendiente marketplace"
      value={formatCOP(marketplaceWallet?.pendingReleaseCop || 0)}
      detail="Viajes confirmados en proceso de liberacion."
      icon={Clock}
    />
    <MetricTile
      label="En proceso de retiro"
      value={formatCOP(marketplaceWallet?.payoutProcessingCop || 0)}
      detail="Saldo reservado por solicitudes activas."
      icon={ShieldCheck}
    />
    <MetricTile
      label="Pagado este mes"
      value={formatCOP(marketplaceWallet?.paidThisMonthCop || 0)}
      detail="Retiros completados en el periodo."
      icon={BadgeCheck}
    />
    <MetricTile
      label="Base marketplace"
      value={formatCOP(marketplaceWallet?.derivedAvailableCop || 0)}
      detail="Saldo validado por ledger operativo."
      icon={Wallet}
    />
  </div>
</motion.section>
```

Si no existe `MetricTile`, crear componente local simple dentro del archivo o reutilizar patrÃ³n de cards existente. No introducir librerÃ­as nuevas.

## MÃ©todo de retiro

La secciÃ³n â€œDestino seguroâ€ puede quedarse, pero ajustar iconos:

- Header: `ShieldCheck` o `Landmark`.
- Nequi: `Smartphone`.
- Cuenta de ahorros/corriente: `Landmark`.
- MÃ©todo guardado: `BadgeCheck`.

Evitar `CreditCard` porque el usuario pidiÃ³ quitar tarjeta y porque sugiere tarjeta de crÃ©dito.

## Textos prohibidos en UI wallet

Evitar:

- â€œtarjetaâ€
- â€œcrÃ©ditoâ€
- â€œcuenta KargaXâ€ si parece cuenta bancaria
- â€œdepÃ³sitoâ€
- â€œrendimientoâ€
- â€œinterÃ©sâ€
- â€œsaldo garantizadoâ€
- â€œbancoâ€ para KargaX

Permitido:

- â€œsaldo operativoâ€
- â€œledger marketplaceâ€
- â€œdisponible para retiroâ€
- â€œretiro solicitadoâ€
- â€œdestino de retiroâ€
- â€œcomprobante externoâ€
- â€œsoporte operativoâ€

## QA visual

### Mobile 320px

- No overflow horizontal.
- Monto grande no rompe layout.
- CTA ocupa ancho completo.
- Cards apiladas.

### Tablet 768px

- MÃ©tricas en 2 columnas.
- Copy legible.

### Desktop

- Panel principal + CTA a la derecha.
- MÃ©tricas en 4 columnas.

## QA funcional

1. Usuario no trucker: sigue viendo bloqueo.
2. Trucker sin saldo: ve saldo cero y CTA disabled.
3. Trucker con saldo < mÃ­nimo: CTA disabled o validaciÃ³n mantiene mÃ­nimo.
4. Trucker con saldo suficiente: CTA abre modal.
5. MÃ©todo guardado: cuenta enmascarada.
6. Retiro pendiente: saldo en proceso se refleja.
7. Flota privada: no suma a saldo retirables.
8. Lending pausado: copy sigue igual.
9. Historial: no cambia.
10. API withdrawal: no cambia.

## Criterio de aceptaciÃ³n final

- No queda visual tipo tarjeta bancaria.
- No queda `walletCardNumber` si era decorativo.
- No queda `CreditCard` como icono principal de wallet.
- Copy deja claro â€œno producto financieroâ€.
- Tests/build pasan.
- Screenshot antes/despuÃ©s guardado en evidencia.
