create extension if not exists "pgcrypto";

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null default 'otros' check (category in ('capilar', 'individuales', 'otros')),
  description text not null default '',
  image_url text,
  price numeric(10,2) not null default 0,
  offer_price numeric(10,2),
  active boolean not null default true,
  out_of_stock boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.products
  add column if not exists out_of_stock boolean not null default false;

create table if not exists public.site_settings (
  setting_key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  topic text not null default 'Duda general',
  message text not null,
  status text not null default 'received' check (status in ('received', 'in_review', 'replied', 'completed')),
  admin_reply text not null default '',
  replied_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.contact_messages
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table if exists public.contact_messages
  add column if not exists status text not null default 'received'
  check (status in ('received', 'in_review', 'replied', 'completed'));

alter table if exists public.contact_messages
  add column if not exists admin_reply text not null default '';

alter table if exists public.contact_messages
  add column if not exists replied_at timestamptz;

alter table if exists public.contact_messages
  add column if not exists completed_at timestamptz;

update public.contact_messages as messages
set user_id = users.id
from auth.users as users
where messages.user_id is null
  and lower(coalesce(messages.email, '')) = lower(coalesce(users.email, ''));

update public.contact_messages
set status = 'received'
where status is null
   or status not in ('received', 'in_review', 'replied', 'completed');

update public.contact_messages
set admin_reply = ''
where admin_reply is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = check_user_id
      and role = 'admin'
  );
$$;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

drop trigger if exists set_site_settings_updated_at on public.site_settings;
create trigger set_site_settings_updated_at
before update on public.site_settings
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case when excluded.full_name <> '' then excluded.full_name else public.user_profiles.full_name end,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

insert into public.user_profiles (id, email, full_name)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do update
  set email = excluded.email,
      full_name = case when excluded.full_name <> '' then excluded.full_name else public.user_profiles.full_name end,
      updated_at = timezone('utc', now());

alter table public.user_profiles enable row level security;
alter table public.products enable row level security;
alter table public.site_settings enable row level security;
alter table public.contact_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'Users can read own profile'
  ) then
    execute 'create policy "Users can read own profile" on public.user_profiles for select to authenticated using (auth.uid() = id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'Users can update own profile'
  ) then
    execute $policy$create policy "Users can update own profile" on public.user_profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id)$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'Admins can read all profiles'
  ) then
    execute $policy$create policy "Admins can read all profiles" on public.user_profiles for select to authenticated using (public.is_admin())$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'products' and policyname = 'Public can read active products'
  ) then
    execute 'create policy "Public can read active products" on public.products for select to public using (active = true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'products' and policyname = 'Admins can read all products'
  ) then
    execute $policy$create policy "Admins can read all products" on public.products for select to authenticated using (public.is_admin())$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'products' and policyname = 'Admins can insert products'
  ) then
    execute $policy$create policy "Admins can insert products" on public.products for insert to authenticated with check (public.is_admin())$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'products' and policyname = 'Admins can update products'
  ) then
    execute $policy$create policy "Admins can update products" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin())$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'products' and policyname = 'Admins can delete products'
  ) then
    execute $policy$create policy "Admins can delete products" on public.products for delete to authenticated using (public.is_admin())$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_settings' and policyname = 'Public can read site settings'
  ) then
    execute 'create policy "Public can read site settings" on public.site_settings for select to public using (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_settings' and policyname = 'Admins can insert site settings'
  ) then
    execute $policy$create policy "Admins can insert site settings" on public.site_settings for insert to authenticated with check (public.is_admin())$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_settings' and policyname = 'Admins can update site settings'
  ) then
    execute $policy$create policy "Admins can update site settings" on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin())$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_settings' and policyname = 'Admins can delete site settings'
  ) then
    execute $policy$create policy "Admins can delete site settings" on public.site_settings for delete to authenticated using (public.is_admin())$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_messages' and policyname = 'Public can insert contact messages'
  ) then
    execute $policy$create policy "Public can insert contact messages" on public.contact_messages for insert to public with check (user_id is null or auth.uid() = user_id)$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_messages' and policyname = 'Admins can read contact messages'
  ) then
    execute $policy$create policy "Admins can read contact messages" on public.contact_messages for select to authenticated using (public.is_admin())$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_messages' and policyname = 'Customers can read own contact messages'
  ) then
    execute $policy$create policy "Customers can read own contact messages" on public.contact_messages for select to authenticated using ((user_id = auth.uid()) or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')))$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_messages' and policyname = 'Admins can update contact messages'
  ) then
    execute $policy$create policy "Admins can update contact messages" on public.contact_messages for update to authenticated using (public.is_admin()) with check (public.is_admin())$policy$;
  end if;

  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'orders'
  ) then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'orders' and policyname = 'Admins can read all orders'
    ) then
      execute $policy$create policy "Admins can read all orders" on public.orders for select to authenticated using (public.is_admin())$policy$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'orders' and policyname = 'Admins can update all orders'
    ) then
      execute $policy$create policy "Admins can update all orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin())$policy$;
    end if;
  end if;
end
$$;

create index if not exists products_category_sort_idx
on public.products (category, sort_order, created_at);

create index if not exists products_active_idx
on public.products (active);

create index if not exists site_settings_updated_idx
on public.site_settings (updated_at desc);

create index if not exists contact_messages_created_idx
on public.contact_messages (created_at desc);

create index if not exists contact_messages_user_created_idx
on public.contact_messages (user_id, created_at desc);

create index if not exists contact_messages_status_created_idx
on public.contact_messages (status, created_at desc);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public can read product images'
  ) then
    execute 'create policy "Public can read product images" on storage.objects for select to public using (bucket_id = ''product-images'')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admins can upload product images'
  ) then
    execute $policy$create policy "Admins can upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin())$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admins can update product images'
  ) then
    execute $policy$create policy "Admins can update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin())$policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admins can delete product images'
  ) then
    execute $policy$create policy "Admins can delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin())$policy$;
  end if;
end
$$;

-- Promueve una sola cuenta como admin con este comando:
-- update public.user_profiles set role = 'admin' where email = 'tu-correo@dominio.com';