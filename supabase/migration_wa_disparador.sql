-- Suporte a multi-sessão: cada usuário pode ter N sessões
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS session_label text DEFAULT 'Principal';
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS session_id uuid DEFAULT gen_random_uuid();
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS proxy_url text;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS last_ban_check timestamptz;

-- Rate limit config por sessão
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS rate_limit_per_minute int DEFAULT 10;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS rate_limit_per_hour int DEFAULT 200;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS rate_limit_per_day int DEFAULT 500;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS min_delay_seconds int DEFAULT 20;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS max_delay_seconds int DEFAULT 60;

-- Tracking de rate limit em tempo real por sessão
CREATE TABLE IF NOT EXISTS wa_rate_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  minute_bucket timestamptz NOT NULL DEFAULT now(),
  hour_bucket timestamptz NOT NULL DEFAULT now(),
  day_bucket timestamptz NOT NULL DEFAULT now(),
  minute_count int DEFAULT 0,
  hour_count int DEFAULT 0,
  day_count int DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_wa_rate_session ON wa_rate_tracker(session_id);

-- Follow-ups automáticos
CREATE TABLE IF NOT EXISTS wa_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  lead_jid text NOT NULL,
  lead_name text,
  lead_phone text,
  step int DEFAULT 1,
  total_steps int DEFAULT 1,
  message_template text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_followup_schedule ON wa_followups(status, scheduled_at);
ALTER TABLE wa_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own followups" ON wa_followups FOR ALL USING (auth.uid() = user_id);

-- Campaign lead status tracking
CREATE TABLE IF NOT EXISTS wa_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  lead_jid text NOT NULL,
  lead_name text,
  lead_phone text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','delivered','read','opt_out')),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_campaign_leads_campaign ON wa_campaign_leads(campaign_id);
ALTER TABLE wa_campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own campaign leads" ON wa_campaign_leads FOR ALL USING (
  campaign_id IN (SELECT id FROM whatsapp_campaigns WHERE user_id = auth.uid())
);
