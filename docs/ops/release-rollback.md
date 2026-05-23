# Release Rollback Runbook

Use this for release rollback. Disaster recovery is a separate path and lives in `docs/ops/disaster-recovery.md`.

## Trigger rollback if

- production money flow becomes non-traceable
- auth or MFA blocks valid operators
- admin overview or health surfaces are unavailable
- a launch feature promises behavior that does not actually execute

## Owner chain

- Decision owner: CTO / Founding Engineer
- Business approver: CEO / Founder
- Finance approver for money-impacting rollback: Finance Lead

## Rollback path

1. Freeze high-risk actions with feature flags:
   - `degraded_mode_wallet`
   - `degraded_mode_warehouse`
   - `replay_actions`
   - `market_open`
2. Revert the last release deployment to the previous known good build.
3. Re-run `/api/health`.
4. Validate `payments`, `wallet`, `admin/overview`, and `support_requests`.
5. Open a platform incident with the rollback requestId and note the release version.

## After rollback

- keep the market closed until smoke evidence is rerun
- write a postmortem with requestIds, timeline, impact, and next hardening actions
