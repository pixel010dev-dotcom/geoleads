CREATE TABLE IF NOT EXISTS extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  location TEXT NOT NULL,
  filter_rule TEXT DEFAULT '',
  limit_requested INTEGER DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'pending',
  leads JSONB DEFAULT '[]'::jsonb,
  leads_count INTEGER DEFAULT 0,
  scanned INTEGER DEFAULT 0,
  cities_scanned INTEGER DEFAULT 0,
  tokens_spent INTEGER DEFAULT 0,
  search_time_seconds REAL DEFAULT 0,
  corrected_keyword TEXT DEFAULT '',
  corrected_location TEXT DEFAULT '',
  broad_region BOOLEAN DEFAULT FALSE,
  message TEXT DEFAULT '',
  error TEXT DEFAULT '',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extraction_jobs_user_id ON extraction_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON extraction_jobs(status);
ALTER TABLE extraction_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own jobs" ON extraction_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON extraction_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON extraction_jobs FOR UPDATE USING (auth.uid() = user_id);
