# Disaster Recovery

Use `docs/ops/release-rollback.md` for release rollback. This document is only for platform recovery after a real outage or data/storage failure.

Recovery checklist:

1. Confirm the incident scope: database, storage, provider outage, or app-only outage.
2. Freeze risky actions with feature flags such as `degraded_mode_wallet` or `degraded_mode_warehouse`.
3. Restore the latest verified database backup.
4. Restore required storage buckets and verify evidence assets.
5. Re-run `/api/health` and confirm `healthy` or acceptable `degraded` status.
6. Replay idempotent incidents only after storage and database are stable.
7. Capture the full restore drill evidence in `SPTRINTS/90_QA_MATRIX.md`.

Cadence:

- Weekly: backup verification.
- Monthly: restore drill.
- Before launch: full restore rehearsal against non-production data.
