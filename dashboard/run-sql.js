const https = require('https');
const URL = 'mwnpwrzwgwrqqlomqhux.supabase.co';
const SRV = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFsb21xaHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIzODgyNCwiZXhwIjoyMDk0ODE0ODI0fQ.YVZQ3cPMJaPjBnggkEV4SxNeh4Y-PVisP2ST5YF0rl8';

const sql = `
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
create policy "whatsapp_sessions_select_own" on public.whatsapp_sessions for select using (auth.uid() = user_id);
drop policy if exists "whatsapp_sessions_insert_service" on public.whatsapp_sessions;
create policy "whatsapp_sessions_insert_service" on public.whatsapp_sessions for insert with check (true);
drop policy if exists "whatsapp_sessions_update_service" on public.whatsapp_sessions;
create policy "whatsapp_sessions_update_service" on public.whatsapp_sessions for update using (true);
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
create policy "whatsapp_messages_select_own" on public.whatsapp_messages for select using (auth.uid() = user_id);
drop policy if exists "whatsapp_messages_insert_own" on public.whatsapp_messages;
create policy "whatsapp_messages_insert_own" on public.whatsapp_messages for insert with check (auth.uid() = user_id);
`;

function doRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: URL,
      path,
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SRV,
        'Authorization': 'Bearer ' + SRV
      },
      rejectUnauthorized: false
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.setTimeout(15000, () => { r.destroy(); reject(new Error('Timeout')); });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  // First check if tables already exist
  const check = await doRequest('/rest/v1/whatsapp_sessions?limit=1', 'GET');
  console.log('Check tables:', check.status);
  if (check.status === 200) {
    console.log('Tables already exist!');
    return;
  }

  // Try to run via pg_graphql mutation
  const gql = {
    query: `mutation { execute(sql: ${JSON.stringify(sql)}) }`
  };
  const r1 = await doRequest('/graphql/v1', 'POST', gql);
  console.log('GraphQL response:', r1.status, r1.body.substring(0, 300));

  if (r1.status !== 200) {
    // Try creating exec_sql function first
    const createFunc = `
      create or replace function exec_sql(sql_text text) returns text
      language plpgsql security definer as $$
      begin execute sql_text; return 'OK'; end; $$;
    `;
    // We can't create functions via REST... just report
    console.log('Cannot execute DDL via REST API.');
    console.log('Please run the SQL manually in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/mwnpwrzwgwrqqlomqhux/sql/new');
  }
})();
