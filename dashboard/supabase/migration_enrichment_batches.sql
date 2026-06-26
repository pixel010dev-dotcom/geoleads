-- Migration: enrichment_batches
-- Persiste o estado dos batches de enriquecimento (substitui o Map em memória)

CREATE TABLE IF NOT EXISTS enrichment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  total INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  results JSONB DEFAULT '[]'::jsonb,
  leads JSONB DEFAULT '[]'::jsonb,
  error TEXT DEFAULT '',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_batches_user_id ON enrichment_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_batches_status ON enrichment_batches(status);
ALTER TABLE enrichment_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own batches" ON enrichment_batches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own batches" ON enrichment_batches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own batches" ON enrichment_batches FOR UPDATE USING (auth.uid() = user_id);
