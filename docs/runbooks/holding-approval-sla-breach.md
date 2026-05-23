# Holding Approval SLA Breach

Owner: Holding owner
SLA: 30 minutes

1. Review breached approvals in `/corporativo` and `/admin`, including `assigned_team`, `sla_due_at`, and `escalation_level`.
2. Confirm routing logic by request type: finance, ops, or owner.
3. Reassign if the original queue has no active member.
4. If the request blocks treasury, wallet release, or plan upgrade, escalate to `holding_owner` immediately.
5. If the SLA doubled, notify platform admin and record the escalation in the incident metadata.
6. Close only after decision, audit trail, and follow-up notification are visible.
