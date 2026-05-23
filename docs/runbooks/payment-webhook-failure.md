# Payment Webhook Failure

Owner: Payments on-call
SLA: 5 minutes

1. Confirm the affected `requestId`, `paymentId`, `offerId`, and gateway payload in `/admin` and `operation_events`.
2. Validate Mercado Pago webhook authenticity and `MERCADOPAGO_WEBHOOK_SECRET`.
3. Check if `process_successful_payment` already ran idempotently.
4. If payment is completed upstream but not settled in KargaX, use replay action `reconcile_payment`.
5. Confirm `cargo_offers.status`, wallet `trip_pending`/`trip_deposit`, warehouse sync, and admin notification trail.
6. If the replay also fails, keep the incident `investigating`, escalate to platform on-call, and document the failure class.
