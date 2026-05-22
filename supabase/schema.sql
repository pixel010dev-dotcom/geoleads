-- GeoLeads base schema
-- Run this file in the Supabase SQL Editor before enabling real cloud persistence.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan_id text not null default 'free',
  tokens integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists plan_id text not null default 'free';

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
  tiktok text,
  cnpj text,
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

alter table public.crm_leads
  add column if not exists tiktok text,
  add column if not exists cnpj text;

create table if not exists public.chatbot_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  business_name text not null default 'GeoLeads',
  welcome_message text not null default 'Olá! Sou o assistente automático. Me diga como posso ajudar.',
  fallback_message text not null default 'Recebi sua mensagem. Um atendente vai continuar por aqui em breve.',
  rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chatbot_configs_user_unique unique (user_id)
);

alter table public.profiles enable row level security;
alter table public.crm_leads enable row level security;
alter table public.chatbot_configs enable row level security;

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

drop policy if exists "chatbot_configs_select_own" on public.chatbot_configs;
create policy "chatbot_configs_select_own"
  on public.chatbot_configs for select
  using (auth.uid() = user_id);

drop policy if exists "chatbot_configs_insert_own" on public.chatbot_configs;
create policy "chatbot_configs_insert_own"
  on public.chatbot_configs for insert
  with check (auth.uid() = user_id);

drop policy if exists "chatbot_configs_update_own" on public.chatbot_configs;
create policy "chatbot_configs_update_own"
  on public.chatbot_configs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

drop trigger if exists set_chatbot_configs_updated_at on public.chatbot_configs;
create trigger set_chatbot_configs_updated_at
before update on public.chatbot_configs
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, plan_id, tokens)
  values (new.id, new.email, 'free', 10)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Tabela de historico de pagamentos
create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mp_payment_id text not null,
  plan_id text not null,
  tokens_added integer not null,
  amount numeric(10,2) not null,
  status text not null default 'approved',
  created_at timestamptz not null default now()
);

create unique index if not exists payment_history_mp_payment_id_unique
  on public.payment_history(mp_payment_id);

alter table public.payment_history enable row level security;

drop policy if exists "payment_history_select_own" on public.payment_history;
create policy "payment_history_select_own"
  on public.payment_history for select
  using (auth.uid() = user_id);

drop policy if exists "payment_history_insert_service" on public.payment_history;
create policy "payment_history_insert_service"
  on public.payment_history for insert
  with check (true);

