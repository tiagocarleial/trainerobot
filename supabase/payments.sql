-- Execute no SQL Editor do Supabase antes de usar o painel.
create extension if not exists pgcrypto;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  view_token text not null unique,
  client_token text,
  client_name text not null,
  telegram_handle text not null default '',
  wallet_address text not null default '',
  usdc_amount numeric(18,6) not null check (usdc_amount > 0),
  rate_brl numeric(18,6) not null check (rate_brl > 0),
  exchange_at timestamptz not null,
  fee_percent numeric(5,2) not null default 20,
  pix_amount numeric(18,2) not null check (pix_amount >= 0),
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
update public.payments set client_token = view_token where client_token is null;
alter table public.payments alter column client_token set not null;
create index if not exists payments_client_token_idx on public.payments (client_token, created_at desc);
revoke all on public.payments from anon, authenticated;
grant all on public.payments to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 2000000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2000000,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
