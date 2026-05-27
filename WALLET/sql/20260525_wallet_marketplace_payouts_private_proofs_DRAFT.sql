-- DRAFT ONLY. Review against current schema before running.
-- Create a NEW migration in supabase/migrations. Do not edit old migrations.

alter table public.transactions
  add column if not exists money_rail text,
  add column if not exists source_system text,
  add column if not exists payout_eligible boolean not null default false,
  add column if not exists payout_attempt_id uuid,
  add column if not exists locked_for_payout boolean not null default false,
  add column if not exists external_proof_only boolean not null default false;

alter table public.private_fleet_payroll_runs
  add column if not exists payment_mode text not null default 'external_proof',
  add column if not exists external_payment_status text not null default 'pending_external_pay',
  add column if not exists external_paid_at timestamptz,
  add column if not exists external_paid_by uuid,
  add column if not exists external_payment_method text,
  add column if not exists external_payment_reference text,
  add column if not exists external_payment_proof_url text,
  add column if not exists external_payment_proof_storage_path text,
  add column if not exists external_payment_note text;

alter table public.payout_attempts
  add column if not exists source_kind text,
  add column if not exists source_id uuid,
  add column if not exists offer_id uuid,
  add column if not exists payment_id uuid,
  add column if not exists trucker_id uuid,
  add column if not exists provider_transfer_id text,
  add column if not exists receipt_url text,
  add column if not exists destination_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists provider_response jsonb,
  add column if not exists failure_reason text,
  add column if not exists attempts_count integer not null default 0,
  add column if not exists next_retry_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_payout_attempts_idempotency_key
  on public.payout_attempts (idempotency_key);

create index if not exists idx_payout_attempts_queue
  on public.payout_attempts (status, next_retry_at, created_at)
  where status in ('queued', 'failed');
