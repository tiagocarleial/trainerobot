-- Execute no SQL Editor do Supabase antes de usar o painel.
create extension if not exists pgcrypto;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  view_token text not null unique,
  client_token text,
  client_name text not null,
  telegram_handle text not null default '',
  wallet_address text not null default '',
  sender_address text not null default '',
  usdc_amount numeric(18,6) not null check (usdc_amount > 0),
  rate_brl numeric(18,6) check (rate_brl > 0),
  exchange_at timestamptz,
  fee_percent numeric(5,2) not null default 20,
  pix_amount numeric(18,2) check (pix_amount >= 0),
  pix_manual boolean not null default false,
  provisional boolean not null default false,
  pix_key text not null default '',
  crypto_tx_hash text not null default '',
  crypto_proof text,
  pix_proof text,
  status text not null default 'aguardando' check (status in ('aguardando', 'recebido', 'pix_enviado')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  received_at timestamptz,
  paid_at timestamptz
);

alter table public.payments enable row level security;
alter table public.payments add column if not exists client_token text;
alter table public.payments add column if not exists telegram_handle text not null default '';
alter table public.payments add column if not exists sender_address text not null default '';
alter table public.payments add column if not exists pix_manual boolean not null default false;
alter table public.payments add column if not exists provisional boolean not null default false;
alter table public.payments alter column rate_brl drop not null;
alter table public.payments alter column exchange_at drop not null;
alter table public.payments alter column pix_amount drop not null;
update public.payments set client_token = view_token where client_token is null;
alter table public.payments alter column client_token set not null;
create index if not exists payments_client_token_idx on public.payments (client_token, created_at desc);
revoke all on public.payments from anon, authenticated;
grant all on public.payments to service_role;

-- Depósitos USDC nativos recebidos na carteira Base configurada no servidor.
create table if not exists public.base_deposits (
  id uuid primary key default gen_random_uuid(),
  tx_hash text not null,
  log_index integer not null,
  from_address text not null,
  to_address text not null,
  usdc_amount numeric(18,6) not null check (usdc_amount > 0),
  block_number bigint not null,
  block_time timestamptz not null default now(),
  payment_id uuid references public.payments(id) on delete set null,
  detected_at timestamptz not null default now(),
  unique (tx_hash, log_index)
);
alter table public.base_deposits add column if not exists block_time timestamptz not null default now();
create unique index if not exists base_deposits_payment_id_idx on public.base_deposits(payment_id) where payment_id is not null;
create index if not exists base_deposits_detected_at_idx on public.base_deposits(detected_at desc);
alter table public.base_deposits enable row level security;
revoke all on public.base_deposits from anon, authenticated;
grant all on public.base_deposits to service_role;

create or replace function public.record_base_usdc_deposit(deposit jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare
  inserted_id uuid;
  candidate_id uuid;
  candidate_count integer;
begin
  insert into public.base_deposits(tx_hash, log_index, from_address, to_address, usdc_amount, block_number, block_time)
  values (
    lower(deposit->>'tx_hash'), (deposit->>'log_index')::integer,
    lower(deposit->>'from_address'), lower(deposit->>'to_address'),
    (deposit->>'usdc_amount')::numeric, (deposit->>'block_number')::bigint, (deposit->>'block_time')::timestamptz
  ) on conflict (tx_hash, log_index) do nothing returning id into inserted_id;
  if inserted_id is null then return; end if;

  select count(*), min(id::text)::uuid into candidate_count, candidate_id
  from public.payments
  where status = 'aguardando'
    and lower(sender_address) = lower(deposit->>'from_address')
    and sender_address <> ''
    and usdc_amount = (deposit->>'usdc_amount')::numeric
    and lower(wallet_address) = lower(deposit->>'to_address');

  if candidate_count = 1 then
    update public.payments set status = 'recebido', received_at = (deposit->>'block_time')::timestamptz,
      crypto_tx_hash = lower(deposit->>'tx_hash'),
      notes = case when (deposit->>'usdc_amount')::numeric < 5
        then case when position('Abaixo do mínimo de 5 USDC.' in notes) > 0 then notes
          else concat_ws(E'\n', nullif(notes, ''), 'Abaixo do mínimo de 5 USDC. Não enviar o PIX até atingir o mínimo.') end
        else notes end
    where id = candidate_id and status = 'aguardando';
    if found then
      update public.base_deposits set payment_id = candidate_id where id = inserted_id;
      return;
    end if;
  end if;

  -- Sem cliente identificado, o depósito vira uma transação privada provisória.
  insert into public.payments (
    view_token, client_token, client_name, wallet_address, sender_address,
    usdc_amount, rate_brl, exchange_at, pix_amount, pix_manual, provisional,
    crypto_tx_hash, status, notes, received_at, created_at
  ) values (
    rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '='),
    rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '='),
    'A identificar', lower(deposit->>'to_address'), lower(deposit->>'from_address'),
    (deposit->>'usdc_amount')::numeric, null, null, null, false, true,
    lower(deposit->>'tx_hash'), 'recebido',
    case when (deposit->>'usdc_amount')::numeric < 5
      then 'Abaixo do mínimo de 5 USDC. Não enviar o PIX até atingir o mínimo.' else '' end,
    (deposit->>'block_time')::timestamptz,
    (deposit->>'block_time')::timestamptz
  ) returning id into candidate_id;
  update public.base_deposits set payment_id = candidate_id where id = inserted_id;
end;
$$;
revoke all on function public.record_base_usdc_deposit(jsonb) from public, anon, authenticated;
grant execute on function public.record_base_usdc_deposit(jsonb) to service_role;

create or replace function public.assign_base_usdc_deposit(deposit_id uuid, target_payment_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  incoming public.base_deposits%rowtype;
  payment public.payments%rowtype;
begin
  select * into incoming from public.base_deposits where id = deposit_id for update;
  if not found or incoming.payment_id is not null then raise exception 'Depósito indisponível.'; end if;
  select * into payment from public.payments where id = target_payment_id for update;
  if not found or payment.status <> 'aguardando' or
     payment.usdc_amount <> incoming.usdc_amount or
     lower(payment.wallet_address) <> incoming.to_address then
    raise exception 'Transação incompatível com o depósito.';
  end if;
  update public.payments set status = 'recebido', received_at = incoming.block_time,
    crypto_tx_hash = incoming.tx_hash where id = target_payment_id;
  update public.base_deposits set payment_id = target_payment_id where id = deposit_id;
end;
$$;
revoke all on function public.assign_base_usdc_deposit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assign_base_usdc_deposit(uuid, uuid) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 2000000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2000000,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
