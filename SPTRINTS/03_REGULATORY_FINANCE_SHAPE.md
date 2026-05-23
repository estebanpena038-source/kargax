# 03 - Regulatory Finance Shape

## Estado

- documento del sprint: `COMPLETADO`
- cierre de auditoria: `COMPLETADO`
- fecha de cierre documental: `2026-04-21`
- semaforo actual: `AMARILLO`
- estado real de implementacion: `COMPLETADO OPERATIVO CON EDGE LEGAL PENDIENTE`

## Proposito

Definir el perimetro legal, operativo y comercial de pagos, wallet, settlements y lending para que KargaX pueda crecer fuerte sin prometer algo prohibido ni construir una fintech rota desde su origen.

## Lo que ya hice en esta auditoria

- audite la capa financiera ya existente en codigo y migraciones
- confirme existencia de:
  - `wallets`
  - `transactions`
  - `payments`
  - `lending_settings`
  - `lending_treasury`
  - `fuel_advances`
  - `fuel_advance_repayments`
  - `holding_finance_policies`
- audite rutas:
  - `/api/wallet`
  - `/api/wallet/withdraw`
  - `/api/advances`
  - `/api/advances/eligibility`
  - `/api/admin/advances`
  - `/api/admin/treasury/adjust`
  - `/api/holding/finance-policy`
  - `/api/payments/create-preference`
  - `/api/payments/webhook`
- revise `runtime-env` y reglas de configuracion productiva
- revise `corporativo` y politicas de riesgo/limites
- contraste la estrategia con fuentes oficiales y de mercado actuales

## Implementacion ejecutada en codigo

- cree [`src/app/api/auth/session/route.ts`](</C:/kargax2/frontend/src/app/api/auth/session/route.ts>) para validar sesion con Supabase y emitir cookie `HttpOnly`
- cree [`src/lib/auth/session-bridge.ts`](</C:/kargax2/frontend/src/lib/auth/session-bridge.ts>) y [`src/lib/auth/session-constants.ts`](</C:/kargax2/frontend/src/lib/auth/session-constants.ts>) para sincronizar auth sensible fuera de `localStorage`
- cree [`src/lib/server/api-response.ts`](</C:/kargax2/frontend/src/lib/server/api-response.ts>) para arrancar el envelope canonico `{ success, data, error, code, meta }`
- converti [`src/proxy.ts`](</C:/kargax2/frontend/src/proxy.ts>) en guard server-side basado en cookie segura en vez de comentario pasivo
- actualice [`src/features/auth/store/authStore.ts`](</C:/kargax2/frontend/src/features/auth/store/authStore.ts>) y [`src/app/providers.tsx`](</C:/kargax2/frontend/src/app/providers.tsx>) para sincronizar la sesion y escuchar cambios auth
- quite copy ambigua de deposito/custodia de [`src/app/billetera/page.tsx`](</C:/kargax2/frontend/src/app/billetera/page.tsx>) y [`src/app/corporativo/page.tsx`](</C:/kargax2/frontend/src/app/corporativo/page.tsx>)
- restringi bypasses de webhook a preview/local controlado en [`src/lib/mercadopago/config.ts`](</C:/kargax2/frontend/src/lib/mercadopago/config.ts>)

## Cierre real del sprint

- KargaX ya se comporta como ledger operativo con sesion endurecida y copy regulatorio mas limpio
- el perimetro por defecto queda alineado a software + orquestacion + credito con recursos propios o partner capital
- la deuda restante no es de implementacion base sino de partner legal, rails y estructura para escalar lending/custodia

## Hallazgos de producto financiero actual

### Lo que KargaX ya tiene de verdad

- checkout de viajes
- checkout de planes
- webhook unico de pagos
- wallet con saldo disponible y pendiente
- historial de transacciones
- retiros
- sweeps para repayment
- elegibilidad de adelantos
- adelantos con aprobacion, rechazo, reestructuracion y write-off
- treasury para lending
- politicas financieras a nivel holding
- aprobaciones enterprise como `wallet_release`, `credit_policy` y `ops_exception`

### Lo que esto significa

KargaX ya no es solo software logistico. Ya es una base de:

- payments orchestration
- internal ledgering
- embedded lending
- enterprise financial governance

Eso es exactamente lo que puede sostener una historia de empresa enorme. Pero solo si el perimetro legal y el money flow quedan bien definidos.

## Decision base del sprint

KargaX no debe comportarse como captador no autorizado ni vender su wallet como cuenta de deposito. La ruta por defecto queda definida asi:

- software + orquestacion
- pagos sobre rails y proveedores permitidos
- credito con recursos propios o partner capital
- cero promesas de captacion de recursos del publico
- cero marketing ambiguo que sugiera banca plena sin licencia

## Fuentes auditadas

- SFC elHub: si el credito digital se otorga con recursos propios, no se requiere autorizacion de la SFC; pero si se manejan o invierten recursos captados del publico, se requiere autorizacion previa  
  Fuente: https://www.superfinanciera.gov.co/publicaciones/10103299/innovasfcelhub-10103299/
- SFC doctrina de captacion masiva y habitual  
  Fuente: https://www.superfinanciera.gov.co/publicaciones/18706/normativaconceptos-y-jurisprudencia-conceptoshistorico-doctrina-y-conceptos-anteriores-superintendencias-bancaria-y-de-valores-doctrina-y-conceptos-indice-generalcaptacion-masiva-y-habitual-18706/
