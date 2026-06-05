-- Chatbot AI Memory: per-contact extracted data and conversation history
CREATE TABLE IF NOT EXISTS chatbot_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_jid TEXT NOT NULL,
  contact_name TEXT,
  extracted_data JSONB DEFAULT '{}'::jsonb,
  conversation_history JSONB[] DEFAULT ARRAY[]::jsonb[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, contact_jid)
);

CREATE INDEX IF NOT EXISTS idx_memory_user_jid ON chatbot_memory(user_id, contact_jid);
CREATE INDEX IF NOT EXISTS idx_memory_updated ON chatbot_memory(updated_at DESC);

ALTER TABLE chatbot_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own memory" ON chatbot_memory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own memory" ON chatbot_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own memory" ON chatbot_memory
  FOR UPDATE USING (auth.uid() = user_id);

-- Chatbot Knowledge Base: business information the bot can reference
CREATE TABLE IF NOT EXISTS chatbot_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'geral',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_user_category ON chatbot_knowledge_base(user_id, category);
CREATE INDEX IF NOT EXISTS idx_kb_enabled ON chatbot_knowledge_base(user_id, enabled);

ALTER TABLE chatbot_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own kb" ON chatbot_knowledge_base
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own kb" ON chatbot_knowledge_base
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own kb" ON chatbot_knowledge_base
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users delete own kb" ON chatbot_knowledge_base
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update chatbot_memory.updated_at automatically
CREATE OR REPLACE FUNCTION update_chatbot_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chatbot_memory_updated
  BEFORE UPDATE ON chatbot_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_chatbot_memory_timestamp();

-- Add AI columns to chatbot_configs
ALTER TABLE chatbot_configs
  ADD COLUMN IF NOT EXISTS use_ai boolean not null default true,
  ADD COLUMN IF NOT EXISTS ai_instructions text not null default 'Você é um assistente de vendas amigável e profissional. Ajude clientes com dúvidas sobre serviços, agende reuniões e colete informações de contato.';
