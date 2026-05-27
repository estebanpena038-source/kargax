# Release Smoke Suite

Source of truth for launch smoke evidence before production.

## Command

```bash
cd frontend
npm run smoke:release -- --base-url https://app.kargax.com
```

Optional:

- `ADMIN_BEARER_TOKEN` to include `/api/admin/overview`
- `APP_BASE_URL` if you do not want to pass `--base-url`

## Journeys that must produce evidence

| Journey | Actor | Evidence |
|---|---|---|
| Auth + MFA | trucker, business owner, admin plataforma | screenshot or short clip, requestId, final session state |
| Offer -> pay -> webhook -> trip | business owner, trucker | request payload, webhook trace, payment status, trip state |
| Wallet -> withdrawal | trucker, finance admin, admin plataforma | marketplace transaction ledger, payout attempt, admin approval/rejection, final marketplace/private wallet separation |
| Private fleet external proof | business owner, finance_accountant, private_fleet_driver | payroll run, external proof, `paid_external`, wallet before/after unchanged for marketplace |
| Advance cycle | trucker, finance admin, ops admin | policy snapshot, exposure snapshot, disbursement, repayment evidence |
| Warehouse ops | owner, operator, auditor | appointment, receipt/dispatch, incident evidence, final status |
| Holding/admin reconcile | holding owner, finance admin, analyst, admin plataforma | approval queue, reconcile trace, requestId, admin screenshot |

## Minimum evidence package

- actor and timestamp
- requestId when API is involved
- expected payload or key response fields
- expected final state in admin or database
- screenshot or short video

## Launch rule

Do not mark launch as ready if any journey is still `defined only` and has no evidence attached in `SPTRINTS/90_QA_MATRIX.md`.
