# Settlement Mismatch

Owner: Fintech ops
SLA: 30 minutes

1. Compare `payments`, `cargo_offers`, `transactions`, `wallets`, and `operation_events` using `requestId`.
2. Confirm the delivery PIN flow completed and inspect `trip_pending` and `trip_deposit`.
3. If the payment is completed but side effects are missing, run `rerun_settlement_side_effects`.
4. Validate pending and available snapshots before/after the replay.
5. If an advance exists, verify repayment waterfall `interest -> principal` still reconciles.
6. Document the root cause and keep the incident open if warehouse or payout side effects remain inconsistent.
