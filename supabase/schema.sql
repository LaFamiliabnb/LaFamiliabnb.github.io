-- Schéma MVP pour l’espace propriétaire La Familia.
-- À exécuter dans Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  nowistay_property_id integer not null unique,
  name text not null,
  city text,
  cover_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.cleaning_reports (
  id uuid primary key default gen_random_uuid(),
  nowistay_mission_id integer not null unique,
  nowistay_property_id integer not null,
  property_id uuid not null references public.properties(id) on delete cascade,
  cleaner_name text,
  guest_name text,
  completed_at timestamptz,
  comment text,
  photos jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists owners_auth_user_id_idx on public.owners(auth_user_id);
create index if not exists properties_owner_id_idx on public.properties(owner_id);
create index if not exists properties_nowistay_property_id_idx on public.properties(nowistay_property_id);
create index if not exists cleaning_reports_property_id_idx on public.cleaning_reports(property_id);
create index if not exists cleaning_reports_nowistay_mission_id_idx on public.cleaning_reports(nowistay_mission_id);
create index if not exists cleaning_reports_completed_at_idx on public.cleaning_reports(completed_at desc);

alter table public.owners enable row level security;
alter table public.properties enable row level security;
alter table public.cleaning_reports enable row level security;

drop policy if exists "Owners can read own profile" on public.owners;
create policy "Owners can read own profile"
on public.owners
for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists "Owners can read own properties" on public.properties;
create policy "Owners can read own properties"
on public.properties
for select
to authenticated
using (
  exists (
    select 1
    from public.owners
    where owners.id = properties.owner_id
      and owners.auth_user_id = auth.uid()
  )
);

drop policy if exists "Owners can read own cleaning reports" on public.cleaning_reports;
create policy "Owners can read own cleaning reports"
on public.cleaning_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.properties
    join public.owners on owners.id = properties.owner_id
    where properties.id = cleaning_reports.property_id
      and owners.auth_user_id = auth.uid()
  )
);

-- Le script OVH utilise la service_role key : cette clé contourne RLS côté serveur.
-- Ne jamais exposer la service_role key dans GitHub Pages, HTML, JS, ou dans le navigateur.
