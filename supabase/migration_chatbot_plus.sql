-- Chatbot conversations history
CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_jid text NOT NULL,
  contact_name text,
  contact_phone text,
  message_text text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  rule_id text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conv_user_id ON chatbot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_contact ON chatbot_conversations(contact_jid);
CREATE INDEX IF NOT EXISTS idx_conv_created ON chatbot_conversations(created_at DESC);

ALTER TABLE chatbot_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can select own conversations" ON chatbot_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can insert own conversations" ON chatbot_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Campaign / scheduling
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  message_template text NOT NULL,
  lead_keys jsonb DEFAULT '[]',
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','cancelled')),
  total_leads int DEFAULT 0,
  sent_count int DEFAULT 0,
  fail_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_user ON whatsapp_campaigns(user_id);

ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own campaigns" ON whatsapp_campaigns FOR ALL USING (auth.uid() = user_id);

-- Add chatbot config columns to profiles (auto-capture leads)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chatbot_auto_capture boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chatbot_capture_stage text DEFAULT 'Novo';
