CREATE TABLE IF NOT EXISTS extraction_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  location TEXT NOT NULL,
  filter_rule TEXT DEFAULT '',
  leads_found INTEGER DEFAULT 0,
  leads_requested INTEGER DEFAULT 0,
  tokens_spent INTEGER DEFAULT 0,
  search_time_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extraction_history_user_id ON extraction_history(user_id);
ALTER TABLE extraction_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own history" ON extraction_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own history" ON extraction_history FOR INSERT WITH CHECK (auth.uid() = user_id);