- BanRep Bre-B: mas de `670M` transacciones y `COP 105T` en seis meses; el siguiente paso contempla pagos entre empresas, recaudos y dispersiones  
  Fuente: https://www.banrep.gov.co/es/noticias/seis-meses-bre-b-acumula-34-millones-usuarios
- DNP ENL 2024: costo logistico nacional `15,6%`; transporte `44,5%`, almacenamiento `22,4%`, inventarios `17,7%`  
  Fuente: https://www.dnp.gov.co/Prensa_/Noticias/Paginas/La-logistica-del-pais-avanza-impulsada-por-regiones-menores-costos-encuesta-nacional-logistica.aspx
- MinTransporte 2025: mas de `151M` toneladas, `13M` viajes y `2.620` empresas  
  Fuente: https://mintransporte.gov.co/publicaciones/12268/mintransporte-colombia-movilizo-mas-de-151-millones-de-toneladas-de-carga-en-2025-y-crecio-37/
- LAVCA / R2 / Ant: embedded SME lending en LatAm apoyado por data transaccional para cerrar un gap estimado de `$1.8T` sobre mas de `30M` pymes  
  Fuente: https://www.lavca.org/ant-international-makes-strategic-investment-in-r2-to-expand-access-to-credit-for-smes-across-latin-america/

## Interpretacion operativa de esas fuentes

### Lo que si puede hacer KargaX por defecto

- vender software logistico
- orquestar pagos usando proveedores/rails permitidos
- llevar ledger interno y estados operativos
- prestar con fondos propios o fondos estructurados correctamente
- usar datos de operacion para underwriting

### Lo que no debe hacer KargaX por defecto

- captar dinero del publico para usarlo libremente
- mercadear la wallet como cuenta bancaria o deposito vigilado
- mezclar revenue de plataforma con dinero de clientes
- prometer custodia regulada si no existe la estructura correcta

### Lo que requiere partner o counsel antes de escalar

- custodias robustas fuera del ledger interno
- pagos inmediatos B2B mas profundos sobre nuevos rails
- dispersiones masivas a gran escala
- capital de terceros estructurado para lending
- expansion multi-pais de operaciones financieras

## Money flow target

### Capas que deben separarse sin ambiguedad

1. `platform revenue`
2. `customer pending funds`
3. `customer available funds`
4. `withdrawal requested`
5. `reserved lending capital`
6. `deployed lending capital`
7. `repaid principal`
8. `repaid interest`
9. `manual adjustment`
10. `write-off`

## Matriz operativa permitida

| Operacion | Default | Condicion |
|---|---|---|
| cobrar viaje | permitida | via provider y con evidencia |
| cobrar plan | permitida | via provider y con evidence trail |
| mostrar wallet interna | permitida | como ledger operacional, no como deposito comercializado |
| retiro | permitida con cuidado | sujeto a origen de fondos, aprobacion y audit trail |
| adelanto con recursos propios | permitido por defecto | con politica, caps y no captacion |
| adelanto con capital de terceros | condicionado | requiere estructura legal, partner y counsel |
| custodiar fondos del publico como si fuera deposito | no permitido por defecto | requiere analisis y estructura vigilada |
| prometer "somos banco" o equivalente | no permitido | prohibido a nivel comercial y legal |

## Reglas comerciales obligatorias

- no usar lenguaje de banco si no existe licencia o partner adecuado
- no llamar "cuenta" a la wallet si el flujo real es ledger operativo
- no prometer disponibilidad inmediata universal si depende de provider y aprobacion
- no vender lending como "dinero instantaneo garantizado" sin score y politicas

## Checklist de implementacion futura

1. Dibujar money flow oficial del producto actual.
2. Mapear cada evento a ledger y a actor.
3. Definir TOS y disclaimers por feature:
   - pagos
   - wallet
   - retiros
   - adelantos
4. Definir KYB/KYC minimo por actor.
5. Definir politica de collections y write-off.
6. Definir en que momento entra partner financiero.
7. Definir perimetro Colombia primero y luego Andina.

## Definition of Done real

- no hay ambiguedad sobre que dinero es de quien
- ventas no promete capacidades bancarias inexistentes
- el equipo entiende que wallet != deposito vigilado
- lending puede crecer sin violar el perimetro base
- cada saldo y movimiento tiene una interpretacion contable y comercial clara

## Riesgos encontrados

- tratar el ledger como si fuera cuenta bancaria
- crecer lending sin partner/legal design
- mezclar settlement y revenue en reportes
- usar lenguaje comercial demasiado agresivo para una capa financiera aun en consolidacion
- documentar secretos o configuraciones sensibles en markdown

## Nota de cumplimiento

Este sprint no reemplaza opinion legal. La auditoria deja un perimetro operativo serio y razonable, pero antes de escalar wallet, dispersions o capital de terceros, KargaX debe trabajar con counsel regulatorio en Colombia.

## Veredicto

`Sprint 03` queda `CERRADO A NIVEL DE AUDITORIA Y ESPECIFICACION`. La conclusion honesta es favorable:

- KargaX si tiene una base real para fintech embebida
- esa base si puede sostener una tesis de empresa enorme
- pero solo si mantiene una linea dura entre orquestacion, ledger, settlement y captacion regulada
