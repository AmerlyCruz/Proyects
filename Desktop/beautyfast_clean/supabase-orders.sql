-- Extensión necesaria
create extension if not exists "pgcrypto";

-- ENUMs para mayor integridad
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending_review', 'processing', 'shipped', 'delivered', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
    CREATE TYPE payment_status_enum AS ENUM ('pending', 'paid', 'failed', 'refunded');
  END IF;
END$$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_number text not null unique,
  email text not null,
  customer_name text not null,
  phone text not null,
  delivery_method text not null,
  shipping_cost numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null,
  payment_method text not null,
  payment_status payment_status_enum not null default 'pending',
  status order_status not null default 'pending_review',
  items jsonb not null default '[]'::jsonb,
  delivery_address jsonb,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.orders enable row level security;

-- Políticas de seguridad completas
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders' and policyname = 'Users can read their own orders'
  ) then
    execute 'create policy "Users can read their own orders" on public.orders for select to authenticated using (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders' and policyname = 'Users can insert their own orders'
  ) then
    execute 'create policy "Users can insert their own orders" on public.orders for insert to authenticated with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders' and policyname = 'Users can update their own orders'
  ) then
    execute 'create policy "Users can update their own orders" on public.orders for update to authenticated using (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders' and policyname = 'Users can delete their own orders'
  ) then
    execute 'create policy "Users can delete their own orders" on public.orders for delete to authenticated using (auth.uid() = user_id)';
  end if;
end
$$;

-- Índices útiles
create index if not exists orders_user_id_created_at_idx
on public.orders (user_id, created_at desc);

create index if not exists orders_status_idx
on public.orders (status);
