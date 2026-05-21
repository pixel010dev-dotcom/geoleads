-- GeoLeads base schema
-- Run this file in the Supabase SQL Editor before enabling real cloud persistence.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  tokens integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_key text not null,
  nome text not null,
  telefone text,
  email text,
  site text,
  avaliacao text,
  instagram text,
  facebook text,
  stage text not null default 'Novo',
  notes text not null default '',
  nicho text,
  cidade text,
  saved_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_leads_user_lead_key_unique unique (user_id, lead_key)
);

alter table public.profiles enable row level security;
alter table public.crm_leads enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "crm_leads_select_own" on public.crm_leads;
create policy "crm_leads_select_own"
  on public.crm_leads for select
  using (auth.uid() = user_id);

drop policy if exists "crm_leads_insert_own" on public.crm_leads;
create policy "crm_leads_insert_own"
  on public.crm_leads for insert
  with check (auth.uid() = user_id);

drop policy if exists "crm_leads_update_own" on public.crm_leads;
create policy "crm_leads_update_own"
  on public.crm_leads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "crm_leads_delete_own" on public.crm_leads;
create policy "crm_leads_delete_own"
  on public.crm_leads for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_crm_leads_updated_at on public.crm_leads;
create trigger set_crm_leads_updated_at
before update on public.crm_leads
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, tokens)
  values (new.id, new.email, 10)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
