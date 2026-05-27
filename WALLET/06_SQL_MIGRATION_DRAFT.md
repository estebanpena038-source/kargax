# 06 — SQL migration draft

Crear nueva migración en:

```text
supabase/migrations/<timestamp>_wallet_marketplace_payouts_private_proofs.sql
```

No editar migraciones antiguas.

## 1. Extender `transactions`

```sql
alter table public.transactions
  add column if not exists money_rail text,
  add column if not exists source_system text,
  add column if not exists payout_eligible boolean not null default false,
  add column if not exists payout_attempt_id uuid,
  add column if not exists locked_for_payout boolean not null default false,
  add column if not exists external_proof_only boolean not null default false;

create index if not exists idx_transactions_money_rail
  on public.transactions (money_rail, type, status, created_at desc);

create index if not exists idx_transactions_payout_attempt_id
  on public.transactions (payout_attempt_id)
  where payout_attempt_id is not null;
```

## 2. Extender `payout_attempts`

Ajustar según columnas existentes. Si una columna ya existe, `if not exists`.

```sql
alter table public.payout_attempts
  add column if not exists source_kind text,
  add column if not exists source_id uuid,
  add column if not exists offer_id uuid,
  add column if not exists payment_id uuid,
  add column if not exists trucker_id uuid,
  add column if not exists status text not null default 'queued',
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
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_payout_attempts_idempotency_key
  on public.payout_attempts (idempotency_key);

create index if not exists idx_payout_attempts_queue
  on public.payout_attempts (status, next_retry_at, created_at)
  where status in ('queued', 'failed');

create index if not exists idx_payout_attempts_trucker
  on public.payout_attempts (trucker_id, created_at desc);
```

## 3. Extender nómina privada

```sql
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
```

## 4. Tabla opcional de comprobantes privados

Si se quiere soportar varios comprobantes por liquidación:

```sql
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
  reviewed_by uuid
);

create index if not exists idx_private_fleet_payment_proofs_run
  on public.private_fleet_payment_proofs(run_id, created_at desc);
```

## 5. RPC claim payouts

Usar función para que el worker no procese dos veces el mismo payout.

```sql
create or replace function public.claim_payout_attempts(p_limit integer default 10)
returns setof public.payout_attempts
language plpgsql
security definer
as $$
begin
  return query
  with picked as (
    select id
    from public.payout_attempts
    where status in ('queued', 'failed')
      and (next_retry_at is null or next_retry_at <= now())
      and attempts_count < 5
    order by created_at asc
    limit p_limit
    for update skip locked
  )
  update public.payout_attempts pa
  set status = 'processing',
      processing_started_at = now(),
      attempts_count = attempts_count + 1,
      updated_at = now()
  from picked
  where pa.id = picked.id
  returning pa.*;
end;
$$;
```

## 6. RPC marcar payout pagado

```sql
create or replace function public.mark_payout_paid(
  p_payout_attempt_id uuid,
  p_provider_transfer_id text,
  p_receipt_url text,
  p_provider_response jsonb
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_attempt public.payout_attempts%rowtype;
begin
  select * into v_attempt
  from public.payout_attempts
  where id = p_payout_attempt_id
  for update;

  if not found then
    raise exception 'payout_attempt_not_found';
  end if;

  if v_attempt.status = 'paid' then
    return true;
  end if;

  update public.payout_attempts
  set status = 'paid',
      provider_transfer_id = p_provider_transfer_id,
      receipt_url = p_receipt_url,
      provider_response = p_provider_response,
      paid_at = now(),
      updated_at = now()
  where id = p_payout_attempt_id;

  update public.transactions
  set status = 'paid',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'payout_attempt_id', p_payout_attempt_id,
        'provider_transfer_id', p_provider_transfer_id,
        'receipt_url', p_receipt_url,
        'payout_status', 'paid'
      )
  where id = v_attempt.wallet_transaction_id;

  return true;
end;
$$;
```

## 7. RPC marcar payout fallido

```sql
create or replace function public.mark_payout_failed(
  p_payout_attempt_id uuid,
  p_failure_reason text,
  p_provider_response jsonb
)
returns boolean
language plpgsql
security definer
as $$
begin
  update public.payout_attempts
  set status = 'failed',
      failure_reason = p_failure_reason,
      provider_response = p_provider_response,
      failed_at = now(),
      next_retry_at = case
        when attempts_count < 5 then now() + interval '15 minutes'
        else null
      end,
      updated_at = now()
  where id = p_payout_attempt_id
    and status in ('processing', 'queued', 'failed');

  return true;
end;
$$;
```

## 8. RLS / permisos

Ajustar según tus helpers existentes, pero regla base:

- Trucker puede leer sus payout_attempts.
- Trucker no puede editar payout_attempts.
- Empresa puede leer liquidaciones de su business_id.
- Admin KargaX puede procesar.
- Service role puede ejecutar RPCs.

## 9. Backfill recomendado

```sql
update public.transactions
set money_rail = case
  when type in ('trip_deposit', 'trip_pending') then 'marketplace_freelancer'
  when type = 'private_fleet_salary' then 'private_fleet_external_or_legacy'
  when type = 'withdrawal' then 'wallet_withdrawal'
  else coalesce(money_rail, 'legacy')
end
where money_rail is null;
```

No cambiar balances históricos automáticamente sin auditoría.
