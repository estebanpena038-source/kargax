# Withdrawal Stuck

Owner: Fintech ops
SLA: 30 minutes

1. Find the withdrawal in `/admin`, `transactions`, and `support_requests` using `requestId` or withdrawal id.
2. Validate transaction status, wallet balance snapshots, and whether a reversal already exists.
3. Confirm AAL2 admin processing and that `process_withdrawal_request` returned success.
4. If the request is safe to retry, use the incident replay path or re-process explicitly from admin.
5. Verify the wallet ledger stays atomic: no balance mutation without a matching ledger row.
6. Close only after admin notification, transaction status, and wallet snapshots match.
