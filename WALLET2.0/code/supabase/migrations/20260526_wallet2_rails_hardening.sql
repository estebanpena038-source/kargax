-- WALLET2.0 — hardening rails marketplace vs private fleet
-- Crear como nueva migración: supabase/migrations/20260526_wallet2_rails_hardening.sql
-- No editar migraciones antiguas.
-- Revisar contra schema actual antes de aplicar en producción.

begin;

-- =========================================================
-- 1) Transactions: rail, elegibilidad y bloqueo payout
-- =========================================================

alter table public.transactions
  add column if not exists money_rail text,
  add column if not exists source_system text,
  add column if not exists payout_eligible boolean not null default false,
  add column if not exists payout_attempt_id uuid,
  add column if not exists locked_for_payout boolean not null default false,
  add column if not exists external_proof_only boolean not null default false;

create index if not exists idx_transactions_wallet_rail_status_created
  on public.transactions (wallet_id, money_rail, status, created_at desc);

create index if not exists idx_transactions_payout_eligible
  on public.transactions (wallet_id, payout_eligible, locked_for_payout, created_at desc)
  where payout_eligible = true;

create index if not exists idx_transactions_offer_rail
  on public.transactions (offer_id, money_rail, type)
  where offer_id is not null;

create index if not exists idx_transactions_payout_attempt_id
  on public.transactions (payout_attempt_id)
  where payout_attempt_id is not null;

-- Evita doble liberación marketplace por misma oferta.
create unique index if not exists idx_transactions_one_marketplace_release_per_offer
  on public.transactions (offer_id)
  where money_rail = 'marketplace_freelancer'
    and type in ('marketplace_freight_release', 'trip_deposit', 'trip_settlement')
    and status in ('completed', 'paid', 'settled');

-- =========================================================
-- 2) Payout attempts: provider lifecycle + idempotencia
-- =========================================================

alter table public.payout_attempts
  add column if not exists source_kind text,
  add column if not exists source_id uuid,
  add column if not exists offer_id uuid,
  add column if not exists payment_id uuid,
  add column if not exists trucker_id uuid,
  add column if not exists wallet_transaction_id uuid,
  add column if not exists user_id uuid,
  add column if not exists provider text,
  add column if not exists method text,
  add column if not exists amount_cop numeric,
  add column if not exists status text not null default 'queued',
  add column if not exists idempotency_key text,
  add column if not exists provider_transfer_id text,
  add column if not exists receipt_url text,
  add column if not exists destination_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists provider_payload jsonb not null default '{}'::jsonb,
  add column if not exists provider_response jsonb,
  add column if not exists failure_reason text,
  add column if not exists attempts_count integer not null default 0,
  add column if not exists next_retry_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists manual_review_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_payout_attempts_idempotency_key
  on public.payout_attempts (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_payout_attempts_provider_transfer_id
  on public.payout_attempts (provider, provider_transfer_id)
  where provider_transfer_id is not null;

create index if not exists idx_payout_attempts_queue
  on public.payout_attempts (status, next_retry_at, created_at)
  where status in ('queued', 'failed');

create index if not exists idx_payout_attempts_trucker_created
  on public.payout_attempts (trucker_id, created_at desc)
  where trucker_id is not null;

create index if not exists idx_payout_attempts_user_created
  on public.payout_attempts (user_id, created_at desc)
  where user_id is not null;

create index if not exists idx_payout_attempts_offer
  on public.payout_attempts (offer_id, status)
  where offer_id is not null;

-- =========================================================
-- 3) Private fleet payroll: external proof mode default
-- =========================================================

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

create index if not exists idx_private_fleet_payroll_runs_external_status
  on public.private_fleet_payroll_runs (business_id, external_payment_status, created_at desc);

create index if not exists idx_private_fleet_payroll_runs_payment_mode
  on public.private_fleet_payroll_runs (payment_mode, status, created_at desc);

-- =========================================================
-- 4) Private fleet proofs: comprobantes externos
-- =========================================================

create table if not exists public.private_fleet_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  run_id uuid not null references public.private_fleet_payroll_runs(id) on delete cascade,
  uploaded_by uuid not null,
  payment_method text not null,
  external_reference text,
  amount_cop numeric not null check (amount_cop > 0),
  proof_url text,
  storage_path text,
  note text,
  status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_private_fleet_payment_proofs_run
  on public.private_fleet_payment_proofs (run_id, created_at desc);

create index if not exists idx_private_fleet_payment_proofs_business
  on public.private_fleet_payment_proofs (business_id, status, created_at desc);

-- =========================================================
-- 5) Conservative backfill: no cambia balances
-- =========================================================

update public.transactions
set money_rail = case
  when type in ('marketplace_freight_release', 'trip_deposit', 'trip_settlement', 'trip_pending') then 'marketplace_freelancer'
  when type = 'private_fleet_salary' then 'private_fleet_external_or_legacy'
  when type in ('withdrawal', 'withdrawal_reversal') then 'wallet_withdrawal'
  else coalesce(money_rail, 'legacy')
