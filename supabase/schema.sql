-- Schéma actuel pour l’espace propriétaire La Familia.
-- Cette version utilise les tables Nowistay déjà présentes :
-- - public.nowistay_properties
-- - public.staff_cleaning_reports
-- Elle ajoute seulement une table de liaison entre Supabase Auth et les propriétaires Nowistay.

create extension if not exists pgcrypto;

create table if not exists public.owner_accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  nowistay_owner_id bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists owner_accounts_auth_user_id_idx on public.owner_accounts(auth_user_id);
create index if not exists owner_accounts_nowistay_owner_id_idx on public.owner_accounts(nowistay_owner_id);

alter table public.owner_accounts enable row level security;
alter table public.nowistay_properties enable row level security;
alter table public.staff_cleaning_reports enable row level security;

drop policy if exists "Owner accounts can read own account" on public.owner_accounts;
create policy "Owner accounts can read own account"
on public.owner_accounts
for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists "Owner accounts can read own Nowistay properties" on public.nowistay_properties;
create policy "Owner accounts can read own Nowistay properties"
on public.nowistay_properties
for select
to authenticated
using (
  exists (
    select 1
    from public.owner_accounts
    where owner_accounts.auth_user_id = auth.uid()
      and owner_accounts.nowistay_owner_id = nowistay_properties.owner_id
  )
);

drop policy if exists "Owner accounts can read own staff reports" on public.staff_cleaning_reports;
create policy "Owner accounts can read own staff reports"
on public.staff_cleaning_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.owner_accounts
    join public.nowistay_properties
      on nowistay_properties.owner_id = owner_accounts.nowistay_owner_id
    where owner_accounts.auth_user_id = auth.uid()
      and nowistay_properties.id = staff_cleaning_reports.property_id
  )
);

-- Anciennes tables MVP éventuellement créées avant cette adaptation :
-- public.owners, public.properties, public.cleaning_reports.
-- Elles ne sont plus utilisées par le front GitHub Pages.
-- Ne pas les supprimer sans vérifier qu’aucun autre test ne les utilise.
