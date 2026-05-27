# Staging Browser Pass

Browser-only execution pack for the operator who will validate staging manually.

## Base URL

- `https://kargax-staging.vercel.app`

## Before you start

- open DevTools
- keep the Network tab visible
- save one screenshot per journey
- when an API call returns JSON, capture `meta.requestId` or `data.requestId`
- write final evidence back into `SPTRINTS/90_QA_MATRIX.md`

## Execution order

1. Auth + MFA
2. Offer -> pay -> webhook -> trip
3. Wallet -> withdrawal
4. Private fleet external proof
5. Advance cycle
6. Warehouse ops
7. Holding/admin reconcile

## 1. Auth + MFA

Routes:

- `/registro`
- `/login`
- `/auth/mfa/setup`
- `/auth/mfa/verify`

Capture:

- signup screenshot
- login success screenshot
- MFA setup screenshot
- MFA verify screenshot
- final protected route working with elevated session

Pass criteria:

- user can sign up or log in without unexpected error
- MFA setup and verification complete
- protected route accepts the session after AAL2

## 2. Offer -> pay -> webhook -> trip

Routes:

- `/ofertas/publicar`
- `/ofertas-aceptadas`
- `/pagar/[offerId]`
- `/viaje/[offerId]`
- `/viaje/[offerId]/carga`
- `/viaje/[offerId]/entrega`

Capture:

- created offer screenshot
- accepted offer screenshot
- payment attempt screenshot
- payment or webhook response with `requestId` if visible
- trip hub screenshot
- carga and entrega final status screenshots

Pass criteria:

- offer is created and accepted
- payment moves to expected status
- webhook side effects are visible
- trip becomes traceable through carga and entrega

## 3. Wallet -> withdrawal

Routes:

- `/billetera`
- `/admin`

Capture:

- marketplace wallet before withdrawal
- withdrawal request evidence
- payout attempt evidence
- admin approval, rejection, retry or manual review evidence
- marketplace wallet after final decision
- proof that private fleet ledger is not withdrawable

Pass criteria:

- withdrawal uses only `Marketplace retirable`
- payout attempt is visible with provider `manual` or `cobre`
- approval or rejection changes the ledger correctly
- reversal is visible if rejected
- private fleet liquidations do not increase marketplace withdrawable balance

## 4. Private fleet external proof

Routes:

- `/dashboard/flota`
- `/billetera`
- `/dashboard/inteligencia`

Capture:

- payroll run before approval
- proof upload or external reference
- `paid_external` status
- driver `/billetera` showing `Flota privada`
- wallet before/after for `Marketplace retirable`

Pass criteria:

- payroll uses `payment_mode = external_proof`
- proof moves run/item to `proof_uploaded`
- paid external moves run/item to `paid_external`
- no private salary/freight appears as marketplace withdrawable balance
- no `payout_attempt` is created for private fleet payroll or private route freight

## 5. Advance cycle

Routes:

- `/billetera`
- `/admin`

Capture:

- eligible offer or advance request
- policy snapshot
- exposure snapshot
- approval or rejection
- repayment evidence

Pass criteria:

- request is evaluated by policy
- approval writes the expected snapshots
- repayment waterfall is visible

## 6. Warehouse ops

Routes:

- `/bodegas`
- `/bodegas/[id]/citas`
- `/bodegas/[id]/recepciones`
- `/bodegas/[id]/despachos`
- `/bodegas/[id]/incidentes`

Capture:

- warehouse created or selected
- appointment evidence
- receipt or dispatch evidence
- incident evidence
- final lifecycle status

Pass criteria:

- appointment lifecycle advances correctly
- receipt or dispatch completes without hidden step
- incident can be opened and closed with traceability

## 7. Holding/admin reconcile

Routes:

- `/corporativo`
- `/admin`

Capture:

- approval queue screenshot
- requestId from approval or admin action
- reconcile evidence
- final state in corporate/admin console

Pass criteria:

- approval queue is usable
- reconcile action is traceable
- final state is visible in corporate/admin surfaces

## If something fails

- capture the failing screen
- capture the exact route
- capture the requestId if the API responded
- mark the row in `SPTRINTS/90_QA_MATRIX.md` as `blocked` or `failed`
- do not mark staging as ready while `/api/health` is still `503`
