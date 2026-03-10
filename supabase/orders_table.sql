-- Phantom Project: tabla orders para persistencia real de pedidos.
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor).

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  product_name text not null,
  product_price numeric not null default 0,
  quantity integer not null default 1,
  total numeric not null default 0,
  payment_method text,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded', 'cancelled')),
  customer_email text not null,
  customer_discord text,
  customer_discord_id text,
  product_image text,
  product_type text,
  selected_money text,
  selected_level text,
  selected_vehicles text,
  paypal_order_id text,
  crypto_invoice_id text,
  discord_notified boolean not null default false,
  discord_ticket_created boolean not null default false,
  discord_ticket_channel_id text,
  email_sent boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_orders_order_id on public.orders (order_id);
create index if not exists idx_orders_payment_status on public.orders (payment_status);
create index if not exists idx_orders_created_at on public.orders (created_at desc);

-- RLS: solo el backend (service_role) debe acceder. En Supabase, las APIs con service_role_key ignoran RLS.
alter table public.orders enable row level security;

create policy "Service role only"
  on public.orders
  for all
  using (false)
  with check (false);

comment on table public.orders is 'Pedidos Phantom Project; acceso solo desde backend con service_role.';