end,
source_system = coalesce(source_system, 'wallet2_backfill'),
payout_eligible = case
  when type in ('marketplace_freight_release', 'trip_deposit', 'trip_settlement')
    and status in ('completed', 'paid', 'settled')
    and coalesce(external_proof_only, false) = false
  then true
  else false
end,
external_proof_only = case
  when type = 'private_fleet_salary' then true
  else coalesce(external_proof_only, false)
end
where money_rail is null;

-- =========================================================
-- 6) RPC: claim payout attempts atomically
-- =========================================================

create or replace function public.claim_payout_attempts(p_limit integer default 10)
returns setof public.payout_attempts
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select p.id
    from public.payout_attempts p
    where (
      p.status = 'queued'
      or (
        p.status = 'failed'
        and coalesce(p.attempts_count, 0) < 5
        and (p.next_retry_at is null or p.next_retry_at <= now())
      )
    )
    order by p.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.payout_attempts p
  set status = 'processing',
      processing_started_at = now(),
      attempts_count = coalesce(p.attempts_count, 0) + 1,
      updated_at = now()
  from candidates c
  where p.id = c.id
  returning p.*;
end;
$$;

-- =========================================================
-- 7) RPC: mark payout paid
-- =========================================================

create or replace function public.mark_payout_paid(
  p_payout_attempt_id uuid,
  p_provider_transfer_id text default null,
  p_receipt_url text default null,
  p_provider_response jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.payout_attempts%rowtype;
begin
  select * into v_attempt
  from public.payout_attempts
  where id = p_payout_attempt_id
  for update;

  if not found then
    return false;
  end if;

  if v_attempt.status = 'paid' then
    return true;
  end if;

  if v_attempt.status not in ('queued', 'processing', 'failed', 'manual_review') then
    return false;
  end if;

  update public.payout_attempts
  set status = 'paid',
      provider_transfer_id = coalesce(p_provider_transfer_id, provider_transfer_id),
      receipt_url = coalesce(p_receipt_url, receipt_url),
      provider_response = coalesce(p_provider_response, provider_response),
      paid_at = now(),
      failed_at = null,
      failure_reason = null,
      updated_at = now()
  where id = p_payout_attempt_id;

  update public.transactions
  set status = case when status = 'pending' then 'approved' else status end,
      payout_attempt_id = p_payout_attempt_id,
      locked_for_payout = false,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'payout_status', 'paid',
        'provider_transfer_id', p_provider_transfer_id,
        'receipt_url', p_receipt_url,
        'payout_paid_at', now()
      )
  where id = v_attempt.wallet_transaction_id;

  return true;
end;
$$;

-- =========================================================
-- 8) RPC: mark payout failed
-- =========================================================

create or replace function public.mark_payout_failed(
  p_payout_attempt_id uuid,
  p_failure_reason text,
  p_provider_response jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.payout_attempts%rowtype;
  v_next_status text;
  v_next_retry timestamptz;
begin
  select * into v_attempt
  from public.payout_attempts
  where id = p_payout_attempt_id
  for update;

  if not found then
    return false;
  end if;

  if v_attempt.status = 'paid' then
    return false;
  end if;

  if coalesce(v_attempt.attempts_count, 0) >= 5 then
    v_next_status := 'manual_review';
    v_next_retry := null;
  else
    v_next_status := 'failed';
    v_next_retry := now() + case
      when coalesce(v_attempt.attempts_count, 0) <= 1 then interval '15 minutes'
      when coalesce(v_attempt.attempts_count, 0) = 2 then interval '1 hour'
      when coalesce(v_attempt.attempts_count, 0) = 3 then interval '3 hours'
      else interval '12 hours'
    end;
  end if;

  update public.payout_attempts
  set status = v_next_status,
      failure_reason = p_failure_reason,
      provider_response = coalesce(p_provider_response, provider_response),
      failed_at = now(),
      manual_review_at = case when v_next_status = 'manual_review' then now() else manual_review_at end,
      next_retry_at = v_next_retry,
      updated_at = now()
  where id = p_payout_attempt_id;

  update public.transactions
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'payout_status', v_next_status,
    'payout_failure_reason', p_failure_reason,
    'payout_failed_at', now()
  )
  where id = v_attempt.wallet_transaction_id;

  return true;
end;
$$;

-- =========================================================
-- 9) RPC: manual review
-- =========================================================

create or replace function public.mark_payout_manual_review(
  p_payout_attempt_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payout_attempts
  set status = 'manual_review',
      failure_reason = coalesce(p_reason, failure_reason),
      manual_review_at = now(),
      next_retry_at = null,
      updated_at = now()
  where id = p_payout_attempt_id
    and status <> 'paid';

  return found;
end;
$$;

-- =========================================================
-- 10) RLS base para tabla nueva
-- Ajustar helpers reales si ya existen roles multiempresa.
-- =========================================================

alter table public.private_fleet_payment_proofs enable row level security;

-- Policies se dejan como bloque seguro y tolerante.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_fleet_payment_proofs'
      and policyname = 'private_fleet_payment_proofs_service_role_all'
  ) then
    create policy private_fleet_payment_proofs_service_role_all
      on public.private_fleet_payment_proofs
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

commit;
