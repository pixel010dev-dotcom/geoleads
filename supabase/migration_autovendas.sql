-- AutoVendas: campanhas automáticas de lead gen
-- Migration: autovendas_campaigns + autovendas_leads

create table if not exists autovendas_campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  nicho text not null,
  regiao text not null,
  mensagem_template text not null,
  leads_alvo integer default 50,
  status text default 'draft' check (status in ('draft','pending_payment','paid','running','paused','completed','cancelled')),
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  total_extracted integer default 0,
  total_messaged integer default 0,
  total_responses integer default 0,
  payment_status text default 'pending' check (payment_status in ('pending','paid','cancelled')),
  payment_id text,
  payment_pix_code text,
  payment_pix_qr text
);

alter table autovendas_campaigns enable row level security;

create policy "Users can view own campaigns"
  on autovendas_campaigns for select
  using (auth.uid() = user_id);

create policy "Users can insert own campaigns"
  on autovendas_campaigns for insert
  with check (auth.uid() = user_id);

create policy "Users can update own campaigns"
  on autovendas_campaigns for update
  using (auth.uid() = user_id);

create policy "Users can delete own campaigns"
  on autovendas_campaigns for delete
  using (auth.uid() = user_id);

create table if not exists autovendas_leads (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references autovendas_campaigns on delete cascade not null,
  nome text,
  telefone text,
  site text,
  email text,
  instagram text,
  cidade text,
  nicho text,
  status text default 'pending' check (status in ('pending','sent','responded','uninterested')),
  sent_at timestamptz,
  responded_at timestamptz,
  response_text text,
  created_at timestamptz default now()
);

alter table autovendas_leads enable row level security;

create policy "Users can view own campaign leads"
  on autovendas_leads for select
  using (
    exists (
      select 1 from autovendas_campaigns
      where autovendas_campaigns.id = autovendas_leads.campaign_id
      and autovendas_campaigns.user_id = auth.uid()
    )
  );

create policy "Users can insert leads to own campaigns"
  on autovendas_leads for insert
  with check (
    exists (
      select 1 from autovendas_campaigns
      where autovendas_campaigns.id = autovendas_leads.campaign_id
      and autovendas_campaigns.user_id = auth.uid()
    )
  );

create policy "Users can update own campaign leads"
  on autovendas_leads for update
  using (
    exists (
      select 1 from autovendas_campaigns
      where autovendas_campaigns.id = autovendas_leads.campaign_id
      and autovendas_campaigns.user_id = auth.uid()
    )
  );

create index if not exists idx_autovendas_campaigns_user on autovendas_campaigns(user_id);
create index if not exists idx_autovendas_leads_campaign on autovendas_leads(campaign_id);
