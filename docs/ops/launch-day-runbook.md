# Launch Day Runbook

## Control room

- Launch commander: CEO / Founder
- Technical owner: CTO / Founding Engineer
- Ops owner: Head of Ops
- Finance owner: Finance Lead
- Support primary: Support Lead

## T minus 60 minutes

1. Confirm `npm run check`, `npm run lint`, `npm run check:release`, and `npm run smoke:release`.
2. Confirm feature flags for `CO` are correct and `PE/EC` remain closed unless explicitly approved.
3. Confirm `/api/health` returns `healthy` or approved `degraded`.
4. Confirm webhook signature, admin overview, runbooks, and support roster are available.
5. Freeze non-essential merges.

## Go / no-go gate

Launch only if all are true:

- money remains traceable end-to-end
- requestIds are visible in admin and support
- smoke evidence exists for critical journeys
- on-call rotation is staffed
- rollback owner is confirmed

## First 60 minutes

1. Watch `/api/health`, `/api/admin/overview`, payments, wallet, and support queue.
2. Review webhook processing and pending incidents every 10 minutes.
3. Review withdrawals, trip deposits, and advance disbursements.
4. Capture the first customer feedback and the first operational incident.

## Escalation rule

- Critical payment or wallet issue: pause risky actions with feature flags and move to rollback decision in `docs/ops/release-rollback.md`.
- Support backlog spike or approval breach: activate support and holding runbooks immediately.
