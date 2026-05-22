-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/mwnpwrzwgwrqqlomqhux/sql/new)
-- Creates tables for persistent WhatsApp sessions and message tracking

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