-- Tabela de empresas CNPJ (base oficial)
create table if not exists public.cnpj_companies (
  id uuid primary key default gen_random_uuid(),
  cnpj text not null unique,
  razao_social text,
  nome_fantasia text,
  telefone text,
  email text,
  endereco text,
  cidade text,
  uf text,
  cep text,
  situacao text,
  atividade_principal text,
  naturezas_juridica text,
  data_abertura date,
  site text,
  instagram text,
  facebook text,
  tiktok text,
  source text not null default 'manual',
  confidence_score integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cnpj_companies_cnpj on public.cnpj_companies(cnpj);
create index if not exists idx_cnpj_companies_nome on public.cnpj_companies(nome_fantasia);
create index if not exists idx_cnpj_companies_cidade on public.cnpj_companies(cidade);

alter table public.cnpj_companies enable row level security;

drop policy if exists "cnpj_companies_select_public" on public.cnpj_companies;
create policy "cnpj_companies_select_public"
  on public.cnpj_companies for select
  using (true);

drop policy if exists "cnpj_companies_insert_service" on public.cnpj_companies;
create policy "cnpj_companies_insert_service"
  on public.cnpj_companies for insert
  with check (true);

drop policy if exists "cnpj_companies_update_service" on public.cnpj_companies;
create policy "cnpj_companies_update_service"
  on public.cnpj_companies for update
  using (true);

-- Tabela de enriquecimento social (cache de buscas)
create table if not exists public.social_enrichment_cache (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  city text,
  niche text,
  instagram text,
  facebook text,
  tiktok text,
  linkedin text,
  twitter text,
  confidence_score integer not null default 0,
  source text not null default 'search',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_social_cache_name_city on public.social_enrichment_cache(company_name, city);

alter table public.social_enrichment_cache enable row level security;

drop policy if exists "social_cache_select_public" on public.social_enrichment_cache;
create policy "social_cache_select_public"
  on public.social_enrichment_cache for select
  using (true);

drop policy if exists "social_cache_insert_service" on public.social_enrichment_cache;
create policy "social_cache_insert_service"
  on public.social_enrichment_cache for insert
  with check (true);

-- Funcao para buscar CNPJ pelo nome/cidade
create or replace function public.search_cnpj_by_name(
  search_name text,
  search_city text default null,
  limit_count integer default 5
)
returns table (
  cnpj text,
  razao_social text,
  nome_fantasia text,
  telefone text,
  email text,
  cidade text,
  uf text,
  situacao text,
  atividade_principal text,
  confidence_score integer
) as $$
begin
  return query
  select
    c.cnpj, c.razao_social, c.nome_fantasia, c.telefone, c.email,
    c.cidade, c.uf, c.situacao, c.atividade_principal, c.confidence_score
  from public.cnpj_companies c
  where
    (search_city is null or lower(c.cidade) = lower(search_city))
    and (
      similarity(lower(c.nome_fantasia), lower(search_name)) > 0.2
      or similarity(lower(c.razao_social), lower(search_name)) > 0.2
    )
  order by
    greatest(
      similarity(lower(c.nome_fantasia), lower(search_name)),
      similarity(lower(c.razao_social), lower(search_name))
    ) desc
  limit limit_count;
end;
$$ language plpgsql security definer;

-- WhatsApp sessions for persistent Baileys credentials
create table if not exists public.whatsapp_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creds jsonb not null default '{}'::jsonb,
  keys_json jsonb not null default '{}'::jsonb,
  last_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_sessions enable row level security;

drop policy if exists "whatsapp_sessions_select_own" on public.whatsapp_sessions;
create policy "whatsapp_sessions_select_own"
  on public.whatsapp_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "whatsapp_sessions_insert_service" on public.whatsapp_sessions;
create policy "whatsapp_sessions_insert_service"
  on public.whatsapp_sessions for insert
  with check (true);

drop policy if exists "whatsapp_sessions_update_service" on public.whatsapp_sessions;
create policy "whatsapp_sessions_update_service"
  on public.whatsapp_sessions for update
  using (true);

drop trigger if exists set_whatsapp_sessions_updated_at on public.whatsapp_sessions;
create trigger set_whatsapp_sessions_updated_at
  before update on public.whatsapp_sessions
  for each row execute function public.set_updated_at();

-- WhatsApp message queue (auto-disparo tracking)
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete set null,
  lead_name text not null,
  lead_phone text not null,
  message text not null,
  status text not null default 'pending',
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_messages_user_id on public.whatsapp_messages(user_id);
create index if not exists idx_whatsapp_messages_status on public.whatsapp_messages(status);

alter table public.whatsapp_messages enable row level security;

drop policy if exists "whatsapp_messages_select_own" on public.whatsapp_messages;
create policy "whatsapp_messages_select_own"
  on public.whatsapp_messages for select
  using (auth.uid() = user_id);

drop policy if exists "whatsapp_messages_insert_own" on public.whatsapp_messages;
create policy "whatsapp_messages_insert_own"
  on public.whatsapp_messages for insert
  with check (auth.uid() = user_id);

-- Atomic token deduction (prevents race conditions)
create or replace function public.deduct_tokens(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
as $$
declare
  v_current integer;
begin
  select tokens into v_current
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_current < p_amount then
    raise exception 'Insufficient tokens: have %, need %', v_current, p_amount;
  end if;

  update public.profiles
  set tokens = tokens - p_amount,
      updated_at = now()
  where id = p_user_id;

  return v_current - p_amount;
end;
$$;
